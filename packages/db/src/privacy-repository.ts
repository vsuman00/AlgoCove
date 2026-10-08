import type { Pool } from "pg";
import {
  authenticationRequired,
  conflictError,
  LOCAL_PRIVACY_POLICY,
  type RequestContext,
  type PrivacyStatus,
  type PrivacyRepository,
} from "@algocove/application";
import { withTransaction, withRetryableTransaction, type Transaction } from "./transaction.ts";
import { learnerIdForSubject } from "./identity-repository.ts";

type StatusRow = {
  account_state: PrivacyStatus["state"];
  request_id: string | null;
  state: PrivacyStatus["deletionState"];
  backup_expiry: Date | null;
};
const relationPattern = /^(platform|practice|mastery|planning|tutor)\.[a-z_]+$/;
function status(row: StatusRow | undefined): PrivacyStatus {
  if (!row) throw authenticationRequired("Account is unavailable.");
  return {
    state: row.account_state,
    requestId: row.request_id,
    deletionState: row.state,
    backupExpiry: row.backup_expiry?.toISOString() ?? null,
  };
}
async function loadStatus(tx: Transaction, learnerId: string): Promise<PrivacyStatus> {
  return status(
    (
      await tx.query<StatusRow>(
        "SELECT l.account_state,d.request_id,d.state,d.backup_expiry FROM platform.learner l LEFT JOIN platform.privacy_deletion d USING(learner_id) WHERE l.learner_id=$1",
        [learnerId],
      )
    ).rows[0],
  );
}
export class PostgresPrivacyRepository implements PrivacyRepository {
  private readonly pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }
  async status(context: RequestContext): Promise<PrivacyStatus> {
    return withTransaction(this.pool, (tx) => loadStatus(tx, context.actor.userId), {
      readOnly: true,
    });
  }
  /** Read only the minimal receipt after identity unlinking. Caller must supply
   * a server-verified provider subject; this never creates a mapping or role. */
  async statusForVerifiedSubject(providerSubject: string): Promise<PrivacyStatus> {
    return withTransaction(
      this.pool,
      (tx) => loadStatus(tx, learnerIdForSubject(providerSubject)),
      { readOnly: true },
    );
  }
  async exportOwned(context: RequestContext): Promise<unknown> {
    return withTransaction(
      this.pool,
      async (tx) => {
        const account = await tx.query(
          "SELECT 1 FROM platform.learner WHERE learner_id=$1 AND account_state='active' FOR SHARE",
          [context.actor.userId],
        );
        if (!account.rowCount) throw authenticationRequired("Account is unavailable.");
        const inventory = (
          await tx.query<{ relation_name: string }>(
            "SELECT relation_name FROM platform.privacy_owned_table ORDER BY ordinal",
          )
        ).rows;
        const data: Record<string, unknown> = {};
        let bytes = 0;
        for (const item of inventory) {
          if (!relationPattern.test(item.relation_name)) throw Error("Invalid privacy inventory.");
          const rows = (
            await tx.query<{ record: unknown }>(
              `SELECT to_jsonb(t)-ARRAY['granted_by','updated_by','claim','lease_token','lease_expires_at','claim_token','claimed_by','reservation_token'] AS record FROM ${item.relation_name} t WHERE learner_id=$1 LIMIT 10001`,
              [context.actor.userId],
            )
          ).rows;
          if (rows.length > 10000)
            throw conflictError(
              "Export exceeds the local synchronous limit; contact the privacy administrator.",
            );
          data[item.relation_name] = rows.map((row) => row.record);
          bytes += Buffer.byteLength(JSON.stringify(data[item.relation_name]));
          if (bytes > LOCAL_PRIVACY_POLICY.exportMaxBytes)
            throw conflictError(
              "Export exceeds the local synchronous limit; contact the privacy administrator.",
            );
        }
        data["tutor.response"] = (
          await tx.query(
            "SELECT r.* FROM tutor.response r JOIN tutor.request q USING(request_id) WHERE q.learner_id=$1",
            [context.actor.userId],
          )
        ).rows;
        data["practice.attempt_release_pin"] = (
          await tx.query(
            "SELECT p.* FROM practice.attempt_release_pin p JOIN practice.attempt a USING(attempt_id) WHERE a.learner_id=$1",
            [context.actor.userId],
          )
        ).rows;
        data["platform.audit_event"] = (
          await tx.query(
            "SELECT event_id,action,resource_type,occurred_at FROM platform.audit_event WHERE actor_id=$1 LIMIT 10001",
            [context.actor.userId],
          )
        ).rows;
        const result = {
          schemaVersion: 1,
          policyVersion: LOCAL_PRIVACY_POLICY.version,
          exportedAt: context.now,
          account: context.actor.userId,
          context: {
            versionPins:
              "Problem, language manifest, release, curriculum and policy IDs describe the versions used by each record. Historical availability can differ from today's catalog.",
            assistance:
              "Reference/tutor assistance is recorded independently of assessment and self-reported practice does not award mastery.",
            excluded:
              "Other learners, authentication tokens, internal job leases, provider credentials and public curriculum source packets are excluded.",
          },
          data,
        };
        if (Buffer.byteLength(JSON.stringify(result)) > LOCAL_PRIVACY_POLICY.exportMaxBytes)
          throw conflictError(
            "Export exceeds the local synchronous limit; contact the privacy administrator.",
          );
        return result;
      },
      { isolationLevel: "repeatable read", statementTimeoutMs: 10000 },
    );
  }
  async requestDeletion(context: RequestContext): Promise<PrivacyStatus> {
    return withRetryableTransaction(this.pool, async (tx) => {
      const row = (
        await tx.query<{ account_state: string }>(
          "SELECT account_state FROM platform.learner WHERE learner_id=$1 FOR UPDATE",
          [context.actor.userId],
        )
      ).rows[0];
      if (!row || !["active", "deletion_pending"].includes(row.account_state))
        throw authenticationRequired("Account is unavailable.");
      const existing = await loadStatus(tx, context.actor.userId);
      if (existing.requestId) return existing;
      const requestId = context.ids.generate("event");
      await tx.query(
        `INSERT INTO platform.privacy_deletion(request_id,learner_id,state,policy_version,requested_at,backup_expiry)
        VALUES($1,$2,CASE WHEN EXISTS(SELECT 1 FROM platform.privacy_hold WHERE learner_id=$2 AND expires_at>clock_timestamp()) THEN 'held' ELSE 'pending' END,$3,clock_timestamp(),greatest(clock_timestamp()+interval '30 days',coalesce((SELECT max(expires_at) FROM platform.privacy_backup WHERE destroyed_at IS NULL),clock_timestamp())))`,
        [requestId, context.actor.userId, LOCAL_PRIVACY_POLICY.version],
      );
      await tx.query(
        "INSERT INTO platform.privacy_cancellation(request_id,run_id) SELECT $1,run_id FROM practice.code_run WHERE learner_id=$2 AND terminal_result_id IS NULL",
        [requestId, context.actor.userId],
      );
      await tx.query(
        "UPDATE tutor.request SET state='cancelled',claim=NULL,reason='privacy_deletion' WHERE learner_id=$1 AND state IN ('pending','running')",
        [context.actor.userId],
      );
      await tx.query(
        "UPDATE platform.learner SET account_state='deletion_pending' WHERE learner_id=$1",
        [context.actor.userId],
      );
      await tx.query(
        "INSERT INTO platform.outbox_event(event_id,topic,aggregate_id,payload) VALUES($1,'privacy.deletion.requested',$1,jsonb_build_object('schemaVersion',1,'requestId',$1::text))",
        [requestId],
      );
      return loadStatus(tx, context.actor.userId);
    });
  }
}
