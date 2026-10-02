import type { Pool } from "pg";
import {
  BUDGET_POLICIES,
  type BudgetPolicy,
  type OptionalOperation,
  type BudgetAdmission,
  type LearnerId,
  type Instant,
} from "@algocove/domain";
import { conflictError, requireRole, type RequestContext } from "@algocove/application";
import { withTransaction, type Transaction } from "./transaction.ts";
import { lockStudyOwner } from "./learning-source-repository.ts";
export type BudgetRequest = {
  learnerId: LearnerId;
  operation: OptionalOperation;
  key: string;
  digest: string;
  now: Instant;
};
export async function reserveOptional(
  tx: Transaction,
  input: BudgetRequest,
  policy: BudgetPolicy = BUDGET_POLICIES[input.operation],
): Promise<BudgetAdmission> {
  await lockStudyOwner(tx, input.learnerId);
  const old = await tx.query<{ digest: string }>(
    "SELECT digest FROM platform.optional_reservation WHERE learner_id=$1 AND operation=$2 AND reservation_key=$3",
    [input.learnerId, input.operation, input.key],
  );
  if (old.rows[0]) {
    if (old.rows[0].digest !== input.digest)
      throw conflictError("Reservation key already has different facts.");
    return { allowed: true, replayed: true };
  }
  const breaker = await tx.query<{ open_until: Date | null }>(
    "SELECT open_until FROM platform.operation_breaker WHERE learner_id=$1 AND operation=$2",
    [input.learnerId, input.operation],
  );
  const until = breaker.rows[0]?.open_until;
  if (until && until.getTime() > Date.parse(input.now))
    return {
      allowed: false,
      reason: "circuit_open",
      retryAfterSeconds: Math.ceil((until.getTime() - Date.parse(input.now)) / 1000),
    };
  const counts = await tx.query<{ daily: number; units: number; minute: number; active: number }>(
    `SELECT count(*) FILTER(WHERE created_at>=date_trunc('day',$3::timestamptz AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')::integer AS daily,coalesce(sum(units) FILTER(WHERE created_at>=date_trunc('day',$3::timestamptz AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),0)::integer AS units,count(*) FILTER(WHERE created_at>$3::timestamptz-interval '1 minute')::integer AS minute,count(*) FILTER(WHERE finished_at IS NULL)::integer AS active FROM platform.optional_reservation WHERE learner_id=$1 AND operation=$2`,
    [input.learnerId, input.operation, input.now],
  );
  const c = counts.rows[0]!;
  if (c.daily >= policy.dailyRequests || c.units + policy.unitsPerRequest > policy.dailyUnits)
    return { allowed: false, reason: "daily_cap", retryAfterSeconds: 86400 };
  if (c.minute >= policy.minuteRequests)
    return { allowed: false, reason: "rate_limit", retryAfterSeconds: 60 };
  if (c.active >= policy.concurrent)
    return { allowed: false, reason: "concurrency", retryAfterSeconds: 5 };
  // After cooldown only one bounded probe is admitted; no expiry releases unresolved code work.
  if (until && c.active > 0)
    return { allowed: false, reason: "circuit_open", retryAfterSeconds: 5 };
  await tx.query(
    "INSERT INTO platform.optional_reservation(learner_id,operation,reservation_key,digest,units,policy_version,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)",
    [
      input.learnerId,
      input.operation,
      input.key,
      input.digest,
      policy.unitsPerRequest,
      policy.version,
      input.now,
    ],
  );
  return { allowed: true, replayed: false };
}
export async function finishOptional(
  tx: Transaction,
  input: Pick<BudgetRequest, "learnerId" | "operation" | "key" | "now"> & {
    outcome: "success" | "failure";
  },
  policy: BudgetPolicy = BUDGET_POLICIES[input.operation],
): Promise<void> {
  await lockStudyOwner(tx, input.learnerId);
  const result = await tx.query(
    "UPDATE platform.optional_reservation SET finished_at=$4,outcome=$5 WHERE learner_id=$1 AND operation=$2 AND reservation_key=$3 AND finished_at IS NULL RETURNING 1",
    [input.learnerId, input.operation, input.key, input.now, input.outcome],
  );
  if (!result.rowCount) return;
  await tx.query(
    `INSERT INTO platform.operation_breaker(learner_id,operation,failures,open_until) VALUES($1,$2,$3::integer,CASE WHEN $3::integer>=$4::integer THEN $5::timestamptz+($6::integer*interval '1 millisecond') ELSE NULL END) ON CONFLICT(learner_id,operation) DO UPDATE SET failures=CASE WHEN $3=0 THEN 0 ELSE platform.operation_breaker.failures+1 END,open_until=CASE WHEN $3=0 THEN NULL WHEN platform.operation_breaker.failures+1>=$4 THEN $5::timestamptz+($6::integer*interval '1 millisecond') ELSE platform.operation_breaker.open_until END`,
    [
      input.learnerId,
      input.operation,
      input.outcome === "success" ? 0 : 1,
      policy.failureThreshold,
      input.now,
      policy.cooldownMs,
    ],
  );
}
export class PostgresBudgetRepository {
  private readonly pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }
  reserve(input: BudgetRequest): Promise<BudgetAdmission> {
    return withTransaction(this.pool, (tx) => reserveOptional(tx, input));
  }
  finish(input: Parameters<typeof finishOptional>[1]): Promise<void> {
    return withTransaction(this.pool, (tx) => finishOptional(tx, input));
  }

  async evaluationSnapshot(
    context: RequestContext,
    learnerId: LearnerId,
  ): Promise<
    {
      operation: OptionalOperation;
      policyVersion: number;
      requests: number;
      reservedUnits: number;
      pending: number;
      infrastructureFailures: number;
    }[]
  > {
    requireRole(context, context.actor.roles.includes("operator") ? "operator" : "evaluator");
    const rows = await this.pool.query<{
      operation: OptionalOperation;
      policy_version: number;
      requests: number;
      units: number;
      pending: number;
      failures: number;
    }>(
      `SELECT operation,policy_version,count(*)::integer AS requests,sum(units)::integer AS units,count(*) FILTER(WHERE finished_at IS NULL)::integer AS pending,count(*) FILTER(WHERE outcome='failure')::integer AS failures FROM platform.optional_reservation WHERE learner_id=$1 GROUP BY operation,policy_version ORDER BY operation,policy_version`,
      [learnerId],
    );
    return rows.rows.map((r) => ({
      operation: r.operation,
      policyVersion: r.policy_version,
      requests: r.requests,
      reservedUnits: r.units,
      pending: r.pending,
      infrastructureFailures: r.failures,
    }));
  }
  async reset(
    context: RequestContext,
    learnerId: LearnerId,
    operation: OptionalOperation,
  ): Promise<void> {
    requireRole(context, "operator");
    await withTransaction(this.pool, async (tx) => {
      await lockStudyOwner(tx, learnerId);
      await tx.query(
        "DELETE FROM platform.operation_breaker WHERE learner_id=$1 AND operation=$2",
        [learnerId, operation],
      );
      await tx.query(
        "INSERT INTO platform.outbox_event(event_id,topic,aggregate_id,payload,occurred_at) VALUES($1,'platform.breaker.reset',$2,$3::jsonb,$4)",
        [
          context.ids.generate("event"),
          learnerId,
          JSON.stringify({ operation, actorId: context.actor.userId }),
          context.now,
        ],
      );
    });
  }
}
