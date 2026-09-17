import type { Pool } from "pg";
import { withTransaction } from "./transaction.ts";

type OutboxRow = {
  event_id: string;
  topic: string;
  aggregate_id: string;
  payload: unknown;
  occurred_at: Date;
  attempts: number;
};

export type ClaimedOutboxEvent = {
  readonly eventId: string;
  readonly topic: string;
  readonly aggregateId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly occurredAt: string;
  readonly attempts: number;
};

export type OutboxRelayRepository = {
  readonly claimNext: (input: {
    readonly topic: string;
    readonly relayId: string;
    readonly now: string;
    readonly leaseDurationMs: number;
  }) => Promise<ClaimedOutboxEvent | null>;
  readonly acknowledge: (input: {
    readonly eventId: string;
    readonly relayId: string;
  }) => Promise<void>;
  readonly retry: (input: {
    readonly eventId: string;
    readonly relayId: string;
    readonly availableAt: string;
  }) => Promise<void>;
};

/** PostgreSQL claim/ack/retry adapter for the application-owned outbox. */
export class PostgresOutboxRelayRepository implements OutboxRelayRepository {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async claimNext(input: {
    readonly topic: string;
    readonly relayId: string;
    readonly now: string;
    readonly leaseDurationMs: number;
  }): Promise<ClaimedOutboxEvent | null> {
    const claimExpiresAt = new Date(Date.parse(input.now) + input.leaseDurationMs).toISOString();
    return withTransaction(this.pool, async (transaction) => {
      const result = await transaction.query<OutboxRow>(
        `WITH candidate AS (
           SELECT event_id
             FROM platform.outbox_event
            WHERE topic = $1
              AND published_at IS NULL
              AND available_at <= $2
              AND (claim_expires_at IS NULL OR claim_expires_at <= $2)
            ORDER BY available_at, occurred_at
            FOR UPDATE SKIP LOCKED
            LIMIT 1
         )
         UPDATE platform.outbox_event AS event
            SET claimed_by = $3, claim_expires_at = $4, attempts = event.attempts + 1
           FROM candidate
          WHERE event.event_id = candidate.event_id
        RETURNING event.event_id, event.topic, event.aggregate_id, event.payload,
                  event.occurred_at, event.attempts AS attempts`,
        [input.topic, input.now, input.relayId, claimExpiresAt],
      );
      const row = result.rows[0];
      if (row === undefined) return null;
      return mapClaimedEvent(row);
    });
  }

  async acknowledge(input: { readonly eventId: string; readonly relayId: string }): Promise<void> {
    const result = await this.pool.query(
      `UPDATE platform.outbox_event
          SET published_at = now(), claimed_by = NULL, claim_expires_at = NULL
        WHERE event_id = $1 AND claimed_by = $2 AND published_at IS NULL`,
      [input.eventId, input.relayId],
    );
    if (result.rowCount !== 1) throw new Error("Outbox event was not owned for acknowledgement.");
  }

  async retry(input: {
    readonly eventId: string;
    readonly relayId: string;
    readonly availableAt: string;
  }): Promise<void> {
    const result = await this.pool.query(
      `UPDATE platform.outbox_event
          SET available_at = $3, claimed_by = NULL, claim_expires_at = NULL
        WHERE event_id = $1 AND claimed_by = $2 AND published_at IS NULL`,
      [input.eventId, input.relayId, input.availableAt],
    );
    if (result.rowCount !== 1) throw new Error("Outbox event was not owned for retry.");
  }
}

function mapClaimedEvent(row: OutboxRow): ClaimedOutboxEvent {
  if (!isRecord(row.payload)) throw new Error("Outbox relay payload is not an object.");
  return {
    eventId: row.event_id,
    topic: row.topic,
    aggregateId: row.aggregate_id,
    payload: row.payload,
    occurredAt: row.occurred_at.toISOString(),
    attempts: row.attempts,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
