import { err, ok, type Instant, type LearnerId, type OpaqueId, type Result } from "./primitives.ts";
import type { ProblemVersionId } from "./language-manifest.ts";
import type { LearningAttempt, LearningMode } from "./practice.ts";

export const HINT_LADDER = [
  { tier: 1, name: "clarification" },
  { tier: 2, name: "example" },
  { tier: 3, name: "invariant" },
  { tier: 4, name: "pseudocode_scaffold" },
  { tier: 5, name: "partial_structure" },
  { tier: 6, name: "solution_review" },
] as const;
export type HintTier = (typeof HINT_LADDER)[number]["tier"];
export type HintKind = (typeof HINT_LADDER)[number]["name"];
export type HintExposureId = OpaqueId<"event">;

export const HINT_CEILINGS: Readonly<Record<LearningMode, HintTier>> = {
  learn: 5,
  practice: 6,
  rescue: 6,
};

export type AuthoredHint = {
  readonly hintId: string;
  readonly problemVersionId: ProblemVersionId;
  readonly tier: HintTier;
  readonly kind: HintKind;
  readonly body: string;
};

export type HintExposure = {
  readonly exposureId: HintExposureId;
  readonly learnerId: LearnerId;
  readonly attemptId: LearningAttempt["attemptId"];
  readonly problemVersionId: ProblemVersionId;
  readonly hintId: string;
  readonly tier: HintTier;
  readonly idempotencyKey: string;
  readonly exposedAt: Instant;
};

export type HintFailureCode =
  | "invalid_hint"
  | "invalid_tier"
  | "ceiling_exceeded"
  | "solution_gate_required"
  | "invalid_idempotency_key";

export type HintFailure = { readonly code: HintFailureCode; readonly message: string };

export type HintDecision = {
  readonly tier: HintTier;
  readonly newExposure: boolean;
};

export function validateAuthoredHint(hint: AuthoredHint): Result<undefined, HintFailure> {
  const ladder = HINT_LADDER.find((entry) => entry.tier === hint.tier);
  if (
    ladder === undefined ||
    hint.kind !== ladder.name ||
    hint.hintId.length === 0 ||
    hint.hintId.length > 128 ||
    hint.body.trim().length === 0 ||
    hint.body.length > 20_000
  ) {
    return err({
      code: "invalid_hint",
      message: "Authored hint does not match the hint contract.",
    });
  }
  return ok(undefined);
}

export function decideHintReveal(input: {
  readonly mode: LearningMode;
  readonly requestedTier: number;
  readonly highestExposedTier: number;
  readonly solutionReviewApproved: boolean;
}): Result<HintDecision, HintFailure> {
  if (!isHintTier(input.requestedTier)) {
    return err({ code: "invalid_tier", message: "Requested hint tier is not supported." });
  }
  if (input.requestedTier > HINT_CEILINGS[input.mode]) {
    return err({
      code: "ceiling_exceeded",
      message: "Requested hint tier exceeds this mode's ceiling.",
    });
  }
  if (input.requestedTier === 6 && !input.solutionReviewApproved) {
    return err({
      code: "solution_gate_required",
      message: "Solution review requires an approved attempt gate.",
    });
  }
  return ok({
    tier: input.requestedTier,
    newExposure: input.requestedTier > input.highestExposedTier,
  });
}

export function createHintExposure(input: {
  readonly exposureId: HintExposureId;
  readonly learnerId: LearnerId;
  readonly attemptId: LearningAttempt["attemptId"];
  readonly problemVersionId: ProblemVersionId;
  readonly hintId: string;
  readonly tier: HintTier;
  readonly idempotencyKey: string;
  readonly exposedAt: Instant;
}): Result<HintExposure, HintFailure> {
  if (!isHintTier(input.tier)) {
    return err({ code: "invalid_tier", message: "Hint exposure tier is not supported." });
  }
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(input.idempotencyKey)) {
    return err({ code: "invalid_idempotency_key", message: "Hint idempotency key is invalid." });
  }
  return ok({ ...input });
}

function isHintTier(value: number): value is HintTier {
  return HINT_LADDER.some((entry) => entry.tier === value);
}
