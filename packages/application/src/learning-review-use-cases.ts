import { consumePracticeAssessment, type MasteryIngestionPorts } from "./mastery-projection.ts";
import type { RequestContext } from "./request-context.ts";
import { validationError } from "./errors.ts";
import type {
  Instant,
  LearnerId,
  MasteryEvidence,
  OpaqueId,
  PseudocodeId,
  ReviewItem,
  ReviewQuestion,
} from "@algocove/domain";
export type ReviewExercise = {
  readonly exerciseId: string;
  readonly title: string;
  readonly kind: "recall" | "transfer";
  readonly questions: readonly ReviewQuestion[];
  readonly rubricVersion: number;
};
export type ReviewQueueItem = ReviewItem & {
  readonly timing: "upcoming" | "due" | "overdue" | "inactive";
  readonly exercise: ReviewExercise | null;
  readonly timezone: string;
};
export type LearningObservationReceipt = {
  readonly observationId: OpaqueId<"event">;
  readonly sourceEventId: OpaqueId<"event">;
  readonly correct: boolean;
  readonly disposition: "committed" | "replayed";
};
export type LearningReviewRepository = {
  observeExplanation(input: {
    learnerId: LearnerId;
    pseudocodeId: PseudocodeId;
    revision: number;
    confidence: MasteryEvidence["confidence"];
    now: Instant;
    observationId: OpaqueId<"event">;
    eventId: OpaqueId<"event">;
  }): Promise<LearningObservationReceipt>;
  listReviews(input: { learnerId: LearnerId; now: Instant }): Promise<readonly ReviewQueueItem[]>;
  answerReview(input: {
    learnerId: LearnerId;
    reviewId: OpaqueId<"event">;
    exerciseId: string;
    answers: Readonly<Record<string, string>>;
    confidence: MasteryEvidence["confidence"];
    now: Instant;
    observationId: OpaqueId<"event">;
    eventId: OpaqueId<"event">;
  }): Promise<LearningObservationReceipt>;
  deferReview(input: {
    learnerId: LearnerId;
    reviewId: OpaqueId<"event">;
    until: Instant;
    now: Instant;
    eventId: OpaqueId<"event">;
  }): Promise<void>;
};
function confidence(value: unknown): MasteryEvidence["confidence"] {
  if (value !== null && !["low", "medium", "high"].includes(String(value)))
    throw validationError("Confidence must be low, medium, high, or null.");
  return value as MasteryEvidence["confidence"];
}
async function deliver(
  context: RequestContext,
  ports: MasteryIngestionPorts,
  receipt: LearningObservationReceipt,
): Promise<LearningObservationReceipt & { status: "ready" | "projection_pending" }> {
  try {
    await consumePracticeAssessment(
      { now: context.now, ids: context.ids },
      ports,
      receipt.sourceEventId,
    );
    return { ...receipt, status: "ready" };
  } catch {
    return { ...receipt, status: "projection_pending" };
  }
}
export async function observeOwnedExplanation(
  context: RequestContext,
  repository: LearningReviewRepository,
  ports: MasteryIngestionPorts,
  input: { pseudocodeId: PseudocodeId; revision: number; confidence: unknown },
): Promise<LearningObservationReceipt & { status: "ready" | "projection_pending" }> {
  if (!Number.isSafeInteger(input.revision) || input.revision < 1)
    throw validationError("A saved revision is required.");
  const receipt = await repository.observeExplanation({
    ...input,
    confidence: confidence(input.confidence),
    learnerId: context.actor.userId,
    now: context.now,
    observationId: context.ids.generate("event"),
    eventId: context.ids.generate("event"),
  });
  return deliver(context, ports, receipt);
}
export async function answerOwnedReview(
  context: RequestContext,
  repository: LearningReviewRepository,
  ports: MasteryIngestionPorts,
  input: {
    reviewId: OpaqueId<"event">;
    exerciseId: string;
    answers: Readonly<Record<string, string>>;
    confidence: unknown;
  },
): Promise<LearningObservationReceipt & { status: "ready" | "projection_pending" }> {
  if (
    !/^[a-z0-9._-]{1,128}$/.test(input.exerciseId) ||
    Object.keys(input.answers).length > 8 ||
    Object.values(input.answers).some((a) => typeof a !== "string" || a.length > 128)
  )
    throw validationError("Invalid review answers.");
  const receipt = await repository.answerReview({
    ...input,
    confidence: confidence(input.confidence),
    learnerId: context.actor.userId,
    now: context.now,
    observationId: context.ids.generate("event"),
    eventId: context.ids.generate("event"),
  });
  return deliver(context, ports, receipt);
}
export async function deferOwnedReview(
  context: RequestContext,
  repository: LearningReviewRepository,
  input: { reviewId: OpaqueId<"event">; until: Instant },
): Promise<void> {
  const delay = Date.parse(input.until) - Date.parse(context.now);
  if (delay < 3600000 || delay > 30 * 86400000)
    throw validationError("Defer from one hour to thirty days into the future.");
  await repository.deferReview({
    ...input,
    learnerId: context.actor.userId,
    now: context.now,
    eventId: context.ids.generate("event"),
  });
}
export async function listOwnedReviews(
  context: RequestContext,
  repository: LearningReviewRepository,
): Promise<readonly ReviewQueueItem[]> {
  return repository.listReviews({ learnerId: context.actor.userId, now: context.now });
}
