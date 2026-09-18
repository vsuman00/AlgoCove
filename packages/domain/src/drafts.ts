import {
  addDurationToInstant,
  durationFromMs,
  err,
  type Instant,
  type LearnerId,
  type OpaqueId,
  ok,
  type Result,
} from "./primitives.ts";
import type { LanguageManifestId, LearningAttempt } from "./practice.ts";

export const DRAFT_KINDS = ["source", "pseudocode"] as const;
export type DraftKind = (typeof DRAFT_KINDS)[number];
export type DraftId = OpaqueId<"draft">;

/** Seven days bounds recovery without becoming an unbounded private archive. */
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SOURCE_DRAFT_MAX_LENGTH = 1_048_576;
export const PSEUDOCODE_DRAFT_MAX_LENGTH = 100_000;

export type PracticeDraft = {
  readonly draftId: DraftId;
  readonly attemptId: LearningAttempt["attemptId"];
  readonly learnerId: LearnerId;
  readonly problemVersionId: LearningAttempt["problemVersionId"];
  readonly manifestId: LanguageManifestId;
  readonly language: LearningAttempt["language"];
  readonly kind: DraftKind;
  /** Replaceable debounced current snapshot; this is not a keystroke log. */
  readonly currentText: string;
  readonly currentRevision: number;
  /** Revision number last explicitly saved by the learner. */
  readonly savedRevision: number;
  /** Optimistic concurrency token for current and saved writes. */
  readonly version: number;
  readonly updatedAt: Instant;
  readonly expiresAt: Instant;
  readonly localRecoveryEnabled: boolean;
};

export type SavedDraftRevision = {
  readonly draftId: DraftId;
  readonly attemptId: LearningAttempt["attemptId"];
  readonly learnerId: LearnerId;
  readonly kind: DraftKind;
  readonly revision: number;
  readonly text: string;
  readonly savedAt: Instant;
  readonly expiresAt: Instant;
};

export type DraftFailureCode =
  "invalid_kind" | "invalid_text" | "invalid_version" | "invalid_ttl" | "no_changes" | "expired";

export type DraftFailure = {
  readonly code: DraftFailureCode;
  readonly message: string;
};

export type DraftTransition = {
  readonly draft: PracticeDraft;
  readonly revision?: SavedDraftRevision;
};

function validVersion(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function maxLength(kind: DraftKind): number {
  return kind === "source" ? SOURCE_DRAFT_MAX_LENGTH : PSEUDOCODE_DRAFT_MAX_LENGTH;
}

function validateText(kind: DraftKind, text: string): Result<undefined, DraftFailure> {
  if (!DRAFT_KINDS.includes(kind)) {
    return err({ code: "invalid_kind", message: "Draft kind is not supported." });
  }
  if (typeof text !== "string" || text.length > maxLength(kind)) {
    return err({
      code: "invalid_text",
      message: "Draft text exceeds the bounded private snapshot limit.",
    });
  }
  return ok(undefined);
}

function validateTtl(now: Instant, expiresAt: Instant): Result<undefined, DraftFailure> {
  const ttl = Date.parse(expiresAt) - Date.parse(now);
  if (!Number.isSafeInteger(ttl) || ttl <= 0 || ttl > DRAFT_TTL_MS) {
    return err({
      code: "invalid_ttl",
      message: "Draft expiry must be within the recovery window.",
    });
  }
  return ok(undefined);
}

export function draftExpiry(now: Instant): Result<Instant, DraftFailure> {
  const duration = durationFromMs(DRAFT_TTL_MS);
  if (!duration.ok) return err({ code: "invalid_ttl", message: duration.error.message });
  const expiry = addDurationToInstant(now, duration.value);
  return expiry.ok
    ? expiry
    : err({ code: "invalid_ttl", message: "Draft expiry exceeds the supported instant range." });
}

export function startPracticeDraft(input: {
  readonly draftId: DraftId;
  readonly attempt: LearningAttempt;
  readonly kind: DraftKind;
  readonly startedAt: Instant;
  readonly expiresAt: Instant;
  readonly localRecoveryEnabled?: boolean;
}): Result<PracticeDraft, DraftFailure> {
  const text = validateText(input.kind, "");
  if (!text.ok) return text;
  const ttl = validateTtl(input.startedAt, input.expiresAt);
  if (!ttl.ok) return ttl;
  return ok({
    draftId: input.draftId,
    attemptId: input.attempt.attemptId,
    learnerId: input.attempt.learnerId,
    problemVersionId: input.attempt.problemVersionId,
    manifestId: input.attempt.manifestId,
    language: input.attempt.language,
    kind: input.kind,
    currentText: "",
    currentRevision: 0,
    savedRevision: 0,
    version: 1,
    updatedAt: input.startedAt,
    expiresAt: input.expiresAt,
    localRecoveryEnabled: input.localRecoveryEnabled ?? false,
  });
}

export function replaceDraftCurrent(
  draft: PracticeDraft,
  input: { readonly text: string; readonly updatedAt: Instant },
): Result<DraftTransition, DraftFailure> {
  if (
    !validVersion(draft.version) ||
    !Number.isSafeInteger(draft.currentRevision) ||
    draft.currentRevision < 0
  ) {
    return err({
      code: "invalid_version",
      message: "Draft version must be a safe positive integer.",
    });
  }
  if (
    Date.parse(input.updatedAt) >= Date.parse(draft.expiresAt) ||
    Date.parse(input.updatedAt) < Date.parse(draft.updatedAt)
  ) {
    return err({ code: "expired", message: "Draft recovery window has expired." });
  }
  const text = validateText(draft.kind, input.text);
  if (!text.ok) return text;
  if (input.text === draft.currentText)
    return err({ code: "no_changes", message: "Draft has no new content." });
  return ok({
    draft: {
      ...draft,
      currentText: input.text,
      currentRevision: draft.currentRevision + 1,
      version: draft.version + 1,
      updatedAt: input.updatedAt,
    },
  });
}

export function saveDraftRevision(
  draft: PracticeDraft,
  input: { readonly savedAt: Instant },
): Result<DraftTransition, DraftFailure> {
  if (
    !validVersion(draft.version) ||
    !Number.isSafeInteger(draft.currentRevision) ||
    draft.currentRevision < 0 ||
    !Number.isSafeInteger(draft.savedRevision) ||
    draft.savedRevision < 0
  ) {
    return err({ code: "invalid_version", message: "Draft revision state is invalid." });
  }
  if (
    Date.parse(input.savedAt) >= Date.parse(draft.expiresAt) ||
    Date.parse(input.savedAt) < Date.parse(draft.updatedAt)
  ) {
    return err({ code: "expired", message: "Draft recovery window has expired." });
  }
  if (draft.currentRevision <= draft.savedRevision) {
    return err({ code: "no_changes", message: "There is no unsaved draft revision." });
  }
  const revision: SavedDraftRevision = {
    draftId: draft.draftId,
    attemptId: draft.attemptId,
    learnerId: draft.learnerId,
    kind: draft.kind,
    revision: draft.currentRevision,
    text: draft.currentText,
    savedAt: input.savedAt,
    expiresAt: draft.expiresAt,
  };
  return ok({
    draft: {
      ...draft,
      savedRevision: draft.currentRevision,
      version: draft.version + 1,
      updatedAt: input.savedAt,
    },
    revision,
  });
}
