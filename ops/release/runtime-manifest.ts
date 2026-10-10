import { createHash } from "node:crypto";
import { z } from "zod";

export const RUNTIME_PROFILES = ["python", "javascript-typescript", "java", "c-cpp"] as const;
const sha = z.string().regex(/^[a-f0-9]{40}$/);
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const workflowRef = z
  .string()
  .regex(
    /^vsuman00\/AlgoCove\/\.github\/workflows\/execution-release\.yml@refs\/(?:heads\/[a-zA-Z0-9_./-]+|tags\/execution-v[a-zA-Z0-9_.-]+)$/,
  );
export const imageReceiptSchema = z
  .object({
    schemaVersion: z.literal(1),
    profileId: z.enum(RUNTIME_PROFILES),
    sourceSha: sha,
    sourceRunId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    sourceWorkflowRef: workflowRef,
    imageDigest: digest,
  })
  .strict();
export type RuntimeImageReceipt = z.infer<typeof imageReceiptSchema>;
export const runtimeManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal("runtime-image-set"),
    sourceSha: sha,
    sourceRunId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    sourceWorkflowRef: workflowRef,
    profiles: z
      .object({
        python: digest,
        "javascript-typescript": digest,
        java: digest,
        "c-cpp": digest,
      })
      .strict(),
  })
  .strict();
export type RuntimeManifest = z.infer<typeof runtimeManifestSchema>;

/** Complete, same-source profile sets only; inputs never control registry/workflow names. */
export function assembleRuntimeManifest(rawReceipts: readonly unknown[]): RuntimeManifest {
  const receipts = rawReceipts.map((raw) => imageReceiptSchema.parse(raw));
  const first = receipts[0];
  if (!first || receipts.length !== RUNTIME_PROFILES.length) throw Error("runtime_set_incomplete");
  for (const profile of RUNTIME_PROFILES) {
    const rows = receipts.filter((row) => row.profileId === profile);
    if (
      rows.length !== 1 ||
      rows.some(
        (row) =>
          row.sourceSha !== first.sourceSha ||
          row.sourceRunId !== first.sourceRunId ||
          row.sourceWorkflowRef !== first.sourceWorkflowRef,
      )
    )
      throw Error("runtime_set_lineage_rejected");
  }
  return runtimeManifestSchema.parse({
    schemaVersion: 1,
    kind: "runtime-image-set",
    sourceSha: first.sourceSha,
    sourceRunId: first.sourceRunId,
    sourceWorkflowRef: first.sourceWorkflowRef,
    profiles: Object.fromEntries(
      RUNTIME_PROFILES.map((profile) => [
        profile,
        receipts.find((receipt) => receipt.profileId === profile)!.imageDigest,
      ]),
    ),
  });
}
export function canonicalRuntimeManifest(raw: unknown): string {
  const manifest = runtimeManifestSchema.parse(raw);
  return (
    JSON.stringify({
      ...manifest,
      profiles: Object.fromEntries(
        RUNTIME_PROFILES.map((profile) => [profile, manifest.profiles[profile]]),
      ),
    }) + "\n"
  );
}
export function runtimeManifestDigest(raw: unknown): string {
  return "sha256:" + createHash("sha256").update(canonicalRuntimeManifest(raw)).digest("hex");
}
export function runtimeImageMapping(raw: unknown): Record<string, string> {
  const manifest = runtimeManifestSchema.parse(raw);
  const image = (profile: (typeof RUNTIME_PROFILES)[number]) =>
    `ghcr.io/vsuman00/algocove/execution-${profile}@${manifest.profiles[profile]}`;
  return {
    python: image("python"),
    javascript: image("javascript-typescript"),
    typescript: image("javascript-typescript"),
    java: image("java"),
    c: image("c-cpp"),
    cpp: image("c-cpp"),
  };
}
