import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  canonicalRuntimeManifest,
  runtimeManifestDigest,
  runtimeManifestSchema,
  runtimeImageMapping,
  type RuntimeManifest,
} from "./runtime-manifest.ts";

export type RuntimePromotionInput = {
  stateDirectory: string;
  candidate: string;
  bundle: string;
  expectedCurrent: string | null;
  action: "promote" | "rollback";
};
export type RuntimePromotionReceipt = {
  schemaVersion: 1;
  decisionId: string;
  action: "promote" | "rollback";
  previousDigest: string | null;
  manifestDigest: string;
  sourceSha: string;
  sourceRunId: number;
  operatorUid: number | null;
  recordedAt: string;
  executionEnabled: false;
};

/** The operator's filesystem is the control boundary; never expose this as a web command.
 * Verification runs under the lock, before any pointer or audit change. */
export function promoteRuntimeRelease(
  input: RuntimePromotionInput,
  verify: (manifest: RuntimeManifest, canonical: string, bundle: string) => void,
): RuntimePromotionReceipt {
  mkdirSync(input.stateDirectory, { recursive: true, mode: 0o700 });
  const lock = join(input.stateDirectory, "promotion.lock");
  mkdirSync(lock, { mode: 0o700 });
  let temporary: string | undefined;
  try {
    const manifest = runtimeManifestSchema.parse(JSON.parse(input.candidate));
    const canonical = canonicalRuntimeManifest(manifest);
    // Signatures bind exact bytes, so alternate serialization is not admitted.
    if (input.candidate !== canonical) throw Error("runtime_noncanonical");
    const digest = runtimeManifestDigest(manifest);
    const currentFile = join(input.stateDirectory, "current.json");
    const current = existsSync(currentFile)
      ? (JSON.parse(readFileSync(currentFile, "utf8")) as RuntimePromotionReceipt)
      : null;
    if (
      (current?.manifestDigest ?? null) !== input.expectedCurrent ||
      current?.manifestDigest === digest
    )
      throw Error("runtime_stale_promotion");
    if (input.action === "rollback" && (!current || current.previousDigest !== digest))
      throw Error("runtime_rollback_lineage");
    verify(manifest, canonical, input.bundle);
    const receipt: RuntimePromotionReceipt = {
      schemaVersion: 1,
      decisionId: randomUUID(),
      action: input.action,
      previousDigest: current?.manifestDigest ?? null,
      manifestDigest: digest,
      sourceSha: manifest.sourceSha,
      sourceRunId: manifest.sourceRunId,
      operatorUid: process.getuid?.() ?? null,
      recordedAt: new Date().toISOString(),
      executionEnabled: false,
    };
    const sets = join(input.stateDirectory, "sets");
    const decisions = join(input.stateDirectory, "decisions");
    mkdirSync(sets, { recursive: true, mode: 0o700 });
    mkdirSync(decisions, { recursive: true, mode: 0o700 });
    const set = join(sets, digest.slice(7));
    if (!existsSync(set)) {
      temporary = join(sets, `.pending-${receipt.decisionId}`);
      mkdirSync(temporary, { mode: 0o700 });
      writeFileSync(join(temporary, "runtime-release.json"), canonical, {
        mode: 0o600,
        flag: "wx",
      });
      writeFileSync(join(temporary, "runtime-release.sigstore.json"), input.bundle, {
        mode: 0o600,
        flag: "wx",
      });
      writeFileSync(
        join(temporary, "images.json"),
        JSON.stringify(runtimeImageMapping(manifest)) + "\n",
        { mode: 0o600, flag: "wx" },
      );
      renameSync(temporary, set);
      temporary = undefined;
    } else if (
      readFileSync(join(set, "runtime-release.json"), "utf8") !== canonical ||
      readFileSync(join(set, "images.json"), "utf8") !==
        JSON.stringify(runtimeImageMapping(manifest)) + "\n"
    )
      throw Error("runtime_retained_set_corrupt");
    // A crash can leave an immutable decision without a pointer change. The
    // current pointer carries the decision identity and is the commit boundary.
    const body = JSON.stringify(receipt) + "\n";
    writeFileSync(join(decisions, `${receipt.decisionId}.json`), body, { mode: 0o600, flag: "wx" });
    temporary = join(input.stateDirectory, `.current-${receipt.decisionId}`);
    writeFileSync(temporary, body, { mode: 0o600, flag: "wx" });
    renameSync(temporary, currentFile);
    temporary = undefined;
    return receipt;
  } finally {
    if (temporary) rmSync(temporary, { recursive: true, force: true });
    rmSync(lock, { recursive: true });
  }
}
