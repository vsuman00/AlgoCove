import { parseId, parseContentChecksum } from "@algocove/domain";
import { validationError } from "./errors.ts";

export const WORKER_JOB_TOPICS = [
  "content.derivation.requested",
  "content.embedding.requested",
  "evaluation.requested",
  "privacy.retention.requested",
  "platform.reconciliation.requested",
] as const;
export type WorkerJobTopic = (typeof WORKER_JOB_TOPICS)[number];
export type WorkerJobDescriptor =
  | {
      readonly schemaVersion: 1;
      readonly contentVersionId: string;
      readonly sourceChecksum: string;
      readonly policyVersion: string;
    }
  | { readonly schemaVersion: 1; readonly configurationId: string; readonly suiteVersion: string }
  | {
      readonly schemaVersion: 1;
      readonly scope: "outbox_and_derivations" | "expired_drafts";
      readonly limit: number;
    };

/** Descriptors reference canonical module inputs; raw learner/source/model text is rejected. */
export function parseWorkerJobDescriptor(topic: string, value: unknown): WorkerJobDescriptor {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw validationError("A worker descriptor object is required.");
  const v = value as Record<string, unknown>;
  const label = (x: unknown) => typeof x === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(x);
  let allowed: readonly string[];
  if (topic === "content.derivation.requested" || topic === "content.embedding.requested") {
    allowed = ["schemaVersion", "contentVersionId", "sourceChecksum", "policyVersion"];
    if (
      !parseId("contentVersion", v.contentVersionId).ok ||
      !parseContentChecksum(v.sourceChecksum).ok ||
      !label(v.policyVersion)
    )
      throw validationError("Versioned canonical content references are required.");
  } else if (topic === "evaluation.requested") {
    allowed = ["schemaVersion", "configurationId", "suiteVersion"];
    if (!label(v.configurationId) || !label(v.suiteVersion))
      throw validationError("A configuration and declared evaluation suite are required.");
  } else if (
    topic === "platform.reconciliation.requested" ||
    topic === "privacy.retention.requested"
  ) {
    allowed = ["schemaVersion", "scope", "limit"];
    if (
      v.scope !==
        (topic === "platform.reconciliation.requested"
          ? "outbox_and_derivations"
          : "expired_drafts") ||
      !Number.isSafeInteger(v.limit) ||
      Number(v.limit) < 1 ||
      Number(v.limit) > 500
    )
      throw validationError("A supported maintenance scope and bounded limit are required.");
  } else throw validationError("Unknown worker job topic.");
  if (
    v.schemaVersion !== 1 ||
    Object.keys(v).length !== allowed.length ||
    Object.keys(v).some((k) => !allowed.includes(k))
  )
    throw validationError("Only the declared versioned descriptor fields are permitted.");
  return Object.freeze({ ...v }) as WorkerJobDescriptor;
}
