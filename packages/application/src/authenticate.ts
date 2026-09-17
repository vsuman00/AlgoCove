import {
  assertActiveSession,
  type Instant,
  type LearnerId,
  type OpaqueId,
} from "@algocove/domain";
import { authenticationRequired, validationError } from "./errors.ts";
import { createActor, type Actor } from "./request-context.ts";

export type StoredSession = {
  readonly sessionId: OpaqueId<"session">;
  readonly userId: LearnerId;
  /** Roles are loaded by the server-side session store, never from a request body. */
  readonly roles: readonly unknown[];
  readonly expiresAt: Instant;
  readonly revokedAt: Instant | null;
};

export type SessionStore = {
  findByTokenHash(tokenHash: string): Promise<StoredSession | null>;
  revoke(sessionId: OpaqueId<"session">, revokedAt: Instant): Promise<void>;
};

export type TokenHasher = {
  hash(token: string): string;
};

export function createSessionActor(session: StoredSession): Actor {
  return createActor({
    userId: session.userId,
    sessionId: session.sessionId,
    roles: session.roles,
  });
}

export async function authenticateSession(input: {
  readonly token: unknown;
  readonly tokenHasher: TokenHasher;
  readonly store: SessionStore;
  readonly now: Instant;
}): Promise<Actor> {
  if (typeof input.token !== "string" || input.token.length < 32 || input.token.length > 256) {
    throw authenticationRequired();
  }
  const session = await input.store.findByTokenHash(input.tokenHasher.hash(input.token));
  if (session === null) {
    throw authenticationRequired();
  }
  const parsed = assertActiveSession(
    {
      sessionId: session.sessionId,
      userId: session.userId,
      roles: [],
      createdAt: session.expiresAt,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
    },
    input.now,
  );
  if (!parsed.ok) {
    throw authenticationRequired();
  }
  return createSessionActor(session);
}

export async function revokeSession(input: {
  readonly session: StoredSession;
  readonly store: SessionStore;
  readonly now: Instant;
}): Promise<void> {
  if (input.session.revokedAt !== null) {
    throw validationError("Session is already revoked.");
  }
  await input.store.revoke(input.session.sessionId, input.now);
}
