import { describe, expect, it, vi } from "vitest";
import { MasteryOutboxRelay } from "../../apps/worker/src/mastery-relay.ts";
import {
  ASSESSMENT_TOPIC,
  createFixedClock,
  createSequenceIdGenerator,
  type MasteryIngestionPorts,
} from "@algocove/application";
import {
  formatId,
  parseInstant,
  parseContentChecksum,
  projectMastery,
  type Result,
} from "@algocove/domain";
import type { ClaimedOutboxEvent, OutboxRelayRepository } from "@algocove/db";
function must<T, F>(r: Result<T, F>): T {
  if (!r.ok) throw new Error("Invalid relay fixture.");
  return r.value;
}
const now = must(parseInstant("2026-10-02T10:00:00.000Z"));
const eventId = must(formatId("event", "aaaaaaaaaaaaaaaa")),
  learnerId = must(formatId("learner", "aaaaaaaaaaaaaaaa")),
  conceptId = must(formatId("concept", "aaaaaaaaaaaaaaaa"));
function fixture(fail = false) {
  let pending: ClaimedOutboxEvent | null = {
    eventId,
    topic: ASSESSMENT_TOPIC,
    aggregateId: "attempt",
    payload: { passed: false, assistanceTier: 6 },
    occurredAt: now,
    attempts: 1,
  };
  const outbox: OutboxRelayRepository = {
    claimNext: vi.fn(async () => pending),
    acknowledge: vi.fn(async () => {
      pending = null;
    }),
    retry: vi.fn(async () => {
      if (pending !== null) pending = { ...pending, attempts: pending.attempts + 1 };
    }),
    deadLetter: vi.fn(async () => {
      pending = null;
    }),
  };
  const source = vi.fn(async () => ({
    sourceEventId: eventId,
    classification: "success" as const,
    observation: {
      observationId: eventId,
      learnerId,
      attemptId: must(formatId("attempt", "aaaaaaaaaaaaaaaa")),
      runId: must(formatId("codeRun", "aaaaaaaaaaaaaaaa")),
      problemVersionId: must(formatId("problemVersion", "aaaaaaaaaaaaaaaa")),
      manifestId: must(formatId("languageManifest", "aaaaaaaaaaaaaaaa")),
      language: "python" as const,
      sourceChecksum: must(parseContentChecksum(`sha256:${"a".repeat(64)}`)),
      resultId: "result",
      terminalCategory: "pass" as const,
      passed: true,
      observedAt: now,
      assistanceTier: 0,
      assistanceCapturedAt: now,
    },
  }));
  const record = vi.fn<MasteryIngestionPorts["mastery"]["recordAndProject"]>(async (input) => {
    if (fail) throw new Error("database unavailable");
    return {
      disposition: "committed",
      projections: [must(projectMastery({ learnerId, conceptId, evidence: input.evidence }))],
    };
  });
  const ports: MasteryIngestionPorts = {
    practice: { loadAssessment: source },
    curriculum: { getConcepts: async () => [conceptId] },
    mastery: { recordAndProject: record, rebuild: vi.fn(), readView: vi.fn() },
  };
  const relay = new MasteryOutboxRelay(outbox, ports, {
    relayId: "mastery-test",
    clock: createFixedClock(now),
    ids: createSequenceIdGenerator(100),
    maxAttempts: 2,
  });
  return { relay, outbox, source, record, ports };
}
describe("mastery outbox delivery", () => {
  it("loads committed source facts by ID and ignores a forged claimed payload", async () => {
    const f = fixture();
    expect(await f.relay.pumpOnce()).toMatchObject({ kind: "delivered" });
    expect(f.source).toHaveBeenCalledWith(eventId);
    expect(f.record.mock.calls[0]![0].evidence[0]).toMatchObject({
      correct: true,
      assistanceTier: 0,
      confidence: null,
      transfer: null,
    });
    expect(await f.relay.pumpOnce()).toEqual({ kind: "idle" });
  });
  it("retries source effects after a lost acknowledgement and caps repeated failures", async () => {
    const f = fixture();
    vi.mocked(f.outbox.acknowledge).mockRejectedValueOnce(new Error("lost response"));
    expect(await f.relay.pumpOnce()).toMatchObject({ kind: "retried" });
    expect(await f.relay.pumpOnce()).toMatchObject({ kind: "delivered" });
    expect(f.record).toHaveBeenCalledTimes(2);
    const failure = fixture(true);
    expect(await failure.relay.pumpOnce()).toMatchObject({ kind: "retried" });
    expect(await failure.relay.pumpOnce()).toMatchObject({ kind: "dead_lettered" });
    expect(failure.outbox.deadLetter).toHaveBeenCalledWith({
      eventId,
      relayId: "mastery-test",
      reason: "retry_exhausted",
    });
  });
  it("leaves unmapped assessments pending without inventing concept evidence", async () => {
    const f = fixture();
    f.ports.curriculum.getConcepts = async () => [];
    expect(await f.relay.pumpOnce()).toMatchObject({ kind: "retried" });
    expect(f.record).not.toHaveBeenCalled();
  });
});
