import type { Pool } from "pg";
import { authorizationError, validationError, type RequestContext } from "@algocove/application";
import { withTransaction } from "./transaction.ts";
export class PostgresPrivacyOperationsRepository {
  private readonly pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }
  async hold(
    ctx: RequestContext,
    input: { learnerId: unknown; reason: unknown; expiresAt: unknown; release?: boolean },
  ): Promise<void> {
    if (
      typeof input.learnerId !== "string" ||
      !/^usr_[0-9a-hjkmnp-tv-z]{16,52}$/.test(input.learnerId) ||
      !["legal", "security"].includes(input.reason as string) ||
      typeof input.expiresAt !== "string" ||
      !Number.isFinite(Date.parse(input.expiresAt)) ||
      Date.parse(input.expiresAt) <= Date.parse(ctx.now) ||
      Date.parse(input.expiresAt) > Date.parse(ctx.now) + 90 * 86400000
    )
      throw validationError("A bounded subject, reason code and future hold expiry are required.");
    await withTransaction(this.pool, async (tx) => {
      const grant = await tx.query(
        "SELECT 1 FROM platform.role_grant g JOIN platform.learner l USING(learner_id) WHERE learner_id=$1 AND role='privacy_administrator' AND revoked_at IS NULL AND account_state='active' FOR SHARE OF g,l",
        [ctx.actor.userId],
      );
      if (!ctx.actor.roles.includes("privacy_administrator") || !grant.rowCount)
        throw authorizationError("Privacy administrator required.");
      // Serialize with the account lock held by the purge, not only the request lock.
      const subject = await tx.query(
        "SELECT 1 FROM platform.learner WHERE learner_id=$1 AND account_state<>'deleted' FOR UPDATE",
        [input.learnerId],
      );
      if (!subject.rowCount) throw validationError("Active subject is unavailable.");
      if (input.release)
        await tx.query("DELETE FROM platform.privacy_hold WHERE learner_id=$1", [input.learnerId]);
      else
        await tx.query(
          "INSERT INTO platform.privacy_hold(learner_id,reason_code,placed_at,expires_at) VALUES($1,$2,clock_timestamp(),$3) ON CONFLICT(learner_id) DO UPDATE SET reason_code=EXCLUDED.reason_code,placed_at=EXCLUDED.placed_at,expires_at=EXCLUDED.expires_at",
          [input.learnerId, input.reason, input.expiresAt],
        );
      await tx.query(
        "UPDATE platform.privacy_deletion SET state=$2,lease_token=NULL,lease_expires_at=NULL WHERE learner_id=$1 AND state<>'completed'",
        [input.learnerId, input.release ? "pending" : "held"],
      );
      await tx.query(
        "INSERT INTO platform.audit_event(event_id,actor_id,action,resource_type,resource_id,payload) VALUES($1,$2,$3,'privacy_hold',$4,jsonb_build_object('reasonCode',$5::text))",
        [
          ctx.ids.generate("event"),
          ctx.actor.userId,
          input.release ? "privacy.hold_released" : "privacy.hold_placed",
          input.learnerId,
          input.reason,
        ],
      );
    });
  }
}
