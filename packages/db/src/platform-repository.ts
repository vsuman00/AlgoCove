import type { QueryResultRow } from "pg";
import type { ContentChecksum, Instant, LearnerId, OpaqueId } from "@algocove/domain";
import type { Queryable } from "./connection.ts";

type ClaimRow = QueryResultRow & {
  scope: string;
  claim_key: string;
  request_hash: string;
  state: "pending" | "completed" | "failed";
  response_status: number | null;
  response_body: unknown;
};

type IdempotencyClaimResult =
  | { readonly kind: "claimed" }
  | {
      readonly kind: "replay";
      readonly response: { readonly status: number; readonly body: Readonly<Record<string, unknown>> };
    }
  | { readonly kind: "in_progress" }
  | { readonly kind: "conflict" };

type IdempotencyInput = {
  readonly scope: string;
  readonly key: string;
  readonly requestHash: ContentChecksum;
};

type IdempotencyResponse = {
  readonly status: number;
  readonly body: Readonly<Record<string, unknown>>;
};

type AuditEvent = {
  readonly eventId: OpaqueId<"event">;
  readonly actorId: LearnerId | null;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly occurredAt: Instant;
};

type OutboxEvent = {
  readonly eventId: OpaqueId<"event">;
  readonly topic: string;
  readonly aggregateId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly occurredAt: Instant;
};

function objectResponse(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Database idempotency response violates the object contract.");
  }
  return value as Readonly<Record<string, unknown>>;
}

/** PostgreSQL adapter for idempotency, audit, and transactional outbox ports. */
export class PostgresPlatformRepository {
  private readonly database: Queryable;

  constructor(database: Queryable) {
    this.database = database;
  }

  async claim(input: IdempotencyInput): Promise<IdempotencyClaimResult> {
    const inserted = await this.database.query<ClaimRow>(
      `INSERT INTO platform.idempotency_claim (scope, claim_key, request_hash, state)
       VALUES ($1, $2, $3, 'pending')
       ON CONFLICT (scope, claim_key) DO NOTHING
       RETURNING scope, claim_key, request_hash, state, response_status, response_body`,
      [input.scope, input.key, input.requestHash],
    );
    if (inserted.rows.length > 0) return { kind: "claimed" };

    const existing = await this.database.query<ClaimRow>(
      `SELECT scope, claim_key, request_hash, state, response_status, response_body
         FROM platform.idempotency_claim
        WHERE scope = $1 AND claim_key = $2`,
      [input.scope, input.key],
    );
    const row = existing.rows[0];
    if (row === undefined) throw new Error("Idempotency claim disappeared during lookup.");
    if (row.request_hash !== input.requestHash) return { kind: "conflict" };
    if (row.state === "pending") return { kind: "in_progress" };
    if (row.state === "completed") {
      if (row.response_status === null) throw new Error("Completed idempotency claim has no status.");
      return {
        kind: "replay",
        response: { status: row.response_status, body: objectResponse(row.response_body) },
      };
    }

    const retried = await this.database.query<ClaimRow>(
      `UPDATE platform.idempotency_claim
          SET state = 'pending', response_status = NULL, response_body = NULL, completed_at = NULL
        WHERE scope = $1 AND claim_key = $2 AND request_hash = $3 AND state = 'failed'
       RETURNING scope`,
      [input.scope, input.key, input.requestHash],
    );
    return retried.rows.length > 0 ? { kind: "claimed" } : { kind: "in_progress" };
  }

  async complete(input: IdempotencyInput & { readonly response: IdempotencyResponse }): Promise<void> {
    const result = await this.database.query(
      `UPDATE platform.idempotency_claim
          SET state = 'completed', response_status = $4, response_body = $5::jsonb,
              completed_at = now()
        WHERE scope = $1 AND claim_key = $2 AND request_hash = $3 AND state = 'pending'`,
      [input.scope, input.key, input.requestHash, input.response.status, JSON.stringify(input.response.body)],
    );
    if (result.rowCount !== 1) throw new Error("Idempotency claim was not pending for completion.");
  }

  async fail(input: IdempotencyInput): Promise<void> {
    await this.database.query(
      `UPDATE platform.idempotency_claim
          SET state = 'failed', completed_at = now()
        WHERE scope = $1 AND claim_key = $2 AND request_hash = $3 AND state = 'pending'`,
      [input.scope, input.key, input.requestHash],
    );
  }

  async append(event: AuditEvent): Promise<void> {
    await this.database.query(
      `INSERT INTO platform.audit_event
        (event_id, actor_id, action, resource_type, resource_id, payload, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
      [
        event.eventId,
        event.actorId,
        event.action,
        event.resourceType,
        event.resourceId,
        JSON.stringify(event.payload),
        event.occurredAt,
      ],
    );
  }

  async enqueue(event: OutboxEvent): Promise<void> {
    await this.database.query(
      `INSERT INTO platform.outbox_event
        (event_id, topic, aggregate_id, payload, occurred_at)
       VALUES ($1, $2, $3, $4::jsonb, $5)`,
      [event.eventId, event.topic, event.aggregateId, JSON.stringify(event.payload), event.occurredAt],
    );
  }
}
