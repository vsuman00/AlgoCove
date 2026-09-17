import { err, isAtOrAfter, ok, type Instant, type LearnerId, type OpaqueId, type Result } from "./primitives.ts";
import type { Role } from "./roles.ts";

export type SessionStatus = "active" | "revoked";

export type SessionRecord = {
  readonly sessionId: OpaqueId<"session">;
  readonly userId: LearnerId;
  readonly roles: readonly Role[];
  readonly createdAt: Instant;
  readonly expiresAt: Instant;
  readonly revokedAt: Instant | null;
};

export type SessionFailure = {
  readonly code: "session_not_active";
  readonly message: string;
};

/** A session is usable only while it is unrevoked and strictly before expiry. */
export function sessionStatus(record: Pick<SessionRecord, "expiresAt" | "revokedAt">, now: Instant): SessionStatus {
  return record.revokedAt !== null || isAtOrAfter(now, record.expiresAt) ? "revoked" : "active";
}

export function assertActiveSession(record: SessionRecord, now: Instant): Result<SessionRecord, SessionFailure> {
  if (sessionStatus(record, now) !== "active") {
    return err({
      code: "session_not_active",
      message: "Session is expired or revoked.",
    });
  }
  return ok(record);
}

export function revokeSession(record: SessionRecord, now: Instant): Result<SessionRecord, SessionFailure> {
  if (record.revokedAt !== null) {
    return err({ code: "session_not_active", message: "Session is already revoked." });
  }
  return ok({ ...record, revokedAt: now });
}
