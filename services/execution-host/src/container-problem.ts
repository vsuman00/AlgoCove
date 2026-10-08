import type { ReviewedPilot } from "./pilot-problem.ts";
import { languageProfile, type ProblemLanguage } from "@algocove/domain";
import {
  parseRunDescriptor,
  sha256Digest,
  signRunDescriptor,
  type SigningKeyPair,
} from "@algocove/execution-contracts";
import {
  createExecutionDispatchMessage,
  type WebsiteExecutionRun,
  type ExecutionDispatchMessage,
} from "@algocove/execution-control";

export const CONTAINER_PROBLEM = "prb_dddddddddddddddd";
export const CONTAINER_FIXTURES = [
  { id: "container-single", heights: [5], expected: 0 },
  { id: "container-wide", heights: [1, 8, 6, 2, 5, 4, 8, 3, 7], expected: 49 },
  { id: "container-equal", heights: [4, 4, 4], expected: 8 },
] as const;
export const CONTAINER_FIXTURE_DIGEST = sha256Digest(JSON.stringify(CONTAINER_FIXTURES));
const manifests: Record<ProblemLanguage, string> = {
  python: "man_aaaaaaaaaaaaaaaa",
  javascript: "man_bbbbbbbbbbbbbbbb",
  typescript: "man_cccccccccccccccc",
  java: "man_dddddddddddddddd",
  cpp: "man_eeeeeeeeeeeeeeee",
  c: "man_ffffffffffffffff",
};

/** Reviewed wrapper: expected answers and signing material stay on the host. */
export function containerHarness(
  language: ProblemLanguage,
  source: string,
): {
  file: string;
  source: string;
  compile: readonly (readonly string[])[];
  run: readonly string[];
} {
  switch (language) {
    case "python":
      return {
        file: "/work/fixture.py",
        source: `${source}\nimport sys\n_values = list(map(int, sys.stdin.read().split()))\nprint(max_area(_values[1:]))\n`,
        compile: [["python", "-m", "py_compile", "/work/fixture.py"]],
        run: ["python", "/work/fixture.py"],
      };
    case "javascript":
      return {
        file: "/work/fixture.mjs",
        source: `${source}\nimport fs from 'node:fs';\nconst values = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nconsole.log(maxArea(values.slice(1)));\n`,
        compile: [["node", "--check", "/work/fixture.mjs"]],
        run: ["node", "/work/fixture.mjs"],
      };
    case "typescript":
      return {
        file: "/work/fixture.ts",
        source: `${source}\ndeclare function require(name: string): {readFileSync(fd: number, encoding: string): string};\nconst values = require('node:fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nconsole.log(maxArea(values.slice(1)));\n`,
        compile: [
          ["tsc", "--project", "/opt/algocove/tsconfig.typecheck.json"],
          ["tsc", "--project", "/opt/algocove/tsconfig.transpile.json"],
        ],
        run: ["node", "/tmp/algocove-output/fixture.js"],
      };
    case "java":
      return {
        file: "/work/Main.java",
        source: `import java.util.*;\npublic class Main {\n${source}\npublic static void main(String[] args) { Scanner s = new Scanner(System.in); int n = s.nextInt(); int[] h = new int[n]; for (int i=0;i<n;i++) h[i]=s.nextInt(); System.out.println(maxArea(h)); }\n}\n`,
        compile: [
          [
            "javac",
            "-J-Xmx96m",
            "-J-XX:ActiveProcessorCount=1",
            "-d",
            "/tmp/algocove-output",
            "/work/Main.java",
          ],
        ],
        run: [
          "java",
          "-Xmx96m",
          "-XX:ActiveProcessorCount=1",
          "-cp",
          "/tmp/algocove-output",
          "Main",
        ],
      };
    case "cpp":
      return {
        file: "/work/main.cpp",
        source: `#include <iostream>\n#include <vector>\n#include <algorithm>\nusing namespace std;\n${source}\nint main() { int n; cin>>n; vector<int> h(n); for (int& v:h) cin>>v; cout<<maxArea(h)<<'\\n'; }\n`,
        compile: [
          ["g++", "-std=c++23", "-O2", "/work/main.cpp", "-o", "/work/algocove-output/main"],
        ],
        run: ["/work/algocove-output/main"],
      };
    case "c":
      return {
        file: "/work/main.c",
        source: `#include <stdio.h>\n#include <stdlib.h>\n${source}\nint main(void) { int n; if (scanf("%d", &n)!=1 || n<0 || n>10000) return 1; int *h=malloc((size_t)n*sizeof(int)); for(int i=0;i<n;i++) if(scanf("%d", &h[i])!=1) return 1; printf("%d\\n",max_area(h,n)); free(h); return 0; }\n`,
        compile: [["gcc", "-std=c23", "-O2", "/work/main.c", "-o", "/work/algocove-output/main"]],
        run: ["/work/algocove-output/main"],
      };
  }
}

