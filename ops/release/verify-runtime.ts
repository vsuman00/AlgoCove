import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { RUNTIME_PROFILES, runtimeImageMapping, type RuntimeManifest } from "./runtime-manifest.ts";

export type ReleaseCommand = (command: string, args: readonly string[]) => string;
export const releaseCommand: ReleaseCommand = (command, args) =>
  execFileSync(command, [...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60000,
    maxBuffer: 4 * 1024 * 1024,
  });

/** Verify current CI, the completed release workflow, manifest and every image.
 * No bypass or unsigned mode exists in the operator CLI. */
export function verifyRuntimeRelease(
  manifest: RuntimeManifest,
  canonical: string,
  bundle: string,
  command: ReleaseCommand = releaseCommand,
): void {
  command(process.execPath, [
    fileURLToPath(new URL("./preflight.ts", import.meta.url)),
    "--sha",
    manifest.sourceSha,
  ]);
  const run = JSON.parse(
    command("gh", ["api", `repos/vsuman00/AlgoCove/actions/runs/${manifest.sourceRunId}`]),
  );
  const ref = manifest.sourceWorkflowRef.split("@")[1]!;
  if (
    run.head_sha !== manifest.sourceSha ||
    run.status !== "completed" ||
    run.conclusion !== "success" ||
    run.path !== ".github/workflows/execution-release.yml" ||
    run.head_repository?.full_name !== "vsuman00/AlgoCove" ||
    !["workflow_dispatch", "push"].includes(run.event) ||
    (ref.startsWith("refs/heads/") && run.head_branch !== ref.slice(11))
  )
    throw Error("runtime_release_run_rejected");
  const jobs = JSON.parse(
    command("gh", [
      "api",
      `repos/vsuman00/AlgoCove/actions/runs/${manifest.sourceRunId}/jobs?per_page=100`,
    ]),
  ).jobs as { name: string; status: string; conclusion: string }[];
  const required = [
    "Admit exact CI revision",
    "Assemble and sign runtime image set",
    ...RUNTIME_PROFILES.map((profile) => `Build, scan, and sign ${profile}`),
  ];
  for (const name of required) {
    const matches = jobs.filter((job) => job.name === name);
    if (
      matches.length !== 1 ||
      matches[0]?.status !== "completed" ||
      matches[0]?.conclusion !== "success"
    )
      throw Error("runtime_release_job_rejected");
  }
  const directory = mkdtempSync(join(tmpdir(), "algocove-runtime-verification-"));
  try {
    const file = join(directory, "runtime-release.json"),
      signature = join(directory, "bundle.json");
    writeFileSync(file, canonical, { mode: 0o600 });
    writeFileSync(signature, bundle, { mode: 0o600 });
    const identity = [
      "--certificate-identity",
      `https://github.com/${manifest.sourceWorkflowRef}`,
      "--certificate-oidc-issuer",
      "https://token.actions.githubusercontent.com",
      "--certificate-github-workflow-sha",
      manifest.sourceSha,
    ];
    command("cosign", ["verify-blob", file, "--bundle", signature, ...identity]);
    for (const image of [...new Set(Object.values(runtimeImageMapping(manifest)))])
      command("cosign", ["verify", image, ...identity]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
