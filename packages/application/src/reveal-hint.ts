import {
  createHintExposure,
  decideHintReveal,
  validateAuthoredHint,
  type AuthoredHint,
  type HintExposure,
  type HintTier,
  type LearningAttempt,
  type ProblemVersionId,
} from "@algocove/domain";
import { conflictError, notFoundError, validationError } from "./errors.ts";
import type { RequestContext } from "./request-context.ts";

export type HintRepository = {
  getAttempt(
    attemptId: LearningAttempt["attemptId"],
    learnerId: LearningAttempt["learnerId"],
  ): Promise<LearningAttempt | null>;
  getAuthoredHint(input: {
    readonly problemVersionId: ProblemVersionId;
    readonly hintId: string;
  }): Promise<AuthoredHint | null>;
  getExposureByIdempotency(input: {
    readonly learnerId: LearningAttempt["learnerId"];
    readonly idempotencyKey: string;
  }): Promise<HintExposure | null>;
  getHighestExposedTier(input: {
    readonly learnerId: LearningAttempt["learnerId"];
    readonly problemVersionId: ProblemVersionId;
  }): Promise<number>;
  saveExposure(exposure: HintExposure): Promise<HintExposure | null>;
};

export type HintRevealReceipt = {
  readonly disposition: "committed" | "replayed";
  readonly exposure: HintExposure;
  /** Returned only after the exposure persistence boundary succeeds. */
  readonly hint: AuthoredHint;
};

export async function revealAuthoredHint(
  context: RequestContext,
  repository: HintRepository,
  input: {
    readonly attemptId: LearningAttempt["attemptId"];
    readonly hintId: string;
    readonly requestedTier: number;
    readonly idempotencyKey: string;
  },
): Promise<HintRevealReceipt> {
  const attempt = await repository.getAttempt(input.attemptId, context.actor.userId);
  if (attempt === null) throw notFoundError("Learning attempt is not available.");
  const hint = await repository.getAuthoredHint({
    problemVersionId: attempt.problemVersionId,
    hintId: input.hintId,
  });
  if (hint === null) throw notFoundError("Authored hint is not available.");
  const validHint = validateAuthoredHint(hint);
  if (!validHint.ok)
    throw validationError(validHint.error.message, { field: validHint.error.code });
  if (hint.tier !== input.requestedTier) {
    throw validationError("Requested hint tier does not match the authored hint.", {
      field: "tier_mismatch",
    });
  }

  const existing = await repository.getExposureByIdempotency({
    learnerId: context.actor.userId,
    idempotencyKey: input.idempotencyKey,
  });
  if (existing !== null) {
    if (existing.hintId !== hint.hintId || existing.problemVersionId !== hint.problemVersionId) {
      throw conflictError("Hint idempotency key was already used for another hint.");
    }
    return { disposition: "replayed", exposure: existing, hint };
  }

  const highest = await repository.getHighestExposedTier({
    learnerId: context.actor.userId,
    problemVersionId: attempt.problemVersionId,
  });
  const decision = decideHintReveal({
    mode: attempt.mode,
    requestedTier: input.requestedTier,
    highestExposedTier: highest,
    solutionReviewApproved: attempt.status === "submitted",
  });
  if (!decision.ok) throw validationError(decision.error.message, { field: decision.error.code });
  const exposure = createHintExposure({
    exposureId: context.ids.generate("event"),
    learnerId: context.actor.userId,
    attemptId: attempt.attemptId,
    problemVersionId: attempt.problemVersionId,
    hintId: hint.hintId,
    tier: decision.value.tier as HintTier,
    idempotencyKey: input.idempotencyKey,
    exposedAt: context.now,
  });
  if (!exposure.ok) throw validationError(exposure.error.message, { field: exposure.error.code });
  const saved = await repository.saveExposure(exposure.value);
  if (saved === null) {
    const raced = await repository.getExposureByIdempotency({
      learnerId: context.actor.userId,
      idempotencyKey: input.idempotencyKey,
    });
    if (raced !== null && raced.hintId === hint.hintId) {
      return { disposition: "replayed", exposure: raced, hint };
    }
    throw conflictError("Hint reveal raced with another request.");
  }
  return { disposition: "committed", exposure: saved, hint };
}
