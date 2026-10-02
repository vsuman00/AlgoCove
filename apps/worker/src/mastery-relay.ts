import {
  ASSESSMENT_TOPIC,
  consumePracticeAssessment,
  type Clock,
  type IdGenerator,
  type MasteryIngestionPorts,
} from "@algocove/application";
import { parseId } from "@algocove/domain";
import type { OutboxRelayRepository } from "@algocove/db";

export type MasteryRelayOptions = {
  readonly relayId: string;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly leaseMs?: number;
  readonly maxAttempts?: number;
  readonly retryBaseMs?: number;
};
export class MasteryOutboxRelay {
  private readonly repository: OutboxRelayRepository;
  private readonly ports: MasteryIngestionPorts;
  private readonly options: MasteryRelayOptions;
  constructor(
    repository: OutboxRelayRepository,
    ports: MasteryIngestionPorts,
    options: MasteryRelayOptions,
  ) {
    this.repository = repository;
    this.ports = ports;
    this.options = options;
    if (
      !/^[A-Za-z0-9._:-]{1,128}$/.test(options.relayId) ||
      !Number.isSafeInteger(options.leaseMs ?? 30000) ||
      (options.leaseMs ?? 30000) < 1000 ||
      (options.leaseMs ?? 30000) > 60000 ||
      !Number.isSafeInteger(options.maxAttempts ?? 5) ||
      (options.maxAttempts ?? 5) < 1 ||
      (options.maxAttempts ?? 5) > 10 ||
      !Number.isSafeInteger(options.retryBaseMs ?? 1000) ||
      (options.retryBaseMs ?? 1000) < 1
    )
      throw new Error("Invalid mastery relay lease/retry options.");
  }
  async pumpOnce(): Promise<{
    readonly kind: "idle" | "delivered" | "retried" | "dead_lettered";
    readonly eventId?: string;
  }> {
    const now = this.options.clock.now();
    const event = await this.repository.claimNext({
      topic: ASSESSMENT_TOPIC,
      relayId: this.options.relayId,
      now,
      leaseDurationMs: this.options.leaseMs ?? 30000,
    });
    if (event === null) return { kind: "idle" };
    const id = parseId("event", event.eventId);
    if (!id.ok || event.topic !== ASSESSMENT_TOPIC) {
      await this.repository.deadLetter({
        eventId: event.eventId,
        relayId: this.options.relayId,
        reason: "invalid_source",
      });
      return { kind: "dead_lettered", eventId: event.eventId };
    }
    try {
      // Ignore the claimed payload: load canonical practice facts by persisted ID.
      await consumePracticeAssessment({ now, ids: this.options.ids }, this.ports, id.value);
      await this.repository.acknowledge({ eventId: event.eventId, relayId: this.options.relayId });
      return { kind: "delivered", eventId: event.eventId };
    } catch {
      if (event.attempts >= (this.options.maxAttempts ?? 5)) {
        await this.repository.deadLetter({
          eventId: event.eventId,
          relayId: this.options.relayId,
          reason: "retry_exhausted",
        });
        return { kind: "dead_lettered", eventId: event.eventId };
      }
      const delay = Math.min(
        (this.options.retryBaseMs ?? 1000) * 2 ** Math.min(event.attempts - 1, 9),
        60000,
      );
      await this.repository.retry({
        eventId: event.eventId,
        relayId: this.options.relayId,
        availableAt: new Date(Date.parse(now) + delay).toISOString(),
      });
      return { kind: "retried", eventId: event.eventId };
    }
  }
}
