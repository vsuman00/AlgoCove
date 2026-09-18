import { describe, expect, it } from "vitest";
import {
  createExecutionDispatchMessage,
  type ExecutionDispatchMessage,
} from "@algocove/execution-control";
import { OutboxRelay } from "../../apps/worker/src/outbox-relay.ts";
import { createHttpExecutionResultSink } from "../../apps/worker/src/execution-result-forwarder.ts";
import type { ClaimedOutboxEvent, OutboxRelayRepository } from "@algocove/db";
import {
  createRunDescriptor,
  generateSigningKeyPair,
  signRunDescriptor,
  type ExecutionLimits,
  type SignedExecutionResult,
  type SignedRunDescriptor,
  type VerificationKey,
} from "@algocove/execution-contracts";
import { formatId, type ContentChecksum, type Result } from "@algocove/domain";

const now = "2026-09-17T10:00:00.000Z";
const checksum =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as ContentChecksum;
const limits: ExecutionLimits = {
  compileTimeoutMs: 5_000,
  runTimeoutMs: 2_000,
  memoryLimitMb: 256,
  cpuLimitMillis: 7_000,
  pidLimit: 32,
  outputLimitBytes: 65_536,
  sourceLimitBytes: 1_048_576,
};
const signingKey = generateSigningKeyPair("worker-relay-2026");
const verificationKey: VerificationKey = {
  keyId: signingKey.keyId,
  publicKey: signingKey.publicKey,
  status: "active",
};

function must<T>(result: Result<T, unknown>): T {
  if (!result.ok) throw new Error("Invalid worker relay fixture.");
  return result.value;
}

function descriptor(): SignedRunDescriptor {
  const unsigned = createRunDescriptor({
    learner: { language: "javascript", source: "private learner source" },
    server: {
      runId: must(formatId("codeRun", "0000000000000011")),
      attemptId: must(formatId("attempt", "0000000000000011")),
      replayId: "relay-replay",
      problemVersionId: must(formatId("problemVersion", "0000000000000011")),
      manifestDigest: checksum,
      fixtureDigest: checksum,
      runtimeImageDigest: checksum,
      languageManifest: {
        language: "javascript",
        starterTemplate: "function solve(input) { return input; }",
        entrySignature: "function solve(input)",
        adapterId: "harness.javascript",
        limitsProfile: { compileTimeoutMs: 5_000, runTimeoutMs: 2_000, memoryLimitMb: 256 },
        fixtureIds: ["sample-1"],
      },
      limits,
      phasePlan: ["run"],
      policyVersion: 1,
      keyId: signingKey.keyId,
      leaseEpoch: 1,
      issuedAt: now,
      expiresAt: "2026-09-17T10:00:30.000Z",
    },
  });
  return must(signRunDescriptor(must(unsigned), signingKey));
}

function event(payload: unknown): ClaimedOutboxEvent {
  return {
    eventId: "evt_aaaaaaaaaaaaaaaa",
    topic: "execution.run.requested",
    aggregateId: "run_aaaaaaaaaaaaaaaa",
    payload: payload as Readonly<Record<string, unknown>>,
    occurredAt: now,
    attempts: 1,
  };
}

function repository(initial: ClaimedOutboxEvent): OutboxRelayRepository & {
  acknowledged: string[];
  retried: string[];
} {
  let pending: ClaimedOutboxEvent | null = initial;
  const state = {
    acknowledged: [] as string[],
    retried: [] as string[],
    async claimNext() {
      const claimed = pending;
      pending = null;
      return claimed;
    },
    async acknowledge(input: { eventId: string }) {
      state.acknowledged.push(input.eventId);
    },
    async retry(input: { eventId: string }) {
      state.retried.push(input.eventId);
    },
  };
  return state;
}

function messagePayload(): ExecutionDispatchMessage {
  const message = createExecutionDispatchMessage({
    dispatchKey: "dispatch-worker-relay",
    descriptor: descriptor(),
    quota: {
      quotaKey: "learner:usr_aaaaaaaaaaaaaaaa",
      profileId: "javascript-default",
      maxConcurrent: 1,
    },
    now,
    verificationKeys: new Map([[verificationKey.keyId, verificationKey]]),
  });
  return must(message);
}

describe("application outbox execution relay", () => {
  it("delivers a verified descriptor message and acknowledges it", async () => {
    const store = repository(event(messagePayload()));
    const delivered: ExecutionDispatchMessage[] = [];
    const relay = new OutboxRelay(
      store,
      {
        deliver: async (message) => {
          delivered.push(message);
        },
      },
      {
        relayId: "relay-a",
        verificationKeys: new Map([[verificationKey.keyId, verificationKey]]),
        claimLeaseMs: 1_000,
      },
    );

    await expect(relay.pumpOnce(now)).resolves.toEqual({
      kind: "delivered",
      eventId: "evt_aaaaaaaaaaaaaaaa",
      attempts: 1,
    });
    expect(delivered).toHaveLength(1);
    expect(store.acknowledged).toEqual(["evt_aaaaaaaaaaaaaaaa"]);
    expect(JSON.stringify(delivered[0])).not.toContain("private learner source");
  });

  it("releases a claim for retry when the execution-control sink fails", async () => {
    const store = repository(event(messagePayload()));
    const relay = new OutboxRelay(
      store,
      { deliver: async () => Promise.reject(new Error("sink unavailable")) },
      {
        relayId: "relay-a",
        verificationKeys: new Map([[verificationKey.keyId, verificationKey]]),
        claimLeaseMs: 1_000,
      },
    );

    await expect(relay.pumpOnce(now)).resolves.toMatchObject({
      kind: "retried",
      reason: "sink_failure",
      attempts: 1,
    });
    expect(store.retried).toEqual(["evt_aaaaaaaaaaaaaaaa"]);
  });

  it("sends only the signed result envelope to the authenticated application callback", async () => {
    const fetchMock = async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ Authorization: "Bearer callback-secret-2026" });
      expect(String(init?.body)).not.toContain("private learner source");
      return new Response(null, { status: 204 });
    };
    const sink = createHttpExecutionResultSink({
      endpoint: "http://execution-callback.test/api/internal/practice/results",
      token: "callback-secret-2026",
      fetch: fetchMock,
    });
    const result = {
      algorithm: "ed25519",
      keyId: "worker-relay-2026",
      payload: { resultId: "result-1" },
      signature: "signed-result",
    } as unknown as SignedExecutionResult;

    await expect(sink.deliver(result)).resolves.toBeUndefined();
  });
});
