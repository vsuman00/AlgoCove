import {
  projectConsistency,
  recommendNext,
  type Instant,
  type ConceptId,
  type LearnerId,
  type OpaqueId,
  type RecommendationCandidate,
  type StudyActivity,
  type StudyPause,
  type ProblemLanguage,
  type MasteryProjection,
  type NextAction,
} from "@algocove/domain";
import type { RequestContext } from "./request-context.ts";
import { validationError } from "./errors.ts";
export type ProgressSnapshot = {
  readonly asOf: Instant;
  readonly policyVersion: 1;
  readonly timezone: string;
  readonly pendingConcepts: readonly ConceptId[];
  readonly mastery: readonly {
    title: string;
    projection: MasteryProjection;
    status: "ready" | "projection_pending";
  }[];
  readonly calibration: readonly {
    confidence: "low" | "medium" | "high";
    correct: boolean;
    observedAt: Instant;
    provenance: "learner_reported";
  }[];
  readonly activities: readonly StudyActivity[];
  readonly pauses: readonly StudyPause[];
  readonly completedSessions: number;
  readonly externalPractice: {
    readonly provenance: "learner_reported";
    readonly requested: number;
    readonly completed: number;
    readonly references: readonly {
      referenceId: OpaqueId<"externalReference">;
      title: string;
      url: string;
    }[];
  };
  readonly planAdherence: {
    readonly status: "no_accepted_plan" | "accepted_plan";
    readonly completedOnTime: number | null;
    readonly totalDue: number | null;
  };
  readonly reviewHealth: {
    readonly due: number;
    readonly overdue: number;
    readonly deferred: number;
    readonly completed: number;
    readonly pending: number;
  };
};
export type LearnerHomeSource = {
  readonly goal: string | null;
  readonly preferredLanguages: readonly ProblemLanguage[];
  readonly candidates: readonly RecommendationCandidate[];
  readonly dueReview: boolean;
  readonly verifiedConcepts?: readonly ConceptId[];
  readonly plannedAction?: NextAction;
  readonly hasAcceptedPlan?: boolean;
};
export type LearningProgressRepository = {
  getProgress(input: { learnerId: LearnerId; now: Instant }): Promise<ProgressSnapshot>;
  getHome(input: { learnerId: LearnerId; now: Instant }): Promise<LearnerHomeSource>;
  pauseStudy(input: {
    learnerId: LearnerId;
    now: Instant;
    startDay: string;
    endDay: string;
    timezone: string;
    eventId: OpaqueId<"event">;
  }): Promise<void>;
  recordExternal(input: {
    learnerId: LearnerId;
    now: Instant;
    referenceId: OpaqueId<"externalReference">;
    kind: "handoff_requested" | "completed" | "corrected";
    idempotencyKey: string;
    eventId: OpaqueId<"event">;
  }): Promise<void>;
};
export async function getOwnedProgress(
  context: RequestContext,
  repository: LearningProgressRepository,
): Promise<ProgressSnapshot & { consistency: ReturnType<typeof projectConsistency> }> {
  const source = await repository.getProgress({
    learnerId: context.actor.userId,
    now: context.now,
  });
  return {
    ...source,
    consistency: projectConsistency({
      now: context.now,
      timezone: source.timezone,
      activities: source.activities,
      pauses: source.pauses,
    }),
  };
}
export async function getLearnerHome(
  context: RequestContext,
  repository: LearningProgressRepository,
): Promise<ReturnType<typeof recommendNext> & { asOf: Instant }> {
  const source = await repository.getHome({ learnerId: context.actor.userId, now: context.now });
  const recommendation = recommendNext(source);
  if (source.plannedAction && !source.dueReview)
    return {
      ...recommendation,
      action: source.plannedAction,
      alternatives: recommendation.alternatives.map((a) => ({
        ...a,
        title: `Outside your plan: ${a.title}`,
        reasonCodes: [...a.reasonCodes, "out_of_plan"],
      })),
      asOf: context.now,
    };
  if (source.hasAcceptedPlan && !source.dueReview)
    return {
      ...recommendation,
      action: {
        ...recommendation.action,
        title: `Outside your plan: ${recommendation.action.title}`,
        reasonCodes: [...recommendation.action.reasonCodes, "out_of_plan"],
      },
      asOf: context.now,
    };
  return { ...recommendation, asOf: context.now };
}
export async function pauseOwnedStudy(
  context: RequestContext,
  repository: LearningProgressRepository,
  input: { startDay: string; endDay: string; timezone: string },
): Promise<void> {
  await repository.pauseStudy({
    ...input,
    learnerId: context.actor.userId,
    now: context.now,
    eventId: context.ids.generate("event"),
  });
}
export async function recordOwnedExternalPractice(
  context: RequestContext,
  repository: LearningProgressRepository,
  input: {
    referenceId: OpaqueId<"externalReference">;
    kind: "handoff_requested" | "completed" | "corrected";
    idempotencyKey: string;
  },
): Promise<void> {
  if (
    !["handoff_requested", "completed", "corrected"].includes(input.kind) ||
    !/^[A-Za-z0-9._:-]{8,128}$/.test(input.idempotencyKey)
  )
    throw validationError("Invalid external journal command.");
  await repository.recordExternal({
    ...input,
    learnerId: context.actor.userId,
    now: context.now,
    eventId: context.ids.generate("event"),
  });
}
