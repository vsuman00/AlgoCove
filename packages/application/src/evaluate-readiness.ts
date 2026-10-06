import {
  evaluateExternalReadiness,
  type ExternalReadinessDecision,
  type ExternalReadinessEvidence,
  type ExternalReadinessRubric,
  type LearningAttempt,
  type ReadinessBinding,
} from "@algocove/domain";
import { notFoundError } from "./errors.ts";
import type { RequestContext } from "./request-context.ts";

export type ExternalReadinessSnapshot = {
  readonly binding: ReadinessBinding;
  readonly mode: LearningAttempt["mode"];
  readonly contentAvailable: boolean;
  readonly rubric: ExternalReadinessRubric | null;
  readonly highestAssistanceTier: number | null;
  readonly evidence: readonly ExternalReadinessEvidence[];
};

export type ExternalReadinessRepository = {
  /** Read committed current artifacts, policy, availability and facts in one consistent snapshot. */
  loadOwnedReadiness(
    attemptId: LearningAttempt["attemptId"],
    learnerId: ReadinessBinding["learnerId"],
  ): Promise<ExternalReadinessSnapshot | null>;
};

/** Read-only permission decision: does not award mastery or record external completion. */
export async function evaluateOwnedExternalReadiness(
  context: RequestContext,
  repository: ExternalReadinessRepository,
  input: { readonly attemptId: LearningAttempt["attemptId"]; readonly bypassRequested?: boolean },
): Promise<ExternalReadinessDecision> {
  const snapshot = await repository.loadOwnedReadiness(input.attemptId, context.actor.userId);
  if (
    snapshot === null ||
    snapshot.binding.learnerId !== context.actor.userId ||
    snapshot.binding.attemptId !== input.attemptId
  ) {
    throw notFoundError("Learning attempt is not available.");
  }
  return evaluateExternalReadiness({
    ...snapshot,
    bypassRequested: input.bypassRequested ?? false,
  });
}
