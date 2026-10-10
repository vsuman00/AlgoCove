import { describe, expect, it } from "vitest";
import {
  RUNTIME_PROFILES,
  assembleRuntimeManifest,
  canonicalRuntimeManifest,
} from "../../../ops/release/runtime-manifest.ts";
import { verifyRuntimeRelease, type ReleaseCommand } from "../../../ops/release/verify-runtime.ts";
const manifest = assembleRuntimeManifest(
  RUNTIME_PROFILES.map((profileId, i) => ({
    schemaVersion: 1,
    profileId,
    sourceSha: "a".repeat(40),
    sourceRunId: 123,
    sourceWorkflowRef: "vsuman00/AlgoCove/.github/workflows/execution-release.yml@refs/heads/main",
    imageDigest: "sha256:" + String(i + 1).repeat(64),
  })),
);
const run = () => ({
  head_sha: manifest.sourceSha,
  status: "completed",
  conclusion: "success",
  path: ".github/workflows/execution-release.yml",
  head_repository: { full_name: "vsuman00/AlgoCove" },
  head_branch: "main",
  event: "workflow_dispatch",
});
const jobs = () =>
  [
    "Admit exact CI revision",
    "Assemble and sign runtime image set",
    ...RUNTIME_PROFILES.map((profile) => `Build, scan, and sign ${profile}`),
  ].map((name) => ({ name, status: "completed", conclusion: "success" }));
function command(
  changeRun = run(),
  changeJobs = jobs(),
): { invoke: ReleaseCommand; calls: string[][] } {
  const calls: string[][] = [];
  return {
    calls,
    invoke: (name, args) => {
      calls.push([name, ...args]);
      if (name === "gh")
        return JSON.stringify(args[1]?.endsWith("per_page=100") ? { jobs: changeJobs } : changeRun);
      return "verified";
    },
  };
}
const verify = (invoke: ReleaseCommand) =>
  verifyRuntimeRelease(manifest, canonicalRuntimeManifest(manifest), "synthetic-bundle", invoke);
describe("runtime source and cryptographic admission", () => {
  it("verifies exact CI, workflow jobs, manifest and all four digest signatures", () => {
    const c = command();
    verify(c.invoke);
    expect(c.calls[0]!.slice(-2)).toEqual(["--sha", manifest.sourceSha]);
    const signatures = c.calls.filter((row) => row[0] === "cosign");
    expect(signatures).toHaveLength(5);
    expect(signatures.filter((row) => row[1] === "verify")).toHaveLength(4);
    for (const row of signatures) {
      expect(row).toContain("--certificate-github-workflow-sha");
      expect(row).toContain(manifest.sourceSha);
      expect(row).toContain(`https://github.com/${manifest.sourceWorkflowRef}`);
      expect(row).not.toContain("--insecure-ignore-tlog");
    }
  });
  it.each(["head_sha", "path", "head_branch", "event", "status", "conclusion"] as const)(
    "rejects a wrong %s before signature checks",
    (key) => {
      const c = command({ ...run(), [key]: "wrong" });
      expect(() => verify(c.invoke)).toThrow();
      expect(c.calls.some((row) => row[0] === "cosign")).toBe(false);
    },
  );
  it("rejects a foreign repository, missing or skipped scan, and duplicate jobs", () => {
    expect(() =>
      verify(command({ ...run(), head_repository: { full_name: "other/Repo" } }).invoke),
    ).toThrow();
    expect(() => verify(command(run(), jobs().slice(1)).invoke)).toThrow();
    expect(() =>
      verify(
        command(
          run(),
          jobs().map((job, i) => (i === 2 ? { ...job, conclusion: "skipped" } : job)),
        ).invoke,
      ),
    ).toThrow();
    expect(() => verify(command(run(), [...jobs(), jobs()[0]!]).invoke)).toThrow();
  });
  it.each(["ci", "blob", "image"])("fails closed on %s verification error", (failure) => {
    const c = command();
    expect(() =>
      verify((name, args) => {
        if (
          (failure === "ci" && name === process.execPath) ||
          (failure === "blob" && args[0] === "verify-blob") ||
          (failure === "image" && args[0] === "verify")
        )
          throw Error("verification failure");
        return c.invoke(name, args);
      }),
    ).toThrow();
  });
});
