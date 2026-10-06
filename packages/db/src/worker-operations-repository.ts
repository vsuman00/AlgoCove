import { createHash } from "node:crypto";
import type { Pool } from "pg";
import {
  requirePermission,
  authorizationError,
  validationError,
  conflictError,
  notFoundError,
  parseWorkerJobDescriptor,
  WORKER_JOB_TOPICS,
  type RequestContext,
  type WorkerJobTopic,
} from "@algocove/application";
import { PERMISSIONS, parseId } from "@algocove/domain";
import { withTransaction, type Transaction } from "./transaction.ts";

async function authorize(tx: Transaction, context: RequestContext, privacy = false): Promise<void> {
  requirePermission(context, privacy ? PERMISSIONS.privacyManage : PERMISSIONS.operationsManage);
  const grant = await tx.query(
    "SELECT 1 FROM platform.role_grant WHERE learner_id=$1 AND role=$2 AND revoked_at IS NULL FOR SHARE",
    [context.actor.userId, privacy ? "privacy_administrator" : "operator"],
  );
  if (!grant.rowCount)
    throw authorizationError("An active server-owned operational grant is required.");
}

export class PostgresWorkerOperationsRepository {
  private readonly pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }

  async inspect(context: RequestContext, limit = 100): Promise<Record<string, unknown>> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500)
      throw validationError("Bounded inspection limit required.");
    return withTransaction(
      this.pool,
      async (tx) => {
        await authorize(tx, context);
        const queue = await tx.query(
          `SELECT topic,count(*) FILTER(WHERE dead_lettered_at IS NULL)::integer AS pending,
         count(*) FILTER(WHERE dead_lettered_at IS NOT NULL)::integer AS dead_letters,
         count(*) FILTER(WHERE claimed_by IS NOT NULL AND claim_expires_at<=$1)::integer AS expired_claims,
         greatest(0,extract(epoch FROM ($1::timestamptz-min(occurred_at) FILTER(WHERE dead_lettered_at IS NULL))))::integer AS oldest_age_seconds
         FROM platform.outbox_event WHERE topic=ANY($2) AND published_at IS NULL GROUP BY topic ORDER BY topic`,
          [context.now, [...WORKER_JOB_TOPICS]],
        );
        const deadLetters = await tx.query(
          `SELECT event_id,topic,attempts,attempts-replay_attempt_base AS delivery_attempts,dead_lettered_at,dead_letter_reason
         FROM platform.outbox_event WHERE topic=ANY($1) AND dead_lettered_at IS NOT NULL
         ORDER BY dead_lettered_at,event_id LIMIT $2`,
          [[...WORKER_JOB_TOPICS], limit],
        );
        const derivations = await tx.query(
          "SELECT state,count(*)::integer AS count FROM platform.worker_derivation_expectation GROUP BY state ORDER BY state",
        );
        const missing = await tx.query(
          `SELECT count(*)::integer AS count FROM content.content_version c
         WHERE c.status='published' AND c.payload_status='available' AND (c.rights_expires_at IS NULL OR c.rights_expires_at>$1)
         AND NOT EXISTS(SELECT 1 FROM platform.worker_derivation_expectation d WHERE d.content_version_id=c.content_version_id AND d.topic='content.derivation.requested')`,
          [context.now],
        );
        const indexes = await tx.query(
          "SELECT state,count(*)::integer AS count FROM search.content_index GROUP BY state ORDER BY state",
        );
        const models = await tx.query(
          "SELECT configuration_id,provider,model,dimensions,normalization,policy_version,enabled FROM search.embedding_configuration ORDER BY configuration_id LIMIT $1",
          [limit],
        );
        return {
          indexes: indexes.rows,
          embeddingConfigurations: models.rows,
          queue: queue.rows,
          deadLetters: deadLetters.rows,
          derivations: derivations.rows,
          unregisteredPublishedVersions: missing.rows[0]?.count ?? 0,
        };
      },
      { statementTimeoutMs: 2000 },
    );
  }

  async enqueue(context: RequestContext, topic: WorkerJobTopic, payload: unknown): Promise<string> {
    const descriptor = parseWorkerJobDescriptor(topic, payload);
    // Module jobs are registered atomically with their canonical source by the
    // corresponding application workflow, never from arbitrary operator payloads.
    if (topic !== "platform.reconciliation.requested" && topic !== "privacy.retention.requested")
      throw validationError("Use the owning module workflow to enqueue this job.");
    return withTransaction(
      this.pool,
      async (tx) => {
        await authorize(tx, context, topic === "privacy.retention.requested");
        const eventId = context.ids.generate("event");
        await tx.query(
          "INSERT INTO platform.outbox_event(event_id,topic,aggregate_id,payload,occurred_at,available_at) VALUES($1,$2,$1,$3::jsonb,$4,$4)",
          [eventId, topic, JSON.stringify(descriptor), context.now],
        );
        await audit(tx, context, eventId, "worker.job.enqueued", { topic });
        return eventId;
      },
      { statementTimeoutMs: 2000 },
    );
  }

  async replay(
    context: RequestContext,
    input: { eventId: string; expectedAttempts: number; reason: string },
  ): Promise<void> {
    if (
      !parseId("event", input.eventId).ok ||
      !Number.isSafeInteger(input.expectedAttempts) ||
      input.expectedAttempts < 1 ||
      !/^[A-Za-z0-9 ._:-]{8,160}$/.test(input.reason)
    )
      throw validationError(
        "Event identity, current attempt count and safe replay reason are required.",
      );
    await withTransaction(
      this.pool,
      async (tx) => {
        const row = (
          await tx.query<{
            topic: WorkerJobTopic;
            payload: unknown;
            attempts: number;
            dead_letter_reason: string | null;
            published_at: Date | null;
          }>(
            "SELECT topic,payload,attempts,dead_letter_reason,published_at FROM platform.outbox_event WHERE event_id=$1 FOR UPDATE",
            [input.eventId],
          )
        ).rows[0];
        if (!row) throw notFoundError("Worker event unavailable.");
        await authorize(tx, context, row.topic === "privacy.retention.requested");
        parseWorkerJobDescriptor(row.topic, row.payload);
        if (!row.dead_letter_reason || row.published_at || row.attempts !== input.expectedAttempts)
          throw conflictError("Replay requires the current dead-letter attempt count.");
        await tx.query(
          `UPDATE platform.outbox_event SET dead_lettered_at=NULL,dead_letter_reason=NULL,claimed_by=NULL,claim_expires_at=NULL,
         replay_attempt_base=attempts,available_at=$2 WHERE event_id=$1`,
          [input.eventId, context.now],
        );
        await audit(tx, context, input.eventId, "worker.job.replayed", {
          topic: row.topic,
          previousReason: row.dead_letter_reason,
          previousAttempts: row.attempts,
          reason: input.reason,
        });
      },
      { statementTimeoutMs: 2000 },
    );
  }

  /** Atomically register required work; deterministic event identity survives retries. */
  async registerDerivation(
    context: RequestContext,
    input: {
      contentVersionId: string;
      sourceChecksum: string;
      policyVersion: string;
      topic: "content.derivation.requested" | "content.embedding.requested";
    },
  ): Promise<string> {
    const descriptor = parseWorkerJobDescriptor(input.topic, {
      schemaVersion: 1,
      contentVersionId: input.contentVersionId,
      sourceChecksum: input.sourceChecksum,
      policyVersion: input.policyVersion,
    });
    return withTransaction(
      this.pool,
      async (tx) => {
        await authorize(tx, context);
        const source = await tx.query(
          "SELECT 1 FROM content.content_version WHERE content_version_id=$1 AND checksum=$2 AND status='published' AND payload_status='available' AND (rights_expires_at IS NULL OR rights_expires_at>$3) FOR SHARE",
          [input.contentVersionId, input.sourceChecksum, context.now],
        );
        if (!source.rowCount)
          throw validationError("Current available published content is required.");
        const eventId =
          "evt_" +
          createHash("sha256")
            .update(
              JSON.stringify([
                input.topic,
                input.contentVersionId,
                input.policyVersion,
                input.sourceChecksum,
              ]),
            )
            .digest("hex")
            .slice(0, 40);
        await tx.query(
          "INSERT INTO platform.outbox_event(event_id,topic,aggregate_id,payload,occurred_at,available_at) VALUES($1,$2,$3,$4::jsonb,$5,$5) ON CONFLICT(event_id) DO NOTHING",
          [eventId, input.topic, input.contentVersionId, JSON.stringify(descriptor), context.now],
        );
        await tx.query(
          "INSERT INTO platform.worker_derivation_expectation(content_version_id,policy_version,source_checksum,topic,event_id,registered_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(content_version_id,policy_version,topic) DO NOTHING",
          [
            input.contentVersionId,
            input.policyVersion,
            input.sourceChecksum,
            input.topic,
            eventId,
            context.now,
          ],
        );
        return eventId;
      },
      { statementTimeoutMs: 2000 },
    );
  }
}
async function audit(
  tx: Transaction,
  context: RequestContext,
  eventId: string,
  action: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await tx.query(
    "INSERT INTO platform.audit_event(event_id,actor_id,action,resource_type,resource_id,payload,occurred_at) VALUES($1,$2,$3,'worker_event',$4,$5::jsonb,$6)",
    [
      context.ids.generate("event"),
      context.actor.userId,
      action,
      eventId,
      JSON.stringify({ ...payload, traceId: context.traceId }),
      context.now,
    ],
  );
}
