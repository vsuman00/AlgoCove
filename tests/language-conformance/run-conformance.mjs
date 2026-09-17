import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { buildLineage, judgeOutput, stableSha256 } from "./conformance-core.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = JSON.parse(
  await readFile(path.join(root, "tests/language-conformance/manifest.json"), "utf8"),
);
const profilesDocument = JSON.parse(
  await readFile(path.join(root, "services/execution-images/profiles.json"), "utf8"),
);

const limits = [
  "--network=none",
  "--read-only",
  "--tmpfs=/work:rw,exec,nosuid,nodev,size=16m,uid=65532,gid=65532,mode=700",
  "--tmpfs=/tmp:rw,nosuid,nodev,size=32m,uid=65532,gid=65532,mode=700",
  "--cap-drop=ALL",
  "--security-opt=no-new-privileges:true",
  "--pids-limit=32",
  "--memory=384m",
  "--memory-swap=384m",
  "--cpus=0.5",
  "--ulimit=nofile=64:64",
  "--ulimit=fsize=1048576:1048576",
  "--user=65532:65532",
  "--env=HOME=/work",
];

const commands = {
  python: "python /work/fixture.py",
  javascript: "node /work/fixture.mjs",
  typescript:
    "tsc --project /opt/algocove/tsconfig.typecheck.json && tsc --project /opt/algocove/tsconfig.transpile.json && node /tmp/algocove-output/fixture.js",
  java: "mkdir -p /tmp/algocove-output && javac -d /tmp/algocove-output /work/Main.java && java -cp /tmp/algocove-output Main",
  cpp: "mkdir -p /work/algocove-output && g++ -std=c++23 -O2 /work/main.cpp -o /work/algocove-output/main && /work/algocove-output/main",
  c: "mkdir -p /work/algocove-output && gcc -std=c23 -O2 /work/main.c -o /work/algocove-output/main && /work/algocove-output/main",
};

const profileById = new Map(profilesDocument.profiles.map((profile) => [profile.id, profile]));
const fixtureById = new Map(manifest.fixtures.map((fixture) => [fixture.fixtureId, fixture]));

if (
  manifest.languages.length !== 6 ||
  new Set(manifest.languages.map((entry) => entry.language)).size !== 6
) {
  throw new Error("The conformance manifest must contain six distinct language adapters.");
}
if (
  manifest.fixtures.length !== 6 ||
  new Set(manifest.fixtures.map((fixture) => fixture.fixtureId)).size !== 6
) {
  throw new Error("The conformance manifest must contain six distinct semantic fixtures.");
}
for (const language of manifest.languages) {
  const profile = profileById.get(language.profileId);
  if (profile === undefined || !profile.languages.includes(language.language)) {
    throw new Error(`No pinned image profile covers ${language.language}.`);
  }
  if (commands[language.language] === undefined)
    throw new Error(`No command adapter covers ${language.language}.`);
}

function imageDigest(image) {
  const inspect = spawnSync(
    "docker",
    ["image", "inspect", "--format", "{{json .RepoDigests}}|{{.Id}}", image],
    {
      encoding: "utf8",
    },
  );
  if (inspect.status !== 0) throw new Error(`Image ${image} is not built locally.`);
  const [repoDigestsJson, imageId] = inspect.stdout.trim().split("|");
  const repoDigests = JSON.parse(repoDigestsJson ?? "null");
  if (Array.isArray(repoDigests) && repoDigests.length > 0) {
    return repoDigests[0].split("@")[1];
  }
  if (/^sha256:[0-9a-f]{64}$/.test(imageId ?? "")) return imageId;
  throw new Error(`Image ${image} has no immutable local digest.`);
}

function sourceFile(language) {
  return language.sourceFile;
}

function runCandidate({ language, profile, source, input }) {
  const encodedSource = Buffer.from(source, "utf8").toString("base64");
  const encodedInput = Buffer.from(input, "utf8").toString("base64");
  const command = [
    "set -eu",
    `printf '%s' "$ALGOCOVE_SOURCE" | base64 -d > /work/${sourceFile(language)}`,
    `printf '%s' "$ALGOCOVE_INPUT" | base64 -d > /work/conformance-input.txt`,
    `${commands[language.language]} < /work/conformance-input.txt`,
  ].join(" && ");
  return spawnSync(
    "docker",
    [
      "run",
      "--rm",
      ...limits,
      "--env",
      `ALGOCOVE_SOURCE=${encodedSource}`,
      "--env",
      `ALGOCOVE_INPUT=${encodedInput}`,
      profile.image,
      "sh",
      "-c",
      command,
    ],
    { encoding: "utf8", timeout: 20_000, maxBuffer: 16_384 },
  );
}

