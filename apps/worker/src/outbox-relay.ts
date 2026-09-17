import {
  EXECUTION_DISPATCH_TOPIC,
  parseExecutionDispatchMessage,
  type ExecutionDispatchMessage,
} from "@algocove/execution-control";
import type { VerificationKey } from "@algocove/execution-contracts";
import {
  PostgresOutboxRelayRepository,
  type ClaimedOutboxEvent,
  type OutboxRelayRepository,
} from "@algocove/db";
import type { Pool } from "pg";

export type ExecutionDispatchSink = {
  readonly deliver: (message: ExecutionDispatchMessage) => Promise<void>;
};

export type OutboxRelayOptions = {
  readonly relayId: string;
  readonly verificationKeys: ReadonlyMap<string, VerificationKey>;
  readonly claimLeaseMs: number;
  readonly retryBaseMs?: number;
};

export type RelayPumpResult =
  | { readonly kind: "idle" }
  | { readonly kind: "delivered"; readonly eventId: string; readonly attempts: number }
  | {
      readonly kind: "retried";
      readonly eventId: string;
      readonly attempts: number;
      readonly reason: "invalid_payload" | "sink_failure";
    };

export class OutboxRelay {
  private readonly repository: OutboxRelayRepository;
  private readonly sink: ExecutionDispatchSink;
  private readonly options: OutboxRelayOptions;

  constructor(
    repository: OutboxRelayRepository | Pool,
    sink: ExecutionDispatchSink,
    options: OutboxRelayOptions,
  ) {
    this.repository = isPool(repository)
      ? new PostgresOutboxRelayRepository(repository)
      : repository;
    this.sink = sink;
    this.options = options;
    if (!Number.isSafeInteger(options.claimLeaseMs) || options.claimLeaseMs < 1_000) {
      throw new Error("Outbox relay claim lease must be at least 1000ms.");
    }
    if (
      options.retryBaseMs !== undefined &&
      (!Number.isSafeInteger(options.retryBaseMs) || options.retryBaseMs < 1)
    ) {
      throw new Error("Outbox relay retry base must be a positive integer.");
    }
  }

  async pumpOnce(now: string): Promise<RelayPumpResult> {
    const event = await this.repository.claimNext({
      topic: EXECUTION_DISPATCH_TOPIC,
      relayId: this.options.relayId,
      now,
      leaseDurationMs: this.options.claimLeaseMs,
    });
    if (event === null) return { kind: "idle" };

    const message = parseExecutionDispatchMessage(event.payload, {
      now,
      verificationKeys: this.options.verificationKeys,
    });
    if (!message.ok) {
      await this.retry(event, now);
      return {
        kind: "retried",
        eventId: event.eventId,
        attempts: event.attempts,
        reason: "invalid_payload",
      };
    }

    try {
      await this.sink.deliver(message.value);
      await this.repository.acknowledge({ eventId: event.eventId, relayId: this.options.relayId });
      return { kind: "delivered", eventId: event.eventId, attempts: event.attempts };
    } catch {
      await this.retry(event, now);
      return {
        kind: "retried",
        eventId: event.eventId,
        attempts: event.attempts,
        reason: "sink_failure",
      };
    }
  }

  private async retry(event: ClaimedOutboxEvent, now: string): Promise<void> {
    const base = this.options.retryBaseMs ?? 100;
    const delay = Math.min(base * 2 ** Math.min(event.attempts - 1, 9), 60_000);
    await this.repository.retry({
      eventId: event.eventId,
      relayId: this.options.relayId,
      availableAt: new Date(Date.parse(now) + delay).toISOString(),
    });
  }
}

function isPool(value: OutboxRelayRepository | Pool): value is Pool {
  return typeof (value as Pool).connect === "function";
}
