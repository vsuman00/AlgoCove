import { describe, expect, it } from "vitest";
import {
  createActor,
  createFixedClock,
  createRequestContext,
  createSequenceIdGenerator,
  requireOwnership,
  requireRole,
  toErrorEnvelope,
  type Actor,
} from "@algocove/application";
import { formatId, parseInstant, ROLES } from "@algocove/domain";

const learnerId = formatId("learner", "0".repeat(16));
const sessionId = formatId("session", "1".repeat(16));
const fixedInstant = parseInstant("2026-09-17T09:30:00Z");

if (!learnerId.ok || !sessionId.ok || !fixedInstant.ok) {
  throw new Error("test fixture identifiers must be valid");
}

const actor: Actor = createActor({
  userId: learnerId.value,
  sessionId: sessionId.value,
  roles: [ROLES.learner, ROLES.learner],
});

describe("request context", () => {
  it("builds server-owned identity, time, and correlation values", () => {
    const context = createRequestContext({
      actor,
      clock: createFixedClock(fixedInstant.value),
      ids: createSequenceIdGenerator(),
      serviceName: "algocove-web",
      traceId: "trace-1234",
    });

    expect(context.actor).toEqual(actor);
    expect(context.now).toBe(fixedInstant.value);
    expect(context.requestId).toMatch(/^req_[0-9a-hjkmnp-tv-z]{16,52}$/);
    expect(context.traceId).toBe("trace-1234");
  });

  it("regenerates unsafe correlation values and rejects forged actor data", () => {
    const context = createRequestContext({
      actor,
      clock: createFixedClock(fixedInstant.value),
      ids: createSequenceIdGenerator(),
      serviceName: "algocove-web",
      traceId: "contains spaces",
    });

    expect(context.traceId).toBe(context.requestId);
    expect(() =>
      createActor({ userId: learnerId.value, sessionId: sessionId.value, roles: ["root"] }),
    ).toThrow("unrecognized role");
  });

  it("enforces role and ownership checks without revealing another learner", () => {
    const context = createRequestContext({
      actor,
      clock: createFixedClock(fixedInstant.value),
      ids: createSequenceIdGenerator(),
      serviceName: "algocove-web",
    });

    expect(() => requireRole(context, ROLES.author)).toThrow("requires a role");
    expect(() => requireOwnership(context, "usr_wrong")).toThrow("not available");
  });
});

describe("error contract", () => {
  it("removes secret-shaped details and unknown causes from public envelopes", () => {
    const envelope = toErrorEnvelope(
      new Error("postgres://admin:password@db.internal/algocove"),
      "req_0000000000000000",
    );

    expect(envelope).toEqual({
      error: {
        code: "internal_error",
        category: "internal",
        message: "Unexpected failure.",
        traceId: "req_0000000000000000",
        retryable: false,
      },
    });
    expect(JSON.stringify(envelope)).not.toContain("password");
  });
});
