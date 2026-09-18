import { err, ok, type Instant, type LearnerId, type OpaqueId, type Result } from "./primitives.ts";
import type { ProblemLanguage, ProblemVersionId } from "./language-manifest.ts";
import type { LanguageManifestId, LearningAttempt } from "./practice.ts";

export const PSEUDOCODE_FIELDS = [
  "inputs",
  "state",
  "initialization",
  "invariant",
  "loop",
  "termination",
  "output",
  "complexity",
] as const;
export type PseudocodeField = (typeof PSEUDOCODE_FIELDS)[number];
export type PseudocodeId = OpaqueId<"pseudocode">;

export type PseudocodeFields = Readonly<Record<PseudocodeField, string>>;

export const PSEUDOCODE_FIELD_MAX_LENGTH = 20_000;

export type PseudocodeArtifact = {
  readonly pseudocodeId: PseudocodeId;
  readonly attemptId: LearningAttempt["attemptId"];
  readonly learnerId: LearnerId;
  readonly problemVersionId: ProblemVersionId;
  readonly manifestId: LanguageManifestId;
  readonly language: ProblemLanguage;
  /** Replaceable private current fields; not an append-only revision. */
  readonly current: PseudocodeFields;
  readonly currentRevision: number;
  readonly savedRevision: number;
  readonly version: number;
  readonly updatedAt: Instant;
};

export type PseudocodeRevision = {
  readonly pseudocodeId: PseudocodeId;
  readonly attemptId: LearningAttempt["attemptId"];
  readonly learnerId: LearnerId;
  readonly problemVersionId: ProblemVersionId;
  readonly manifestId: LanguageManifestId;
  readonly language: ProblemLanguage;
  readonly revision: number;
  readonly fields: PseudocodeFields;
  readonly savedAt: Instant;
};

export type PseudocodeFailureCode =
  "invalid_field" | "invalid_version" | "invalid_time" | "no_changes";

export type PseudocodeFailure = {
  readonly code: PseudocodeFailureCode;
  readonly message: string;
};

export type PseudocodeTransition = {
  readonly artifact: PseudocodeArtifact;
  readonly revision?: PseudocodeRevision;
};

export type AuthoredPseudocodeRubric = {
  readonly rubricId: string;
  readonly version: number;
  readonly requiredFields: readonly PseudocodeField[];
  readonly requiredStructuredChecks: number;
  readonly requiredVerifiedPasses: number;
};

export type StructuredPseudocodeCheck = {
  readonly checkId: string;
  readonly rubricId: string;
  readonly rubricVersion: number;
  readonly pseudocodeId: PseudocodeId;
  readonly revision: number;
  readonly passed: boolean;
  readonly evidenceClass: "structured_check";
};

export type VerifiedRunEvidence = {
  readonly observationId: OpaqueId<"event">;
  readonly attemptId: LearningAttempt["attemptId"];
  readonly problemVersionId: ProblemVersionId;
  readonly manifestId: LanguageManifestId;
  readonly passed: boolean;
};

export type ExplainBackFeedback = {
  readonly source: "advisory" | "human_reviewed";
  readonly rubricVersion: number;
  readonly message: string;
};

export type PseudocodeReadiness = {
  readonly status: "ready" | "not_ready";
  readonly rubricId: string;
  readonly rubricVersion: number;
  readonly pseudocodeId: PseudocodeId;
  readonly revision: number;
  readonly missing: readonly string[];
  readonly evidence: {
    readonly structuredChecks: number;
    readonly verifiedPasses: number;
  };
};

function emptyFields(): PseudocodeFields {
  return {
    inputs: "",
    state: "",
    initialization: "",
    invariant: "",
    loop: "",
    termination: "",
    output: "",
    complexity: "",
  };
}

function validVersion(value: number, allowZero = false): boolean {
  return Number.isSafeInteger(value) && (allowZero ? value >= 0 : value > 0);
}

function validateFields(fields: PseudocodeFields): Result<undefined, PseudocodeFailure> {
  for (const field of PSEUDOCODE_FIELDS) {
    const value = fields[field];
    if (typeof value !== "string" || value.length > PSEUDOCODE_FIELD_MAX_LENGTH) {
      return err({
        code: "invalid_field",
        message: `Pseudocode field ${field} exceeds the bounded field limit.`,
      });
    }
  }
  return ok(undefined);
}

function sameFields(left: PseudocodeFields, right: PseudocodeFields): boolean {
  return PSEUDOCODE_FIELDS.every((field) => left[field] === right[field]);
}

