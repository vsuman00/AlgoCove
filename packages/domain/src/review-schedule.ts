import type { Instant, ConceptId, LearnerId, OpaqueId, ProblemVersionId } from "./index.ts";

export const REVIEW_POLICY_V1 = {
  version: 1,
  practiceDays: 1,
  independentDays: 3,
  transferDays: 7,
  windowDays: 1,
} as const;
export type ReviewItem = {
  readonly reviewId: OpaqueId<"event">;
  readonly learnerId: LearnerId;
  readonly conceptId: ConceptId;
  readonly originObservationId: OpaqueId<"event">;
  readonly originProblemVersionId: ProblemVersionId;
  readonly evidenceWatermark: string;
  readonly policyVersion: number;
  readonly dueStart: Instant;
  readonly dueEnd: Instant;
  readonly status: "due" | "deferred" | "awaiting_projection" | "completed" | "superseded";
  readonly completedObservationId: OpaqueId<"event"> | null;
};

/** Elapsed UTC days are stable across presentation timezone and DST changes. */
export function reviewWindow(
  observedAt: Instant,
  band: string,
): { dueStart: Instant; dueEnd: Instant; policyVersion: number } {
  const time = Date.parse(observedAt);
  if (!Number.isFinite(time)) throw new Error("Invalid review origin time.");
  const days =
    band === "independent_delayed_transfer"
      ? REVIEW_POLICY_V1.transferDays
      : band === "independent_completion"
        ? REVIEW_POLICY_V1.independentDays
        : REVIEW_POLICY_V1.practiceDays;
  return {
    dueStart: new Date(time + days * 86400000).toISOString() as Instant,
    dueEnd: new Date(
      time + (days + REVIEW_POLICY_V1.windowDays) * 86400000,
    ).toISOString() as Instant,
    policyVersion: REVIEW_POLICY_V1.version,
  };
}

export function reviewTiming(
  item: Pick<ReviewItem, "dueStart" | "dueEnd" | "status">,
  now: Instant,
): "upcoming" | "due" | "overdue" | "inactive" {
  if (!["due", "deferred", "awaiting_projection"].includes(item.status)) return "inactive";
  if (Date.parse(now) < Date.parse(item.dueStart)) return "upcoming";
  return Date.parse(now) > Date.parse(item.dueEnd) ? "overdue" : "due";
}
