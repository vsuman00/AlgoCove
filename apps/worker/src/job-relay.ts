import type { Clock } from "@algocove/application";
import { parseId } from "@algocove/domain";
import type { ClaimedOutboxEvent, OutboxRelayRepository } from "@algocove/db";
import type { WorkerJobRegistry } from "./job-registry.ts";

export type WorkerJobRelayOptions = {
  readonly relayId: string;
  readonly clock: Clock;
  readonly leaseMs?: number;
  readonly maxAttempts?: number;
  readonly retryBaseMs?: number;
};
export type WorkerJobRelayResult =
  | { readonly kind: "idle" }
  | {
      readonly kind: "delivered" | "retried" | "dead_lettered";
      readonly eventId: string;
      readonly topic: string;
      readonly attempts: number;
      readonly reason?: "invalid_source" | "retry_exhausted" | "handler_failure";
    };

/** Shares the existing application outbox; never runs inside an interactive route. */
export class WorkerJobRelay {
  private readonly repository: OutboxRelayRepository;
  private readonly registry: WorkerJobRegistry;
  private readonly options: Required<WorkerJobRelayOptions>;
  private cursor = 0;

  constructor(
    repository: OutboxRelayRepository,
    registry: WorkerJobRegistry,
    options: WorkerJobRelayOptions,
  ) {
    this.repository = repository;
    this.registry = registry;
    this.options = {
      ...options,
      leaseMs: options.leaseMs ?? 30000,
      maxAttempts: options.maxAttempts ?? 5,
      retryBaseMs: options.retryBaseMs ?? 1000,
    };
    const o = this.options;
    if (
      !/^[A-Za-z0-9._:-]{1,128}$/.test(o.relayId) ||
      !Number.isSafeInteger(o.leaseMs) ||
      o.leaseMs < 1000 ||
      o.leaseMs > 60000 ||
      !Number.isSafeInteger(o.maxAttempts) ||
      o.maxAttempts < 1 ||
      o.maxAttempts > 10 ||
      !Number.isSafeInteger(o.retryBaseMs) ||
      o.retryBaseMs < 1 ||
      o.retryBaseMs > 60000
    )
      throw new Error("Invalid worker job relay lease/retry options.");
  }

  async pumpOnce(): Promise<WorkerJobRelayResult> {
    const topics = this.registry.topics;
    for (let n = 0; n < topics.length; n++) {
      const topic = topics[this.cursor++ % topics.length]!;
      const now = this.options.clock.now();
      const event = await this.repository.claimNext({
        topic,
        relayId: this.options.relayId,
        now,
        leaseDurationMs: this.options.leaseMs,
      });
      if (!event) continue;
      const deliveryAttempts = event.deliveryAttempts ?? event.attempts;
      const handler = this.registry.get(topic)!;
      let valid = false;
      try {
        valid =
          event.topic === topic &&
          parseId("event", event.eventId).ok &&
          Number.isSafeInteger(deliveryAttempts) &&
          deliveryAttempts > 0 &&
          Number.isSafeInteger(event.attempts) &&
          event.attempts > 0 &&
          handler.validate(event);
      } catch {
        /* Invalid descriptors must not invoke the handler. */
      }
      if (!valid) return this.deadLetter(event, "invalid_source");
      try {
        await handler.handle(event);
      } catch {
        if (deliveryAttempts >= this.options.maxAttempts)
          return this.deadLetter(event, "retry_exhausted");
        const delay = Math.min(
          this.options.retryBaseMs * 2 ** Math.min(deliveryAttempts - 1, 9),
          60000,
        );
        await this.repository.retry({
          eventId: event.eventId,
          relayId: this.options.relayId,
          expectedAttempts: event.attempts,
          availableAt: new Date(Date.parse(this.options.clock.now()) + delay).toISOString(),
        });
        return {
          kind: "retried",
          eventId: event.eventId,
          topic,
          attempts: event.attempts,
          reason: "handler_failure",
        };
      }
      // Ack failure leaves committed effects retryable under the same event identity.
      // A stale claim must not turn ack failure into a retry/dead-letter mutation.
      await this.repository.acknowledge({
        eventId: event.eventId,
        relayId: this.options.relayId,
        expectedAttempts: event.attempts,
      });
      return { kind: "delivered", eventId: event.eventId, topic, attempts: event.attempts };
    }
    return { kind: "idle" };
  }

  async pumpBatch(limit = 100): Promise<readonly WorkerJobRelayResult[]> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
      throw new Error("Worker batch limit must be from 1 to 1000.");
    const results: WorkerJobRelayResult[] = [];
    for (let n = 0; n < limit; n++) {
      const result = await this.pumpOnce();
      results.push(result);
      if (result.kind === "idle") break;
    }
    return results;
  }

  private async deadLetter(
    event: ClaimedOutboxEvent,
    reason: "invalid_source" | "retry_exhausted",
  ): Promise<WorkerJobRelayResult> {
    await this.repository.deadLetter({
      eventId: event.eventId,
      relayId: this.options.relayId,
      expectedAttempts: event.attempts,
      reason,
    });
    return {
      kind: "dead_lettered",
      eventId: event.eventId,
      topic: event.topic,
      attempts: event.attempts,
      reason,
    };
  }
}
