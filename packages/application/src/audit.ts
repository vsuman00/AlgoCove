import type { Instant, LearnerId, OpaqueId } from "@algocove/domain";
import { redactPayload, type SafePayload } from "./platform-safety.ts";

export type AuditEvent = {
  readonly eventId: OpaqueId<"event">;
  readonly actorId: LearnerId | null;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string | null;
  readonly payload: SafePayload;
  readonly occurredAt: Instant;
};

export type AuditEventInput = Omit<AuditEvent, "payload"> & { readonly payload?: unknown };

export function createAuditEvent(input: AuditEventInput): AuditEvent {
  return { ...input, payload: redactPayload(input.payload ?? {}) };
}

export type AuditEventRepository = {
  append(event: AuditEvent): Promise<void>;
};
