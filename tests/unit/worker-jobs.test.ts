import { describe, expect, it, vi } from "vitest";
import { createFixedClock, parseWorkerJobDescriptor } from "@algocove/application";
import { parseInstant } from "@algocove/domain";
import type { ClaimedOutboxEvent, OutboxRelayRepository } from "@algocove/db";
import { WorkerJobRegistry, type WorkerJobHandler } from "../../apps/worker/src/job-registry.ts";
import { WorkerJobRelay } from "../../apps/worker/src/job-relay.ts";
const instant = parseInstant("2026-10-06T10:00:00.000Z");
if (!instant.ok) throw Error();
const now = instant.value;
function fixture(input: Partial<ClaimedOutboxEvent> = {}) {
  const event: ClaimedOutboxEvent = {
    eventId: "evt_aaaaaaaaaaaaaaaa",
    topic: "evaluation.requested",
    aggregateId: "config.v1",
    payload: { schemaVersion: 1, configurationId: "config.v1", suiteVersion: "suite.v1" },
    occurredAt: now,
    attempts: 1,
    ...input,
  };
  const repo: OutboxRelayRepository = {
    claimNext: vi.fn(async () => event),
    acknowledge: vi.fn(async () => undefined),
    retry: vi.fn(async () => undefined),
    deadLetter: vi.fn(async () => undefined),
  };
  const handle = vi.fn(async () => undefined);
  const handler: WorkerJobHandler = {
    topic: "evaluation.requested",
    validate: (e) => {
      parseWorkerJobDescriptor(e.topic, e.payload);
      return true;
    },
    handle,
  };
  const registry = new WorkerJobRegistry([handler]);
  const relay = new WorkerJobRelay(repo, registry, {
    relayId: "job-test",
    clock: createFixedClock(now),
    maxAttempts: 2,
  });
  return { repo, handle, registry, relay, event };
}
describe("worker dispatch contracts", () => {
  it("only claims registered topics and fences acknowledgement after effects", async () => {
    const f = fixture();
    expect(await f.relay.pumpOnce()).toMatchObject({ kind: "delivered" });
    expect(f.handle).toHaveBeenCalledWith(f.event);
    expect(f.repo.acknowledge).toHaveBeenCalledWith({
      eventId: f.event.eventId,
      relayId: "job-test",
      expectedAttempts: 1,
    });
    expect(vi.mocked(f.handle).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(f.repo.acknowledge).mock.invocationCallOrder[0]!,
    );
  });
  it("leaves unregistered jobs pending", async () => {
    const f = fixture();
    const relay = new WorkerJobRelay(f.repo, new WorkerJobRegistry([]), {
      relayId: "job-test",
      clock: createFixedClock(now),
    });
    expect(await relay.pumpOnce()).toEqual({ kind: "idle" });
    expect(f.repo.claimNext).not.toHaveBeenCalled();
  });
  it("rejects duplicate registrations", () => {
    const h: WorkerJobHandler = {
      topic: "evaluation.requested",
      validate: () => true,
      handle: async () => undefined,
    };
    expect(() => new WorkerJobRegistry([h, h])).toThrow();
  });
  it.each([
    {
      payload: {
        schemaVersion: 1,
        configurationId: "config.v1",
        suiteVersion: "suite.v1",
        source: "private",
      },
    },
    { eventId: "invalid" },
    { topic: "wrong.topic" },
  ])("dead letters poison without calling the consumer %j", async (input) => {
    const f = fixture(input);
    expect(await f.relay.pumpOnce()).toMatchObject({
      kind: "dead_lettered",
      reason: "invalid_source",
    });
    expect(f.handle).not.toHaveBeenCalled();
  });
  it("retries handler failures with safe reasons", async () => {
    const f = fixture();
    f.handle.mockRejectedValueOnce(Error("private provider token"));
    const r = await f.relay.pumpOnce();
    expect(r).toMatchObject({ kind: "retried", reason: "handler_failure" });
    expect(JSON.stringify(r)).not.toContain("private");
    expect(f.repo.retry).toHaveBeenCalledWith(
      expect.objectContaining({ expectedAttempts: 1, availableAt: "2026-10-06T10:00:01.000Z" }),
    );
  });
  it("caps automatic failures", async () => {
    const f = fixture({ attempts: 2 });
    f.handle.mockRejectedValue(Error());
    expect(await f.relay.pumpOnce()).toMatchObject({
      kind: "dead_lettered",
      reason: "retry_exhausted",
    });
    expect(f.repo.retry).not.toHaveBeenCalled();
  });
  it("replay grants a retry budget without resetting the lifetime fence", async () => {
    const f = fixture({ attempts: 9, deliveryAttempts: 1 });
    f.handle.mockRejectedValue(Error());
    expect(await f.relay.pumpOnce()).toMatchObject({ kind: "retried" });
    expect(f.repo.retry).toHaveBeenCalledWith(expect.objectContaining({ expectedAttempts: 9 }));
  });
  it("propagates lost ack without changing delivery state", async () => {
    const f = fixture();
    vi.mocked(f.repo.acknowledge).mockRejectedValueOnce(Error("lost ack"));
    await expect(f.relay.pumpOnce()).rejects.toThrow("lost ack");
    expect(f.repo.retry).not.toHaveBeenCalled();
    expect(f.repo.deadLetter).not.toHaveBeenCalled();
  });
  it.each([0, 1001, 1.1])("rejects an invalid batch bound %s", async (limit) => {
    await expect(fixture().relay.pumpBatch(limit)).rejects.toThrow();
  });
  it("round robins registered topics", async () => {
    const f = fixture();
    const order: string[] = [];
    vi.mocked(f.repo.claimNext).mockImplementation(async (i) => {
      order.push(i.topic);
      return null;
    });
    const registry = new WorkerJobRegistry(
      ["evaluation.requested", "platform.reconciliation.requested"].map((topic) => ({
        topic: topic as WorkerJobHandler["topic"],
        validate: () => true,
        handle: async () => undefined,
      })),
    );
    await new WorkerJobRelay(f.repo, registry, {
      relayId: "job-test",
      clock: createFixedClock(now),
    }).pumpOnce();
    expect(order).toEqual(registry.topics);
  });
  it.each([
    ["privacy.retention.requested", { schemaVersion: 1, scope: "delete_accounts", limit: 1 }],
    [
      "platform.reconciliation.requested",
      { schemaVersion: 1, scope: "outbox_and_derivations", limit: 501 },
    ],
    [
      "content.derivation.requested",
      {
        schemaVersion: 1,
        contentVersionId: "cnt_aaaaaaaaaaaaaaaa",
        sourceChecksum: "invalid",
        policyVersion: "v1",
      },
    ],
    ["evaluation.requested", { schemaVersion: 2, configurationId: "v1", suiteVersion: "v1" }],
  ])("rejects unsafe descriptors for %s", (topic, payload) =>
    expect(() => parseWorkerJobDescriptor(topic, payload)).toThrow(),
  );
});