export function startPseudocodeArtifact(input: {
  readonly pseudocodeId: PseudocodeId;
  readonly attempt: LearningAttempt;
  readonly startedAt: Instant;
}): Result<PseudocodeArtifact, PseudocodeFailure> {
  return ok({
    pseudocodeId: input.pseudocodeId,
    attemptId: input.attempt.attemptId,
    learnerId: input.attempt.learnerId,
    problemVersionId: input.attempt.problemVersionId,
    manifestId: input.attempt.manifestId,
    language: input.attempt.language,
    current: emptyFields(),
    currentRevision: 0,
    savedRevision: 0,
    version: 1,
    updatedAt: input.startedAt,
  });
}

export function replacePseudocodeCurrent(
  artifact: PseudocodeArtifact,
  input: { readonly fields: PseudocodeFields; readonly updatedAt: Instant },
): Result<PseudocodeTransition, PseudocodeFailure> {
  if (
    !validVersion(artifact.version) ||
    !validVersion(artifact.currentRevision, true) ||
    !validVersion(artifact.savedRevision, true) ||
    artifact.savedRevision > artifact.currentRevision
  ) {
    return err({ code: "invalid_version", message: "Pseudocode revision state is invalid." });
  }
  if (
    Number.isNaN(Date.parse(input.updatedAt)) ||
    Date.parse(input.updatedAt) < Date.parse(artifact.updatedAt)
  ) {
    return err({ code: "invalid_time", message: "Pseudocode time must be monotonic." });
  }
  const fields = validateFields(input.fields);
  if (!fields.ok) return fields;
  if (sameFields(input.fields, artifact.current)) {
    return err({ code: "no_changes", message: "Pseudocode has no new current fields." });
  }
  return ok({
    artifact: {
      ...artifact,
      current: input.fields,
      currentRevision: artifact.currentRevision + 1,
      version: artifact.version + 1,
      updatedAt: input.updatedAt,
    },
  });
}

export function savePseudocodeRevision(
  artifact: PseudocodeArtifact,
  input: { readonly savedAt: Instant },
): Result<PseudocodeTransition, PseudocodeFailure> {
  if (
    !validVersion(artifact.version) ||
    !validVersion(artifact.currentRevision, true) ||
    !validVersion(artifact.savedRevision, true) ||
    artifact.currentRevision <= artifact.savedRevision
  ) {
    return err({ code: "no_changes", message: "There is no unsaved pseudocode revision." });
  }
  if (
    Number.isNaN(Date.parse(input.savedAt)) ||
    Date.parse(input.savedAt) < Date.parse(artifact.updatedAt)
  ) {
    return err({ code: "invalid_time", message: "Pseudocode save time must be monotonic." });
  }
  const revision: PseudocodeRevision = {
    pseudocodeId: artifact.pseudocodeId,
    attemptId: artifact.attemptId,
    learnerId: artifact.learnerId,
    problemVersionId: artifact.problemVersionId,
    manifestId: artifact.manifestId,
    language: artifact.language,
    revision: artifact.currentRevision,
    fields: artifact.current,
    savedAt: input.savedAt,
  };
  return ok({
    artifact: {
      ...artifact,
      savedRevision: artifact.currentRevision,
      version: artifact.version + 1,
      updatedAt: input.savedAt,
    },
    revision,
  });
}

export function evaluatePseudocodeReadiness(input: {
  readonly artifact: PseudocodeArtifact;
  readonly revision: PseudocodeRevision;
  readonly rubric: AuthoredPseudocodeRubric;
  readonly structuredChecks: readonly StructuredPseudocodeCheck[];
  readonly verifiedRuns: readonly VerifiedRunEvidence[];
}): PseudocodeReadiness {
  const missing: string[] = [];
  for (const field of input.rubric.requiredFields) {
    if (input.revision.fields[field].trim().length === 0) missing.push(`field:${field}`);
  }
  const checks = input.structuredChecks.filter(
    (check) =>
      check.rubricId === input.rubric.rubricId &&
      check.rubricVersion === input.rubric.version &&
      check.pseudocodeId === input.revision.pseudocodeId &&
      check.revision === input.revision.revision &&
      check.evidenceClass === "structured_check" &&
      check.passed,
  );
  if (checks.length < input.rubric.requiredStructuredChecks) {
    missing.push("structured_checks");
  }
  const runs = input.verifiedRuns.filter(
    (run) =>
      run.attemptId === input.revision.attemptId &&
      run.problemVersionId === input.revision.problemVersionId &&
      run.manifestId === input.revision.manifestId &&
      run.passed,
  );
  if (runs.length < input.rubric.requiredVerifiedPasses) missing.push("verified_runs");
  return {
    status: missing.length === 0 ? "ready" : "not_ready",
    rubricId: input.rubric.rubricId,
    rubricVersion: input.rubric.version,
    pseudocodeId: input.revision.pseudocodeId,
    revision: input.revision.revision,
    missing,
    evidence: { structuredChecks: checks.length, verifiedPasses: runs.length },
  };
}
