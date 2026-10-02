import type { Pool } from "pg";
import {
  conflictError,
  notFoundError,
  validationError,
  type RoadmapIntentRepository,
  type PlanningContext,
} from "@algocove/application";
import {
  localStudyDay,
  type RoadmapIntentVersion,
  type RoadmapPreferences,
} from "@algocove/domain";
import { withTransaction, type Transaction } from "./transaction.ts";
import {
  lockStudyOwner,
  parsedId,
  sourceInstant,
  sourceDigest,
} from "./learning-source-repository.ts";
type VersionRow = {
  plan_id: string;
  learner_id: string;
  version: number;
  preferences: RoadmapPreferences;
  saved_at: Date;
};
function version(row: VersionRow): RoadmapIntentVersion {
  return {
    planId: parsedId("roadmapPlan", row.plan_id),
    learnerId: parsedId("learner", row.learner_id),
    version: row.version,
    preferences: row.preferences,
    savedAt: sourceInstant(row.saved_at),
  };
}
async function savedVersion(
  tx: Transaction,
  planId: string,
  revision: number,
  learnerId: string,
): Promise<RoadmapIntentVersion> {
  const result = await tx.query<VersionRow>(
    "SELECT * FROM planning.roadmap_intent_version WHERE plan_id=$1 AND version=$2 AND learner_id=$3",
    [planId, revision, learnerId],
  );
  if (result.rows[0] === undefined) throw notFoundError("Planning preferences are unavailable.");
  return version(result.rows[0]);
}
export class PostgresRoadmapIntentRepository implements RoadmapIntentRepository {
  private readonly pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }
  async getContext(
    learnerId: Parameters<RoadmapIntentRepository["getContext"]>[0],
  ): Promise<PlanningContext> {
    return withTransaction(
      this.pool,
      async (tx) => {
        const current = await tx.query<VersionRow>(
          "SELECT v.* FROM planning.roadmap_intent p JOIN planning.roadmap_intent_version v ON v.plan_id=p.plan_id AND v.version=p.current_version AND v.learner_id=p.learner_id WHERE p.learner_id=$1",
          [learnerId],
        );
        const profile = await tx.query<{
          goal: string;
          target_role: string;
          timezone: string;
          daily_capacity_minutes: number;
          preferred_languages: string[];
        }>(
          "SELECT goal,target_role,timezone,daily_capacity_minutes,preferred_languages FROM platform.learner_profile WHERE learner_id=$1",
          [learnerId],
        );
        const collections = await tx.query<{ collection_id: string; title: string }>(
          "SELECT collection_id,title FROM content.external_collection ORDER BY title,collection_id",
        );
        const p = profile.rows[0];
        return {
          intent: current.rows[0] === undefined ? null : version(current.rows[0]),
          profile:
            p === undefined
              ? null
              : {
                  goal: p.goal,
                  targetRole: p.target_role,
                  timezone: p.timezone,
                  dailyCapacityMinutes: p.daily_capacity_minutes,
                  preferredLanguages: p.preferred_languages,
                },
          collections: collections.rows.map((c) => ({
            collectionId: parsedId("collection", c.collection_id),
            title: c.title,
          })),
        };
      },
      { isolationLevel: "repeatable read", readOnly: true },
    );
  }
  async save(
    input: Parameters<RoadmapIntentRepository["save"]>[0],
  ): ReturnType<RoadmapIntentRepository["save"]> {
    return withTransaction(this.pool, async (tx) => {
      await lockStudyOwner(tx, input.learnerId);
      const digest = sourceDigest({
        planId: input.planId,
        expectedVersion: input.expectedVersion,
        preferences: input.preferences,
      });
      const command = await tx.query<{ digest: string; plan_id: string; version: number }>(
        "SELECT digest,plan_id,version FROM planning.intent_command WHERE learner_id=$1 AND idempotency_key=$2",
        [input.learnerId, input.idempotencyKey],
      );
      const old = command.rows[0];
      if (old !== undefined) {
        if (old.digest !== digest)
          throw conflictError("This save key already has different planning preferences.");
        return {
          intent: await savedVersion(tx, old.plan_id, old.version, input.learnerId),
          disposition: "replayed",
        };
      }
      if (input.preferences.startDay < localStudyDay(input.now, input.preferences.timezone))
        throw validationError("Start day must be prospective in the selected timezone.");
      const current = await tx.query<{ plan_id: string; current_version: number }>(
        "SELECT plan_id,current_version FROM planning.roadmap_intent WHERE learner_id=$1 FOR UPDATE",
        [input.learnerId],
      );
      const row = current.rows[0];
      let planId = input.newPlanId,
        revision = 1;
      if (input.planId === null) {
        if (row !== undefined)
          throw conflictError("Planning preferences already exist. Refresh before editing.");
      } else {
        if (row === undefined || row.plan_id !== input.planId)
          throw notFoundError("Planning preferences are unavailable.");
        if (row.current_version !== input.expectedVersion)
          throw conflictError(
            "Planning preferences changed in another tab. Refresh before editing.",
          );
        planId = input.planId;
        revision = row.current_version + 1;
      }
      if (input.preferences.collectionIds.length > 0) {
        const collections = await tx.query(
          "SELECT collection_id FROM content.external_collection WHERE collection_id=ANY($1::text[]) FOR SHARE",
          [input.preferences.collectionIds],
        );
        if (collections.rowCount !== input.preferences.collectionIds.length)
          throw validationError("A selected collection is unavailable.");
      }
      if (row === undefined)
        await tx.query(
          "INSERT INTO planning.roadmap_intent(plan_id,learner_id,current_version,created_at) VALUES($1,$2,1,$3)",
          [planId, input.learnerId, input.now],
        );
      await tx.query(
        "INSERT INTO planning.roadmap_intent_version(plan_id,learner_id,version,preferences,saved_at) VALUES($1,$2,$3,$4::jsonb,$5)",
        [planId, input.learnerId, revision, JSON.stringify(input.preferences), input.now],
      );
      for (const collectionId of input.preferences.collectionIds)
        await tx.query(
          "INSERT INTO planning.intent_collection(plan_id,version,learner_id,collection_id) VALUES($1,$2,$3,$4)",
          [planId, revision, input.learnerId, collectionId],
        );
      if (row !== undefined)
        await tx.query("UPDATE planning.roadmap_intent SET current_version=$2 WHERE plan_id=$1", [
          planId,
          revision,
        ]);
      await tx.query(
        "INSERT INTO planning.intent_command(learner_id,idempotency_key,digest,plan_id,version) VALUES($1,$2,$3,$4,$5)",
        [input.learnerId, input.idempotencyKey, digest, planId, revision],
      );
      await tx.query(
        "INSERT INTO platform.outbox_event(event_id,topic,aggregate_id,payload,occurred_at) VALUES($1,'planning.intent.saved',$2,$3::jsonb,$4)",
        [
          input.eventId,
          planId,
          JSON.stringify({
            learnerId: input.learnerId,
            planId,
            version: revision,
            horizonMonths: input.preferences.horizonMonths,
          }),
          input.now,
        ],
      );
      return {
        intent: await savedVersion(tx, planId, revision, input.learnerId),
        disposition: "committed",
      };
    });
  }
}