export function containerManifestDigest(language: ProblemLanguage): string {
  return sha256Digest(
    JSON.stringify({
      problem: CONTAINER_PROBLEM,
      manifest: manifests[language],
      profile: languageProfile(language),
      harness: containerHarness(language, ""),
    }),
  );
}

export function createContainerDescriptorPolicy(
  key: SigningKeyPair,
  images: Readonly<Record<ProblemLanguage, string>>,
  now: () => string,
  pilots: ReadonlyMap<string, ReviewedPilot> = new Map(),
): (run: WebsiteExecutionRun, eventId: string) => ExecutionDispatchMessage {
  return (
    run: WebsiteExecutionRun,
    eventId: Parameters<typeof createExecutionDispatchMessage>[0]["dispatchKey"],
  ) => {
    const pilot = pilots.get(run.problemVersionId);
    if (
      pilot
        ? run.manifestId !== pilot.manifestId(run.language)
        : run.problemVersionId !== CONTAINER_PROBLEM || run.manifestId !== manifests[run.language]
    )
      throw new Error("Reviewed problem manifest unavailable.");
    if (
      !Number.isSafeInteger(run.sourceLength) ||
      run.sourceLength < 0 ||
      run.sourceLength > 1048576
    )
      throw new Error("Source exceeds policy.");
    const image = images[run.language];
    const digest = image.match(/(?:@|^)(sha256:[a-f0-9]{64})$/)?.[1];
    if (digest === undefined) throw new Error("Immutable runtime image required.");
    const profile = languageProfile(run.language);
    const issuedAt = now();
    const parsed = parseRunDescriptor({
      schemaVersion: 1,
      runId: run.runId,
      attemptId: run.attemptId,
      problemVersionId: run.problemVersionId,
      language: run.language,
      adapterId: profile.adapterId,
      entrySignature: profile.entrySignature,
      manifestDigest: pilot?.manifestDigest(run.language) ?? containerManifestDigest(run.language),
      fixtureDigest: pilot?.fixtureDigest ?? CONTAINER_FIXTURE_DIGEST,
      runtimeImageDigest: digest,
      sourceDigest: run.sourceChecksum,
      limits: {
        ...profile.limitsProfile,
        cpuLimitMillis: 1000,
        pidLimit: 128,
        outputLimitBytes: 65536,
        sourceLimitBytes: 1048576,
      },
      phasePlan: ["compile", "run"],
      replayId: eventId,
      policyVersion: 1,
      keyId: key.keyId,
      leaseEpoch: 1,
      issuedAt,
      expiresAt: new Date(Date.parse(issuedAt) + 300000).toISOString(),
    });
    if (!parsed.ok) throw new Error(parsed.error.message);
    const signed = signRunDescriptor(parsed.value, key);
    if (!signed.ok) throw new Error(signed.error.message);
    const message = createExecutionDispatchMessage({
      dispatchKey: eventId,
      descriptor: signed.value,
      quota: { quotaKey: run.learnerId, profileId: run.language, maxConcurrent: 1 },
      now: issuedAt,
      verificationKeys: new Map([
        [key.keyId, { keyId: key.keyId, publicKey: key.publicKey, status: "active" }],
      ]),
    });
    if (!message.ok) throw new Error(message.error.message);
    return message.value;
  };
}
