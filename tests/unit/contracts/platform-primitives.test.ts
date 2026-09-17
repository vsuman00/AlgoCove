import { describe, expect, it } from "vitest";
import {
  createAuditEvent,
  createOutboxEvent,
  executeIdempotently,
  type IdempotencyRepository,
} from "@algocove/application";
import { formatId, parseContentChecksum, parseInstant } from "@algocove/domain";

const event = formatId("event", "0000000000000001");
const learner = formatId("learner", "0000000000000002");
const instant = parseInstant("2026-09-17T10:00:00.000Z");
const hash = parseContentChecksum(`sha256:${"a".repeat(64)}`);

if (!event.ok || !learner.ok || !instant.ok || !hash.ok)
  throw new Error("platform fixtures are invalid");

function memoryIdempotency(): IdempotencyRepository {
  const claims = new Map<
    string,
    {
      hash: string;
      state: "pending" | "completed" | "failed";
      response?: { status: number; body: Record<string, unknown> };
    }
  >();
  return {
    async claim(input) {
      const key = `${input.scope}:${input.key}`;
      const existing = claims.get(key);
      if (existing === undefined) {
        claims.set(key, { hash: input.requestHash, state: "pending" });
        return { kind: "claimed" };
      }
      if (existing.hash !== input.requestHash) return { kind: "conflict" };
      if (existing.state === "completed" && existing.response !== undefined)
        return { kind: "replay", response: existing.response };
      if (existing.state === "pending") return { kind: "in_progress" };
      existing.state = "pending";
      return { kind: "claimed" };
    },
    async complete(input) {
      const claim = claims.get(`${input.scope}:${input.key}`);
      if (claim === undefined) throw new Error("missing claim");
      claim.state = "completed";
      claim.response = input.response;
    },
    async fail(input) {
      const claim = claims.get(`${input.scope}:${input.key}`);
      if (claim !== undefined) claim.state = "failed";
    },
  };
}

describe("platform primitives", () => {
  it("redacts source material and secret-shaped values while retaining safe metadata", () => {
    const audit = createAuditEvent({
      eventId: event.value,
      actorId: learner.value,
      action: "profile.updated",
      resourceType: "learner_profile",
      resourceId: learner.value,
      occurredAt: instant.value,
      payload: {
        version: 2,
        code: "console.log('do not persist')",
        prompt: "private prompt",
        authorization: "Bearer secret-value",
        outcome: "accepted",
      },
    });
    const outbox = createOutboxEvent({
      eventId: event.value,
      topic: "learner.profile.updated",
      aggregateId: learner.value,
      occurredAt: instant.value,
      payload: { outcome: "accepted", source: "private source" },
    });
    const serialized = JSON.stringify({ audit, outbox });
    expect(serialized).not.toContain("console.log");
    expect(serialized).not.toContain("private prompt");
    expect(serialized).not.toContain("secret-value");
    expect(serialized).toContain("accepted");
  });

  it("claims an effect once and replays the stored response", async () => {
    const repository = memoryIdempotency();
    let calls = 0;
    const input = { scope: "profile", key: "request-1", requestHash: hash.value };
    const first = await executeIdempotently(repository, input, async () => {
      calls += 1;
      return { status: 201, body: { version: 1 } };
    });
    const second = await executeIdempotently(repository, input, async () => {
      calls += 1;
      return { status: 201, body: { version: 2 } };
    });
    expect(first).toMatchObject({ status: 201, replayed: false });
    expect(second).toMatchObject({ status: 201, body: { version: 1 }, replayed: true });
    expect(calls).toBe(1);
  });

  it("rejects hash reuse and exposes no request data in the conflict", async () => {
    const repository = memoryIdempotency();
    const input = { scope: "profile", key: "request-2", requestHash: hash.value };
    await executeIdempotently(repository, input, async () => ({ status: 200, body: { ok: true } }));
    const otherHash = parseContentChecksum(`sha256:${"b".repeat(64)}`);
    if (!otherHash.ok) throw new Error("hash fixture is invalid");
    await expect(
      executeIdempotently(repository, { ...input, requestHash: otherHash.value }, async () => ({
        status: 200,
        body: {},
      })),
    ).rejects.toMatchObject({ code: "version_conflict" });
  });
});
