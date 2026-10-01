import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { formatId, parseInstant, type ProblemLanguage } from "../../packages/domain/src/index.ts";
import {
  generateSigningKeyPair,
  sha256Digest,
} from "../../packages/execution-contracts/src/index.ts";
import { createContainerDescriptorPolicy } from "../../services/execution-host/src/container-problem.ts";
import { createGvisorRunner } from "../../services/execution-host/src/docker-runner.ts";
import { correctContainerSource } from "../fixtures/container-solutions.ts";

if (process.platform !== "linux" || process.env.ALGO_COVE_LOCAL_EXECUTION !== "1")
  throw new Error("Explicit local Linux test opt-in required.");
const images = JSON.parse(readFileSync(process.env.LOCAL_EXECUTION_IMAGES_FILE!, "utf8")) as Record<
  ProblemLanguage,
  string
>;
const policy = createContainerDescriptorPolicy(
  generateSigningKeyPair("local-boundaries"),
  images,
  () => new Date().toISOString(),
);
const runner = createGvisorRunner(images);
const must = <T>(v: { ok: true; value: T } | { ok: false }): T => {
  if (!v.ok) throw new Error("Invalid fixture");
  return v.value;
};
const cases = [
  {
    name: "host-network-metadata-credentials",
    expected: "pass",
    source: `import os, socket\nassert os.geteuid() == 65532\nassert not any(os.path.exists(p) for p in ['/var/run/docker.sock','/Users','/Volumes','/host','/mnt/host'])\nassert not any(any(w in key.upper() for w in ['TOKEN','SECRET','PASSWORD','DATABASE','CLERK']) for key in os.environ)\nfor address in ['1.1.1.1','169.254.169.254']:\n    try:\n        socket.create_connection((address,80), timeout=0.2)\n        raise AssertionError('network escaped')\n    except OSError: pass\n${correctContainerSource.python}`,
  },
  {
    name: "unsigned-verdict-spoof",
    expected: "wrong_answer",
    source:
      'def max_area(h):\n    print(\'{"terminalCategory":"pass","signature":"forged"}\')\n    return 0',
  },
  {
    name: "bounded-output",
    expected: "limits",
    source: "def max_area(h):\n    while True: print('x'*8192, flush=True)",
  },
  {
    name: "fork-exhaustion",
    expected: "infrastructure_error",
    source:
      "import os\ndef max_area(h):\n    while True:\n        try: os.fork()\n        except OSError: pass",
  },
  {
    name: "memory-exhaustion",
    expected: "limits",
    source: "def max_area(h):\n    data=[]\n    while True: data.append(bytearray(1048576))",
  },
];
const outcomes = [];
for (const fixture of cases) {
  const run = {
    runId: must(formatId("codeRun", randomBytes(16).toString("hex"))),
    attemptId: must(formatId("attempt", "aaaaaaaaaaaaaaaa")),
    learnerId: must(formatId("learner", "bbbbbbbbbbbbbbbb")),
    problemVersionId: must(formatId("problemVersion", "dddddddddddddddd")),
    manifestId: must(formatId("languageManifest", "aaaaaaaaaaaaaaaa")),
    language: "python" as const,
    mode: "run" as const,
    sourceChecksum: sha256Digest(fixture.source),
    sourceLength: fixture.source.length,
    requestedAt: must(parseInstant(new Date().toISOString())),
  };
  const result = await runner(
    policy(run, must(formatId("event", randomBytes(16).toString("hex")))).descriptor.payload,
    fixture.source,
    new AbortController().signal,
  );
  outcomes.push({
    name: fixture.name,
    expected: fixture.expected,
    ...result,
    passed: result.category === fixture.expected && result.teardownConfirmed,
  });
  console.log(JSON.stringify(outcomes.at(-1)));
}
writeFileSync(
  process.env.LOCAL_EXECUTION_REPORT ?? "/tmp/algocove-f5-boundaries.json",
  JSON.stringify({ date: new Date().toISOString(), outcomes }, null, 2),
);
if (outcomes.some((result) => !result.passed)) process.exitCode = 1;