function resultFor({ manifestLanguage, fixture, candidate, source, processResult, image }) {
  const processCategory = processResult.status === 0 ? null : "learner_failed";
  const judged = processCategory
    ? {
        category: processCategory,
        normalizedOutput: processResult.stdout.trim().slice(0, 512),
        diagnosticCode: "compile_or_runtime_failure",
      }
    : judgeOutput(processResult.stdout, fixture.expectedOutput);
  return {
    language: manifestLanguage.language,
    fixtureId: fixture.fixtureId,
    candidate,
    category: judged.category,
    diagnosticCode: judged.diagnosticCode,
    normalizedOutput: judged.normalizedOutput,
    processExitCode: processResult.status,
    stderr: processResult.stderr.trim().slice(0, 512),
    lineage: {
      ...buildLineage({
        manifest,
        fixture,
        language: manifestLanguage.language,
        imageDigest: image,
      }),
      sourceDigest: stableSha256(source),
      limitsProfile: manifestLanguage.limitsProfile,
    },
  };
}

const imageDigests = new Map();
const results = [];
for (const manifestLanguage of manifest.languages) {
  const profile = profileById.get(manifestLanguage.profileId);
  const source = await readFile(
    path.join(root, "tests/language-conformance", manifestLanguage.source),
    "utf8",
  );
  const image = imageDigests.get(profile.image) ?? imageDigest(profile.image);
  imageDigests.set(profile.image, image);
  for (const fixture of manifest.fixtures) {
    const processResult = runCandidate({
      language: manifestLanguage,
      profile,
      source,
      input: fixture.input,
    });
    const result = resultFor({
      manifestLanguage,
      fixture,
      candidate: "correct",
      source,
      processResult,
      image,
    });
    if (result.category !== "passed") {
      throw new Error(
        `${manifestLanguage.language}/${fixture.fixtureId} did not pass: ${result.category} ${result.diagnosticCode ?? ""}\n${result.stderr}`,
      );
    }
    results.push(result);
  }
}

const mutationReplacements = {
  python: ["matches = total == target", "matches = total != target"],
  javascript: ["const matches = total === target;", "const matches = total !== target;"],
  typescript: ["const matches = total === target;", "const matches = total !== target;"],
  java: ["boolean matches = sum == target;", "boolean matches = sum != target;"],
  cpp: ["const bool matches = sum == target;", "const bool matches = sum != target;"],
  c: ["const int matches = sum == target;", "const int matches = sum != target;"],
};
const mutationResults = [];
const noMatch = fixtureById.get("pair-sum-no-match");
if (noMatch === undefined) throw new Error("Mutation fixture is missing.");
for (const manifestLanguage of manifest.languages) {
  const profile = profileById.get(manifestLanguage.profileId);
  const source = await readFile(
    path.join(root, "tests/language-conformance", manifestLanguage.source),
    "utf8",
  );
  const [from, to] = mutationReplacements[manifestLanguage.language];
  const mutatedSource = source.replace(from, to);
  if (mutatedSource === source)
    throw new Error(`Mutation did not change ${manifestLanguage.language}.`);
  const image = imageDigests.get(profile.image);
  const processResult = runCandidate({
    language: manifestLanguage,
    profile,
    source: mutatedSource,
    input: noMatch.input,
  });
  const result = resultFor({
    manifestLanguage,
    fixture: noMatch,
    candidate: "mutated-not-equal",
    source: mutatedSource,
    processResult,
    image,
  });
  if (result.category !== "learner_failed") {
    throw new Error(`${manifestLanguage.language} mutation was accepted by the trusted judge.`);
  }
  mutationResults.push(result);
}

const spoofed = judgeOutput("PASS\n", noMatch.expectedOutput);
const expectedValueSpoof = judgeOutput("0,1|no-match\n", noMatch.expectedOutput);
if (spoofed.category !== "learner_failed" || spoofed.diagnosticCode !== "malformed_output") {
  throw new Error("Spoofed candidate verdict was not rejected.");
}
if (
  expectedValueSpoof.category !== "learner_failed" ||
  expectedValueSpoof.diagnosticCode !== "wrong_answer"
) {
  throw new Error("Expected-value spoof was not rejected by the trusted judge.");
}

console.log(
  JSON.stringify(
    {
      status: "passed",
      manifestDigest: stableSha256(manifest),
      fixtureCount: manifest.fixtures.length,
      languageCount: manifest.languages.length,
      correctResults: results.length,
      mutationCount: mutationResults.length,
      securityChecks: {
        spoofedVerdictRejected: true,
        expectedValueSpoofRejected: true,
        candidateVerdictsIgnored: true,
      },
      imageDigests: Object.fromEntries(imageDigests),
      results,
      mutationResults,
    },
    null,
    2,
  ),
);
