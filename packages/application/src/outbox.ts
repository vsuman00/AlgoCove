import type { Instant, OpaqueId } from "@algocove/domain";
import { redactPayload, type SafePayload } from "./platform-safety.ts";

export type OutboxEvent = {
  readonly eventId: OpaqueId<"event">;
  readonly topic: string;
  readonly aggregateId: string;
  readonly payload: SafePayload;
  readonly occurredAt: Instant;
};

export type OutboxEventInput = Omit<OutboxEvent, "payload"> & { readonly payload: unknown };

export function createOutboxEvent(input: OutboxEventInput): OutboxEvent {
  return { ...input, payload: redactPayload(input.payload) };
}

export type OutboxEventRepository = {
  enqueue(event: OutboxEvent): Promise<void>;
};
