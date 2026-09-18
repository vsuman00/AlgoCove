import {
  evaluatePseudocodeReadiness,
  replacePseudocodeCurrent,
  savePseudocodeRevision,
  startPseudocodeArtifact as createPseudocodeArtifact,
  type AuthoredPseudocodeRubric,
  type PseudocodeArtifact,
  type PseudocodeId,
  type PseudocodeReadiness,
  type PseudocodeRevision,
  type StructuredPseudocodeCheck,
  type VerifiedRunEvidence,
} from "@algocove/domain";
import { conflictError, notFoundError, validationError } from "./errors.ts";
import type { LearningAttempt } from "@algocove/domain";
import type { RequestContext } from "./request-context.ts";

export type PseudocodeRepository = {
  getAttempt(
    attemptId: LearningAttempt["attemptId"],
    learnerId: LearningAttempt["learnerId"],
  ): Promise<LearningAttempt | null>;
  createPseudocode(artifact: PseudocodeArtifact): Promise<PseudocodeArtifact>;
  getPseudocode(
    pseudocodeId: PseudocodeId,
    learnerId: LearningAttempt["learnerId"],
  ): Promise<PseudocodeArtifact | null>;
  replaceCurrentPseudocode(input: {
    readonly artifact: PseudocodeArtifact;
    readonly expectedVersion: number;
  }): Promise<PseudocodeArtifact | null>;
  savePseudocodeRevision(input: {
    readonly artifact: PseudocodeArtifact;
    readonly revision: PseudocodeRevision;
    readonly expectedVersion: number;
  }): Promise<PseudocodeArtifact | null>;
  listPseudocodeRevisions(
    pseudocodeId: PseudocodeId,
    learnerId: LearningAttempt["learnerId"],
  ): Promise<readonly PseudocodeRevision[]>;
  deleteLearnerPseudocode(learnerId: LearningAttempt["learnerId"]): Promise<void>;
};

export type PseudocodeSaveResult = {
  readonly artifact: PseudocodeArtifact;
  readonly state: "saved_current" | "saved_revision";
};

export async function startOwnedPseudocode(
  context: RequestContext,
  repository: PseudocodeRepository,
  input: {
    readonly pseudocodeId: PseudocodeId;
    readonly attemptId: LearningAttempt["attemptId"];
  },
): Promise<PseudocodeArtifact> {
  const attempt = await ownedAttempt(context, repository, input.attemptId);
  if (attempt.status !== "active") {
    throw validationError("Pseudocode can only be attached to an active attempt.", {
      field: "invalid_state",
    });
  }
  const artifact = createPseudocodeArtifact({
    pseudocodeId: input.pseudocodeId,
    attempt,
    startedAt: context.now,
  });
  if (!artifact.ok) throw validationError(artifact.error.message, { field: artifact.error.code });
  return repository.createPseudocode(artifact.value);
}

export async function replaceOwnedPseudocodeCurrent(
  context: RequestContext,
  repository: PseudocodeRepository,
  input: {
    readonly pseudocodeId: PseudocodeId;
    readonly expectedVersion: number;
    readonly fields: PseudocodeArtifact["current"];
  },
): Promise<PseudocodeSaveResult> {
  const current = await ownedPseudocode(context, repository, input.pseudocodeId);
  const transition = replacePseudocodeCurrent(current, {
    fields: input.fields,
    updatedAt: context.now,
  });
  if (!transition.ok)
    throw validationError(transition.error.message, { field: transition.error.code });
  const saved = await repository.replaceCurrentPseudocode({
    artifact: transition.value.artifact,
    expectedVersion: input.expectedVersion,
  });
  if (saved === null) throwVersionConflict(input.expectedVersion);
  return { artifact: saved, state: "saved_current" };
}

export async function saveOwnedPseudocodeRevision(
  context: RequestContext,
  repository: PseudocodeRepository,
  input: { readonly pseudocodeId: PseudocodeId; readonly expectedVersion: number },
): Promise<PseudocodeSaveResult> {
  const current = await ownedPseudocode(context, repository, input.pseudocodeId);
  const transition = savePseudocodeRevision(current, { savedAt: context.now });
  if (!transition.ok)
    throw validationError(transition.error.message, { field: transition.error.code });
  if (transition.value.revision === undefined) {
    throw validationError("Pseudocode save did not produce a revision.", {
      field: "invalid_revision",
    });
  }
  const saved = await repository.savePseudocodeRevision({
    artifact: transition.value.artifact,
    revision: transition.value.revision,
    expectedVersion: input.expectedVersion,
  });
  if (saved === null) throwVersionConflict(input.expectedVersion);
  return { artifact: saved, state: "saved_revision" };
}

export async function getOwnedPseudocode(
  context: RequestContext,
  repository: PseudocodeRepository,
  pseudocodeId: PseudocodeId,
): Promise<PseudocodeArtifact> {
  return ownedPseudocode(context, repository, pseudocodeId);
}

export async function getOwnedPseudocodeHistory(
  context: RequestContext,
  repository: PseudocodeRepository,
  pseudocodeId: PseudocodeId,
): Promise<readonly PseudocodeRevision[]> {
  await ownedPseudocode(context, repository, pseudocodeId);
  return repository.listPseudocodeRevisions(pseudocodeId, context.actor.userId);
}

export async function evaluateOwnedPseudocode(
  context: RequestContext,
  repository: PseudocodeRepository,
  input: {
    readonly pseudocodeId: PseudocodeId;
    readonly revision: number;
    readonly rubric: AuthoredPseudocodeRubric;
    readonly structuredChecks: readonly StructuredPseudocodeCheck[];
    readonly verifiedRuns: readonly VerifiedRunEvidence[];
  },
): Promise<PseudocodeReadiness> {
  const artifact = await ownedPseudocode(context, repository, input.pseudocodeId);
  const revisions = await repository.listPseudocodeRevisions(
    input.pseudocodeId,
    context.actor.userId,
  );
  const revision = revisions.find((item) => item.revision === input.revision);
  if (revision === undefined) throw notFoundError("Pseudocode revision is not available.");
  return evaluatePseudocodeReadiness({
    artifact,
    revision,
    rubric: input.rubric,
    structuredChecks: input.structuredChecks,
    verifiedRuns: input.verifiedRuns,
  });
}

export function clearOwnedPseudocode(
  context: RequestContext,
  repository: PseudocodeRepository,
): Promise<void> {
  return repository.deleteLearnerPseudocode(context.actor.userId);
}

async function ownedAttempt(
  context: RequestContext,
  repository: PseudocodeRepository,
  attemptId: LearningAttempt["attemptId"],
): Promise<LearningAttempt> {
  const attempt = await repository.getAttempt(attemptId, context.actor.userId);
  if (attempt === null) throw notFoundError("Learning attempt is not available.");
  return attempt;
}

async function ownedPseudocode(
  context: RequestContext,
  repository: PseudocodeRepository,
  pseudocodeId: PseudocodeId,
): Promise<PseudocodeArtifact> {
  const artifact = await repository.getPseudocode(pseudocodeId, context.actor.userId);
  if (artifact === null) throw notFoundError("Pseudocode is not available.");
  return artifact;
}

function throwVersionConflict(expectedVersion: number): never {
  throw conflictError("Pseudocode changed in another tab or session.", { expectedVersion });
}
