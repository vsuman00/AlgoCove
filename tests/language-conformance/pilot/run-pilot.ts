import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  PILOT_PATTERNS,
  canonicalPilotBundle,
  validatePilotBundle,
} from "../../../packages/content/src/pilot-bundle.ts";
import { pilotHarness } from "../../../packages/content/src/pilot-harness.ts";
import { PROBLEM_LANGUAGES } from "../../../packages/domain/src/index.ts";

const profiles = JSON.parse(readFileSync("services/execution-images/profiles.json", "utf8")) as {
  profiles: { image: string; languages: string[] }[];
};
const mutators: Record<(typeof PROBLEM_LANGUAGES)[number], string> = {
  python: "def solve(values):\n    if values: values[0] = (values[0] + 1) % 101\n    return 0\n",
  javascript:
    "function solve(values) { if(values.length) values[0] = (values[0]+1)%101; return 0; }",
  typescript:
    "function solve(values: number[]): number { if(values.length) values[0] = (values[0]+1)%101; return 0; }",
  java: "static int solve(int[] values) { if(values.length>0) values[0]=(values[0]+1)%101; return 0; }",
  cpp: "int solve(vector<int>& values) { if(!values.empty()) values[0]=(values[0]+1)%101; return 0; }",
  c: "int solve(int values[], int n) { if(n>0) values[0]=(values[0]+1)%101; return 0; }",
};
const results: unknown[] = [];
const quote = (s: string) => "'" + s.replaceAll("'", "'\\''") + "'";
for (const pattern of PILOT_PATTERNS) {
  const text = readFileSync(`content/patterns/${pattern}/bundle.json`, "utf8");
  const bundle = validatePilotBundle(JSON.parse(text));
  for (const language of PROBLEM_LANGUAGES) {
    const image = profiles.profiles.find((p) => p.languages.includes(language))!.image;
    const inspect = spawnSync("docker", ["image", "inspect", "--format", "{{.Id}}", image], {
      encoding: "utf8",
    });
    if (inspect.status !== 0) throw Error("Build the pinned execution images first.");
    const outcomes = [];
    for (const candidate of ["solution", "starter", "mutation"] as const) {
      const harness = pilotHarness(
        language,
        candidate === "mutation" ? mutators[language] : bundle.languages[language][candidate],
      );
      const fixtures =
        candidate === "mutation"
          ? bundle.fixtures.filter((f) => f.values.length > 0).slice(0, 1)
          : bundle.fixtures;
      const script = [
        "set -eu",
        `printf '%s' "$PILOT_SOURCE" | base64 -d > ${quote(harness.file)}`,
        "mkdir -p /work/algocove-output /tmp/algocove-output",
        ...harness.compile.map((c) => c.map(quote).join(" ")),
        ...(candidate === "mutation" ? ["printf 'ALGOCOVE_COMPILED\n'"] : []),
        ...fixtures.map(
          (f) =>
            `printf '%s' ${quote(`${f.values.length}\n${f.values.join(" ")}\n`)} | ${harness.run.map(quote).join(" ")}`,
        ),
      ].join("\n");
      const run = spawnSync(
        "docker",
        [
          "run",
          "--rm",
          "--network=none",
          "--read-only",
          "--tmpfs=/work:rw,exec,nosuid,nodev,size=16m,uid=65532,gid=65532,mode=700",
          "--tmpfs=/tmp:rw,exec,nosuid,nodev,size=32m,uid=65532,gid=65532,mode=700",
          "--user=65532:65532",
          "--cap-drop=ALL",
          "--security-opt=no-new-privileges:true",
          "--pids-limit=64",
          "--memory=384m",
          "--memory-swap=384m",
          "--cpus=1",
          "--ulimit=nofile=64:64",
          "--ulimit=fsize=1048576:1048576",
          "--env=HOME=/work",
          "--env",
          `PILOT_SOURCE=${Buffer.from(harness.source).toString("base64")}`,
          image,
          "sh",
          "-c",
          script,
        ],
        { encoding: "utf8", timeout: 60_000, maxBuffer: 16384 },
      );
      if (candidate === "mutation") {
        if (run.error || run.status === 0 || !run.stdout.includes("ALGOCOVE_COMPILED"))
          throw Error(
            `${pattern}/${language}: mutation rejection did not follow successful compilation.`,
          );
        outcomes.push({ candidate, fixtures: 1, correct: 0, rejected: 1 });
        continue;
      }
      if (run.status !== 0)
        throw Error(
          `${pattern}/${language}/${candidate} compile/runtime failure: ${(run.stderr + run.stdout).slice(0, 2000)}`,
        );
      const outputs = run.stdout.trim().split(/\r?\n/);
      if (
        outputs.length !== bundle.fixtures.length ||
        outputs.some((o) => !/^(0|[1-9][0-9]*)$/.test(o))
      )
        throw Error("Untrusted output must contain one integer per fixture.");
      const matched = outputs.map((o, i) => Number(o) === bundle.fixtures[i]!.expected);
      if (candidate === "solution" && matched.some((ok) => !ok))
        throw Error(`${pattern}/${language} semantic mismatch.`);
      if (candidate === "starter" && matched.every(Boolean))
        throw Error("Wrong-result mutation was not detected.");
      outcomes.push({
        candidate,
        fixtures: matched.length,
        correct: matched.filter(Boolean).length,
        rejected: matched.filter((ok) => !ok).length,
      });
    }
    results.push({
      pattern,
      language,
      imageDigest: inspect.stdout.trim(),
      assetChecksum: `sha256:${createHash("sha256").update(text).digest("hex")}`,
      bundleChecksum: `sha256:${createHash("sha256").update(canonicalPilotBundle(bundle)).digest("hex")}`,
      outcomes,
    });
    process.stdout.write(
      `Passed ${pattern}/${language}: canonical results and wrong-result rejection.\n`,
    );
  }
}
mkdirSync(".tmp", { recursive: true });
writeFileSync(
  ".tmp/phase10-conformance.local.json",
  JSON.stringify({ schemaVersion: 1, status: "passed", results }, null, 2) + "\n",
);
