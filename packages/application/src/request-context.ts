import {
  formatId,
  isId,
  isPrivilegedRole,
  parseId,
  parseInstant,
  parseRole,
  type IdKind,
  type LearnerId,
  type OpaqueId,
  type Instant,
  type Role,
} from "@algocove/domain";
import { authenticationRequired, authorizationError, validationError } from "./errors.ts";

/**
 * Request context and the ports that supply non-deterministic values.
 *
 * Every use case takes a `RequestContext` as its first argument. The context is
 * assembled on the server from the session, so:
 *
 * - the actor identity and roles can never be supplied by the browser;
 * - stored time comes from an injected clock, never from a client payload;
 * - identifiers are generated through an injected generator, so tests are
 *   deterministic and production keeps one entropy source.
 */

/** Source of server time. The only way a use case may learn "now". */
export type Clock = {
  now(): Instant;
};

export function createSystemClock(): Clock {
  return {
    now(): Instant {
      const parsed = parseInstant(new Date());
      if (!parsed.ok) {
        // Unreachable for a valid Date; failing loudly beats storing bad time.
        throw new Error(`System clock produced an invalid instant: ${parsed.error.message}`);
      }
      return parsed.value;
    },
  };
}

/** Fixed clock for tests and fixtures. */
export function createFixedClock(instant: Instant): Clock {
  return { now: () => instant };
}

/** Source of opaque identifiers. */
export type IdGenerator = {
  generate<TKind extends IdKind>(kind: TKind): OpaqueId<TKind>;
};

/** Deterministic identifier generator for tests and fixtures. */
export function createSequenceIdGenerator(seed = 1): IdGenerator {
  let counter = seed;
  return {
    generate<TKind extends IdKind>(kind: TKind): OpaqueId<TKind> {
      const entropy = counter.toString(32).padStart(16, "0");
      counter += 1;
      const formatted = formatId(kind, entropy);
      if (!formatted.ok) {
        throw new Error(
          `Identifier generator produced invalid entropy: ${formatted.error.message}`,
        );
      }
      return formatted.value;
    },
  };
}

export type Actor = {
  readonly userId: LearnerId;
  readonly sessionId: OpaqueId<"session">;
  readonly roles: readonly Role[];
  readonly privileged: boolean;
};

/**
 * Build an actor from verified server-side session data.
 *
 * Role strings are validated here, not trusted: an unknown or browser-supplied
 * role fails the request instead of widening access.
 */
export function createActor(input: {
  readonly userId: unknown;
  readonly sessionId: unknown;
  readonly roles: readonly unknown[];
}): Actor {
  const userId = parseId("learner", input.userId);
  if (!userId.ok) {
    throw authenticationRequired("Session does not identify a learner.");
  }
  const sessionId = parseId("session", input.sessionId);
  if (!sessionId.ok) {
    throw authenticationRequired("Session is not a recognized AlgoCove session.");
  }
  const roles = input.roles.map((candidate) => {
    const parsed = parseRole(candidate);
    if (!parsed.ok) {
      throw validationError("Session carries an unrecognized role.");
    }
    return parsed.value;
  });
  if (roles.length === 0) {
    throw validationError("Session carries no roles.");
  }
  return {
    userId: userId.value,
    sessionId: sessionId.value,
    roles: [...new Set(roles)],
    privileged: roles.some(isPrivilegedRole),
  };
}

export type RequestContext = {
  readonly actor: Actor;
  /** Server-controlled request time. */
  readonly now: Instant;
  readonly requestId: OpaqueId<"request">;
  /** Server-owned identifier source for new aggregate versions. */
  readonly ids: IdGenerator;
  readonly traceId: string;
  /** Environment/service label used by logs and telemetry. */
  readonly serviceName: string;
};

export type CreateRequestContextInput = {
  readonly actor: Actor;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly serviceName: string;
  /** Upstream correlation value when present; regenerated when absent or unsafe. */
  readonly traceId?: string;
};

const TRACE_ID_PATTERN = /^[A-Za-z0-9._-]{8,64}$/;

export function createRequestContext(input: CreateRequestContextInput): RequestContext {
  const requestId = input.ids.generate("request");
  const traceId =
    input.traceId !== undefined && TRACE_ID_PATTERN.test(input.traceId) ? input.traceId : requestId;
  return {
    actor: input.actor,
    now: input.clock.now(),
    requestId,
    ids: input.ids,
    traceId,
    serviceName: input.serviceName,
  };
}

export function hasRole(context: RequestContext, role: Role): boolean {
  return context.actor.roles.includes(role);
}

/** Fail closed when the actor lacks a required role. */
export function requireRole(context: RequestContext, role: Role): void {
  if (!hasRole(context, role)) {
    throw authorizationError("This operation requires a role the actor does not hold.");
  }
}

/**
 * Ownership check for learner-owned resources. Missing ownership is reported as
 * "not found" so an actor cannot probe for another learner's resources.
 */
export function requireOwnership(context: RequestContext, ownerId: unknown): void {
  if (!isId("learner", ownerId) || ownerId !== context.actor.userId) {
    throw authorizationError("Resource is not available to this actor.");
  }
}
