import {
  draftExpiry,
  replaceDraftCurrent,
  saveDraftRevision,
  startPracticeDraft as createPracticeDraft,
  type DraftId,
  type DraftKind,
  type LearningAttempt,
  type PracticeDraft,
  type SavedDraftRevision,
} from "@algocove/domain";
import { conflictError, notFoundError, validationError } from "./errors.ts";
import type { RequestContext } from "./request-context.ts";

export type DraftSaveState = "saved_current" | "saved_revision";

export type DraftRepository = {
  getAttempt(
    attemptId: LearningAttempt["attemptId"],
    learnerId: LearningAttempt["learnerId"],
  ): Promise<LearningAttempt | null>;
  createDraft(draft: PracticeDraft): Promise<PracticeDraft>;
  getDraft(
    draftId: DraftId,
    learnerId: LearningAttempt["learnerId"],
  ): Promise<PracticeDraft | null>;
  replaceCurrentDraft(input: {
    readonly draft: PracticeDraft;
    readonly expectedVersion: number;
  }): Promise<PracticeDraft | null>;
  saveDraftRevision(input: {
    readonly draft: PracticeDraft;
    readonly revision: SavedDraftRevision;
    readonly expectedVersion: number;
  }): Promise<PracticeDraft | null>;
  listDraftRevisions(
    draftId: DraftId,
    learnerId: LearningAttempt["learnerId"],
  ): Promise<readonly SavedDraftRevision[]>;
  deleteLearnerDrafts(learnerId: LearningAttempt["learnerId"]): Promise<void>;
};

export type DraftSaveResult = {
  readonly draft: PracticeDraft;
  readonly state: DraftSaveState;
};

export async function startPracticeDraft(
  context: RequestContext,
  repository: DraftRepository,
  input: {
    readonly draftId: DraftId;
    readonly attemptId: LearningAttempt["attemptId"];
    readonly kind: DraftKind;
    readonly localRecoveryEnabled?: boolean;
  },
): Promise<PracticeDraft> {
  const attempt = await ownedAttempt(context, repository, input.attemptId);
  if (attempt.status !== "active") {
    throw validationError("Drafts can only be attached to an active attempt.", {
      field: "invalid_state",
    });
  }
  const expiresAt = draftExpiry(context.now);
  if (!expiresAt.ok)
    throw validationError(expiresAt.error.message, { field: expiresAt.error.code });
  const draft = createPracticeDraft({
    draftId: input.draftId,
    attempt,
    kind: input.kind,
    startedAt: context.now,
    expiresAt: expiresAt.value,
    ...(input.localRecoveryEnabled === undefined
      ? {}
      : { localRecoveryEnabled: input.localRecoveryEnabled }),
  });
  if (!draft.ok) throw validationError(draft.error.message, { field: draft.error.code });
  return repository.createDraft(draft.value);
}

export async function replacePracticeDraftCurrent(
  context: RequestContext,
  repository: DraftRepository,
  input: {
    readonly draftId: DraftId;
    readonly expectedVersion: number;
    readonly text: string;
  },
): Promise<DraftSaveResult> {
  const current = await ownedDraft(context, repository, input.draftId);
  const transition = replaceDraftCurrent(current, { text: input.text, updatedAt: context.now });
  if (!transition.ok)
    throw validationError(transition.error.message, { field: transition.error.code });
  const saved = await repository.replaceCurrentDraft({
    draft: transition.value.draft,
    expectedVersion: input.expectedVersion,
  });
  if (saved === null) throwDraftConflict(input.expectedVersion);
  return { draft: saved, state: "saved_current" };
}

export async function savePracticeDraftRevision(
  context: RequestContext,
  repository: DraftRepository,
  input: {
    readonly draftId: DraftId;
    readonly expectedVersion: number;
  },
): Promise<DraftSaveResult> {
  const current = await ownedDraft(context, repository, input.draftId);
  const transition = saveDraftRevision(current, { savedAt: context.now });
  if (!transition.ok)
    throw validationError(transition.error.message, { field: transition.error.code });
  if (transition.value.revision === undefined) {
    throw validationError("Draft save did not produce a revision.", { field: "invalid_revision" });
  }
  const saved = await repository.saveDraftRevision({
    draft: transition.value.draft,
    revision: transition.value.revision,
    expectedVersion: input.expectedVersion,
  });
  if (saved === null) throwDraftConflict(input.expectedVersion);
  return { draft: saved, state: "saved_revision" };
}

export async function getOwnedPracticeDraft(
  context: RequestContext,
  repository: DraftRepository,
  draftId: DraftId,
): Promise<PracticeDraft> {
  return ownedDraft(context, repository, draftId);
}

export async function getOwnedPracticeDraftHistory(
  context: RequestContext,
  repository: DraftRepository,
  draftId: DraftId,
): Promise<readonly SavedDraftRevision[]> {
  await ownedDraft(context, repository, draftId);
  return repository.listDraftRevisions(draftId, context.actor.userId);
}

/** Account deletion and explicit recovery clearing share the same owner scope. */
export function clearOwnedPracticeDrafts(
  context: RequestContext,
  repository: DraftRepository,
): Promise<void> {
  return repository.deleteLearnerDrafts(context.actor.userId);
}

async function ownedAttempt(
  context: RequestContext,
  repository: DraftRepository,
  attemptId: LearningAttempt["attemptId"],
): Promise<LearningAttempt> {
  const attempt = await repository.getAttempt(attemptId, context.actor.userId);
  if (attempt === null) throw notFoundError("Learning attempt is not available.");
  return attempt;
}

async function ownedDraft(
  context: RequestContext,
  repository: DraftRepository,
  draftId: DraftId,
): Promise<PracticeDraft> {
  const draft = await repository.getDraft(draftId, context.actor.userId);
  if (draft === null) throw notFoundError("Draft is not available.");
  if (Date.parse(context.now) >= Date.parse(draft.expiresAt)) {
    throw validationError("Draft recovery window has expired.", { field: "expired" });
  }
  return draft;
}

function throwDraftConflict(expectedVersion: number): never {
  throw conflictError("Draft changed in another tab or session.", { expectedVersion });
}
