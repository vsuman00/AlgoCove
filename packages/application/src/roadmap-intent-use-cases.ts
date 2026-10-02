import {
  parseRoadmapPreferences,
  type RoadmapIntentVersion,
  type RoadmapPreferences,
  type OpaqueId,
  type LearnerId,
  type Instant,
} from "@algocove/domain";
import { requireRole, type RequestContext } from "./request-context.ts";
import { validationError } from "./errors.ts";
export type PlanningContext = {
  readonly intent: RoadmapIntentVersion | null;
  readonly profile: {
    goal: string;
    targetRole: string;
    timezone: string;
    dailyCapacityMinutes: number;
    preferredLanguages: readonly string[];
  } | null;
  readonly collections: readonly { collectionId: OpaqueId<"collection">; title: string }[];
};
export type RoadmapIntentRepository = {
  getContext(learnerId: LearnerId): Promise<PlanningContext>;
  save(input: {
    learnerId: LearnerId;
    planId: OpaqueId<"roadmapPlan"> | null;
    newPlanId: OpaqueId<"roadmapPlan">;
    expectedVersion: number | null;
    preferences: RoadmapPreferences;
    now: Instant;
    eventId: OpaqueId<"event">;
    idempotencyKey: string;
  }): Promise<{ intent: RoadmapIntentVersion; disposition: "committed" | "replayed" }>;
};
export async function getOwnedPlanningContext(
  context: RequestContext,
  repository: RoadmapIntentRepository,
): Promise<PlanningContext> {
  requireRole(context, "learner");
  return repository.getContext(context.actor.userId);
}
export async function saveOwnedRoadmapIntent(
  context: RequestContext,
  repository: RoadmapIntentRepository,
  input: {
    planId: OpaqueId<"roadmapPlan"> | null;
    expectedVersion: number | null;
    preferences: unknown;
    idempotencyKey: string;
  },
): Promise<{ intent: RoadmapIntentVersion; disposition: "committed" | "replayed" }> {
  requireRole(context, "learner");
  if (
    !/^[A-Za-z0-9._:-]{8,128}$/.test(input.idempotencyKey) ||
    (input.planId === null
      ? input.expectedVersion !== null
      : !Number.isSafeInteger(input.expectedVersion) || Number(input.expectedVersion) < 1)
  )
    throw validationError("A valid save key and expected version are required.");
  let preferences: RoadmapPreferences;
  try {
    preferences = parseRoadmapPreferences(input.preferences, context.now, { allowPastStart: true });
  } catch (error) {
    throw validationError(error instanceof Error ? error.message : "Invalid planning preferences.");
  }
  return repository.save({
    ...input,
    preferences,
    learnerId: context.actor.userId,
    newPlanId: context.ids.generate("roadmapPlan"),
    eventId: context.ids.generate("event"),
    now: context.now,
  });
}
