import type { Pool } from "pg";
import { parseWorkerJobDescriptor, conflictError } from "@algocove/application";
import type { ClaimedOutboxEvent } from "./outbox-relay-repository.ts";
import { withTransaction, type Transaction } from "./transaction.ts";

export type WorkerEffectSummary = Readonly<Record<string, number>>;
/** Database-only effects and the immutable receipt commit together. Never invoke a provider inside this transaction. */
export class PostgresWorkerEffectsRepository {
  private readonly pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }

  async apply(
    event: ClaimedOutboxEvent,
    relayId: string,
    handlerVersion: string,
    now: string,
    effect: (tx: Transaction) => Promise<WorkerEffectSummary>,
  ): Promise<WorkerEffectSummary> {
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(handlerVersion))
      throw new Error("Invalid worker handler version.");
    return withTransaction(
      this.pool,
      async (tx) => {
        const claim = (
          await tx.query<{
            claimed_by: string | null;
            attempts: number;
            claim_expires_at: Date | null;
            published_at: Date | null;
            descriptor_matches: boolean;
          }>(
            "SELECT claimed_by,attempts,claim_expires_at,published_at,(payload=$2::jsonb AND topic=$3) AS descriptor_matches FROM platform.outbox_event WHERE event_id=$1 FOR UPDATE",
            [event.eventId, JSON.stringify(event.payload), event.topic],
          )
        ).rows[0];
        if (
          !claim ||
          !claim.descriptor_matches ||
          claim.published_at ||
          claim.claimed_by !== relayId ||
          claim.attempts !== event.attempts ||
          !claim.claim_expires_at ||
          claim.claim_expires_at.getTime() <= Date.parse(now)
        )
          throw conflictError("Worker effect requires a current owned claim.");
        const receipt = (
          await tx.query<{ summary: WorkerEffectSummary }>(
            "SELECT summary FROM platform.worker_effect_receipt WHERE event_id=$1 AND handler_version=$2",
            [event.eventId, handlerVersion],
          )
        ).rows[0];
        if (receipt) return receipt.summary;
        const summary = await effect(tx);
        if (
          Object.keys(summary).some((k) => !/^[a-z][a-zA-Z0-9]{0,63}$/.test(k)) ||
          Object.values(summary).some((v) => !Number.isSafeInteger(v) || v < 0)
        )
          throw new Error("Worker effect summary must contain only safe bounded counts.");
        await tx.query(
          "INSERT INTO platform.worker_effect_receipt(event_id,handler_version,completed_at,summary) VALUES($1,$2,$3,$4::jsonb)",
          [event.eventId, handlerVersion, now, JSON.stringify(summary)],
        );
        return summary;
      },
      { statementTimeoutMs: 2000 },
    );
  }

  async admitContent(event: ClaimedOutboxEvent, relayId: string, now: string): Promise<boolean> {
    const d = parseWorkerJobDescriptor(event.topic, event.payload);
    if (!("contentVersionId" in d)) throw new Error("Canonical content descriptor required.");
    const eligible = await this.pool.query(
      "SELECT 1 FROM content.content_version WHERE content_version_id=$1 AND checksum=$2 AND status='published' AND payload_status='available' AND (rights_expires_at IS NULL OR rights_expires_at>$3)",
      [d.contentVersionId, d.sourceChecksum, now],
    );
    if (eligible.rowCount) return true;
    await this.apply(event, relayId, "content.obsolete.v1", now, async (tx) => {
      await tx.query(
        "UPDATE platform.worker_derivation_expectation SET state='obsolete' WHERE event_id=$1 AND state<>'obsolete'",
        [event.eventId],
      );
      return { obsolete: 1 };
    });
    return false;
  }

  async reconcile(
    event: ClaimedOutboxEvent,
    relayId: string,
    now: string,
  ): Promise<WorkerEffectSummary> {
    const d = parseWorkerJobDescriptor(event.topic, event.payload);
    if (!("scope" in d) || d.scope !== "outbox_and_derivations")
      throw new Error("Unsupported reconciliation descriptor.");
    return this.apply(event, relayId, "reconciliation.v1", now, async (tx) => {
      const released = await tx.query(
        `WITH expired AS (SELECT event_id FROM platform.outbox_event WHERE event_id<>$1 AND topic=ANY($2)
         AND published_at IS NULL AND dead_lettered_at IS NULL AND claim_expires_at<=$3
         ORDER BY claim_expires_at,event_id LIMIT $4 FOR UPDATE SKIP LOCKED)
         UPDATE platform.outbox_event e SET claimed_by=NULL,claim_expires_at=NULL FROM expired WHERE e.event_id=expired.event_id`,
        [
          event.eventId,
          [
            "content.derivation.requested",
            "content.embedding.requested",
            "evaluation.requested",
            "privacy.retention.requested",
            "platform.reconciliation.requested",
          ],
          now,
          d.limit,
        ],
      );
      const obsolete = await tx.query(
        `WITH withdrawn AS (SELECT d.content_version_id,d.policy_version,d.topic FROM platform.worker_derivation_expectation d
         JOIN content.content_version c USING(content_version_id) WHERE d.state<>'obsolete' AND
         (c.status<>'published' OR c.payload_status<>'available' OR c.checksum<>d.source_checksum OR c.rights_expires_at<=$1)
         ORDER BY d.registered_at LIMIT $2 FOR UPDATE OF d SKIP LOCKED)
         UPDATE platform.worker_derivation_expectation d SET state='obsolete' FROM withdrawn w
         WHERE (d.content_version_id,d.policy_version,d.topic)=(w.content_version_id,w.policy_version,w.topic)`,
        [now, d.limit],
      );
      const obsoleteIndexes = await tx.query(
        `WITH withdrawn AS (SELECT i.index_id FROM search.content_index i
         JOIN content.content_version c USING(content_version_id) WHERE i.state<>'obsolete' AND
         (c.status<>'published' OR c.payload_status<>'available' OR c.checksum<>i.source_checksum OR c.rights_expires_at<=$1 OR i.valid_until<=$1)
         ORDER BY i.created_at,i.index_id LIMIT $2 FOR UPDATE OF i SKIP LOCKED)
         UPDATE search.content_index i SET state='obsolete' FROM withdrawn w WHERE i.index_id=w.index_id`,
        [now, d.limit],
      );
      // Repair delivery marked complete without a committed consumer receipt.
      // Same event ID and lifetime attempts are retained. Never replay poison automatically.
      const recovered = await tx.query(
        `WITH lost AS (SELECT e.event_id FROM platform.worker_derivation_expectation d JOIN platform.outbox_event e USING(event_id)
         WHERE d.state='pending' AND e.published_at IS NOT NULL AND e.dead_lettered_at IS NULL
         AND NOT EXISTS(SELECT 1 FROM platform.worker_effect_receipt r WHERE r.event_id=e.event_id)
         ORDER BY d.registered_at LIMIT $1 FOR UPDATE OF e SKIP LOCKED)
         UPDATE platform.outbox_event e SET published_at=NULL,available_at=$2,claimed_by=NULL,claim_expires_at=NULL
         FROM lost WHERE e.event_id=lost.event_id`,
        [d.limit, now],
      );
      const incomplete =
        (
          await tx.query<{ count: number }>(
            "SELECT count(*)::integer AS count FROM platform.worker_derivation_expectation WHERE state='pending'",
          )
        ).rows[0]?.count ?? 0;
      return {
        releasedClaims: released.rowCount ?? 0,
        obsoleteDerivations: obsolete.rowCount ?? 0,
        obsoleteIndexes: obsoleteIndexes.rowCount ?? 0,
        recoveredDeliveries: recovered.rowCount ?? 0,
        incompleteDerivations: incomplete,
      };
    });
  }

  async retainExpiredDrafts(
    event: ClaimedOutboxEvent,
    relayId: string,
    now: string,
  ): Promise<WorkerEffectSummary> {
    const d = parseWorkerJobDescriptor(event.topic, event.payload);
    if (!("scope" in d) || d.scope !== "expired_drafts")
      throw new Error("Unsupported retention descriptor.");
    return this.apply(event, relayId, "retention.expired-drafts.v1", now, async (tx) => {
      // Existing expires_at policy governs deletion. No new period, account purge,
      // audit deletion, backup policy or final-submission retention is invented.
      // DELETE supplies row locking itself. Avoid SELECT FOR UPDATE, which
      // would require granting draft UPDATE to this delete-only worker.
      // Concurrent expiry work can wait only until the transaction deadline.
      const revisions = await tx.query(
        `WITH expired AS (SELECT draft_id,revision FROM practice.draft_revision WHERE expires_at<=$1
         ORDER BY expires_at,draft_id,revision LIMIT $2)
         DELETE FROM practice.draft_revision r USING expired x WHERE (r.draft_id,r.revision)=(x.draft_id,x.revision)`,
        [now, d.limit],
      );
      const drafts = await tx.query(
        `WITH expired AS (SELECT draft_id FROM practice.draft WHERE expires_at<=$1 ORDER BY expires_at,draft_id
         LIMIT $2)
         DELETE FROM practice.draft d USING expired x WHERE d.draft_id=x.draft_id`,
        [now, d.limit],
      );
      return { expiredRevisions: revisions.rowCount ?? 0, expiredDrafts: drafts.rowCount ?? 0 };
    });
  }
}
