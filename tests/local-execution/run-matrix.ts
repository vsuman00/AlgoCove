import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import {
  formatId,
  parseInstant,
  parseContentChecksum,
  PROBLEM_LANGUAGES,
  type ProblemLanguage,
} from "../../packages/domain/src/index.ts";
import {
  generateSigningKeyPair,
  sha256Digest,
} from "../../packages/execution-contracts/src/index.ts";
import { createContainerDescriptorPolicy } from "../../services/execution-host/src/container-problem.ts";
import {
  createGvisorRunner,
  dockerCommand,
} from "../../services/execution-host/src/docker-runner.ts";
import {
  correctContainerSource,
  wrongContainerSource,
  timeoutContainerSource,
  runtimeErrorContainerSource,
} from "../fixtures/container-solutions.ts";

if (process.platform !== "linux" || process.env.ALGO_COVE_LOCAL_EXECUTION !== "1")
  throw new Error("Explicit local Linux test opt-in required.");
const images = JSON.parse(readFileSync(process.env.LOCAL_EXECUTION_IMAGES_FILE!, "utf8")) as Record<
  ProblemLanguage,
  string
>;
const key = generateSigningKeyPair("matrix-local");
const policy = createContainerDescriptorPolicy(key, images, () => new Date().toISOString());
const runner = createGvisorRunner(images, async (args, options) => {
  const result = await dockerCommand(args, options);
  if (result.code === 125 || result.code === 126)
    console.error(
      JSON.stringify({
        command: args[0],
        stderr: result.stderr.slice(0, 500),
        stdout: result.stdout.slice(0, 500),
      }),
    );
  return result;
});
const must = <T>(v: { ok: true; value: T } | { ok: false }): T => {
  if (!v.ok) throw new Error("Invalid fixture");
  return v.value;
};
const outcomes: unknown[] = [];
for (const language of PROBLEM_LANGUAGES) {
  for (const category of [
    "pass",
    "wrong_answer",
    "compile_error",
    "runtime_error",
    "limits",
    "infrastructure_error",
  ] as const) {
    const source =
      category === "pass" || category === "infrastructure_error"
        ? correctContainerSource[language]
        : category === "wrong_answer"
          ? wrongContainerSource[language]
          : category === "runtime_error"
            ? runtimeErrorContainerSource[language]
            : category === "limits"
              ? timeoutContainerSource[language]
              : "???";
    const run = {
      runId: must(formatId("codeRun", randomBytes(16).toString("hex"))),
      attemptId: must(formatId("attempt", "aaaaaaaaaaaaaaaa")),
      learnerId: must(formatId("learner", "bbbbbbbbbbbbbbbb")),
      problemVersionId: must(formatId("problemVersion", "dddddddddddddddd")),
      manifestId: must(
        formatId("languageManifest", "abcdef"[PROBLEM_LANGUAGES.indexOf(language)]!.repeat(16)),
      ),
      language,
      mode: "run" as const,
      sourceChecksum: sha256Digest(source),
      sourceLength: source.length,
      requestedAt: must(parseInstant(new Date().toISOString())),
    };
    const descriptor = policy(run, must(formatId("event", randomBytes(16).toString("hex"))))
      .descriptor.payload;
    const start = Date.now();
    const actualRunner =
      category === "infrastructure_error"
        ? createGvisorRunner({ ...images, [language]: `sha256:${"0".repeat(64)}` })
        : runner;
    const actualDescriptor =
      category === "infrastructure_error"
        ? {
            ...descriptor,
            runtimeImageDigest: must(parseContentChecksum(`sha256:${"0".repeat(64)}`)),
          }
        : descriptor;
    const outcome = await actualRunner(actualDescriptor, source, new AbortController().signal);
    const expected =
      category === "compile_error" && language === "typescript" ? "type_error" : category;
    const passed = outcome.category === expected && outcome.teardownConfirmed;
    outcomes.push({
      language,
      expected,
      ...outcome,
      passed,
      elapsedMs: Date.now() - start,
      memoryMb: descriptor.limits.memoryLimitMb,
      pidLimit: descriptor.limits.pidLimit,
    });
    console.log(JSON.stringify(outcomes.at(-1)));
  }
}
writeFileSync(
  process.env.LOCAL_EXECUTION_REPORT ?? "/tmp/algocove-f5-matrix.json",
  JSON.stringify({ date: new Date().toISOString(), images, outcomes }, null, 2),
);
if (outcomes.some((v) => !(v as { passed: boolean }).passed)) process.exitCode = 1;
