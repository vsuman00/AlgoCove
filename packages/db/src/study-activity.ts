import type { Transaction } from "./transaction.ts";
import { localStudyDay } from "@algocove/domain";
import type { Instant, LearnerId, OpaqueId } from "@algocove/domain";
export async function recordStudyActivity(
  tx: Transaction,
  input: {
    learnerId: LearnerId;
    observationId: OpaqueId<"event">;
    occurredAt: Instant;
    kind: "assessment" | "explanation" | "review";
  },
): Promise<void> {
  const profile = await tx.query<{ timezone: string }>(
    "SELECT timezone FROM platform.learner_profile WHERE learner_id=$1",
    [input.learnerId],
  );
  const timezone = profile.rows[0]?.timezone ?? "UTC";
  await tx.query(
    "INSERT INTO practice.study_activity(observation_id,learner_id,occurred_at,local_day,timezone,kind,assessment_observation_id,learning_observation_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING",
    [
      input.observationId,
      input.learnerId,
      input.occurredAt,
      localStudyDay(input.occurredAt, timezone),
      timezone,
      input.kind,
      input.kind === "assessment" ? input.observationId : null,
      input.kind !== "assessment" ? input.observationId : null,
    ],
  );
}
