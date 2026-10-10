import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  assembleRuntimeManifest,
  canonicalRuntimeManifest,
  RUNTIME_PROFILES,
  runtimeImageMapping,
} from "./runtime-manifest.ts";

try {
  const [directory, output, ...extra] = process.argv.slice(2);
  if (!directory || !output || extra.length) throw Error("arguments");
  const names = readdirSync(directory).sort();
  if (
    names.join() !==
    RUNTIME_PROFILES.map((id) => `${id}.json`)
      .sort()
      .join()
  )
    throw Error("receipt_membership");
  const manifest = assembleRuntimeManifest(
    names.map((name) => JSON.parse(readFileSync(join(directory, name), "utf8"))),
  );
  if (
    manifest.sourceSha !== process.env.GITHUB_SHA ||
    String(manifest.sourceRunId) !== process.env.GITHUB_RUN_ID ||
    manifest.sourceWorkflowRef !== process.env.GITHUB_WORKFLOW_REF
  )
    throw Error("source_context");
  execFileSync(process.execPath, ["ops/release/preflight.ts", "--sha", manifest.sourceSha], {
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60000,
  });
  const images = [...new Set(Object.values(runtimeImageMapping(manifest)))];
  for (const image of images) {
    execFileSync(
      "cosign",
      [
        "verify",
        image,
        "--certificate-identity",
        `https://github.com/${manifest.sourceWorkflowRef}`,
        "--certificate-oidc-issuer",
        "https://token.actions.githubusercontent.com",
        "--certificate-github-workflow-sha",
        manifest.sourceSha,
      ],
      { stdio: ["ignore", "pipe", "pipe"], timeout: 60000 },
    );
  }
  writeFileSync(output, canonicalRuntimeManifest(manifest), { flag: "wx" });
  process.stdout.write('{"status":"runtime_candidate_verified","executionEnabled":false}\n');
} catch {
  process.stderr.write('{"status":"runtime_candidate_rejected"}\n');
  process.exitCode = 1;
}
