import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createExecutionDispatchMessage,
  createExecutionControl,
  createExecutionControlServer,
  createInternalAuthenticator,
  createSqliteExecutionJournal,
  startLoopbackExecutionRelay,
  type ExecutionJournal,
  type ExecutionDispatchMessage,
} from "@algocove/execution-control";
import { OutboxRelay } from "../../apps/worker/src/outbox-relay.ts";
import { createLocalExecutionControlSink } from "../../apps/worker/src/execution-control-sink.ts";
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
  it.each([
    ["rejected authentication", new Response(null, { status: 401 })],
    [
      "another run's receipt",
      Response.json({
        ok: true,
        value: {
          runId: "run_other",
          quotaKey: "learner:usr_aaaaaaaaaaaaaaaa",
          profileId: "javascript-default",
          replayed: false,
        },
      }),
    ],
  ])("does not acknowledge %s", async (_name, response) => {
    const store = repository(event(messagePayload()));
    const relay = new OutboxRelay(
      store,
      createLocalExecutionControlSink({
        endpoint: "http://127.0.0.1:12345/internal/execution/control",
        token: "relay-secret-2026",
        now: () => now,
        fetch: async () => response,
      }),
      {
        relayId: "relay-a",
        verificationKeys: new Map([[verificationKey.keyId, verificationKey]]),
        claimLeaseMs: 1000,
      },
    );
    expect(await relay.pumpOnce(now)).toMatchObject({ kind: "retried", reason: "sink_failure" });
    expect(store.acknowledged).toEqual([]);
    expect(store.retried).toEqual(["evt_aaaaaaaaaaaaaaaa"]);
  });

  it("requires a loopback control URL for local dispatch", () => {
    expect(() =>
      createLocalExecutionControlSink({
        endpoint: "https://external.example/internal/execution/control",
        token: "relay-secret-2026",
      }),
    ).toThrow("loopback control endpoint");
  });

  it("replays a lost HTTP admission response after control restart without leasing twice", async () => {
    const directory = mkdtempSync(join(tmpdir(), "algocove-relay-"));
    const path = join(directory, "control.sqlite");
    const payload = messagePayload();
    const makeControl = (journal: ExecutionJournal) =>
      createExecutionControl({
        verificationKeys: new Map([[verificationKey.keyId, verificationKey]]),
        terminalSigningKeys: new Map([[signingKey.keyId, signingKey]]),
        orphanTimeoutMs: 1000,
        maxQueuePerQuota: 2,
        journal,
      });
    const authenticator = createInternalAuthenticator({
      "application-relay": "relay-secret-2026",
      "execution-worker": "worker-secret-2026",
      "execution-operator": "operator-secret-2026",
    });
    const relayOptions = {
      relayId: "relay-a",
      verificationKeys: new Map([[verificationKey.keyId, verificationKey]]),
      claimLeaseMs: 1000,
    };
    let journal = createSqliteExecutionJournal(path);
    let transport = await startLoopbackExecutionRelay(
      createExecutionControlServer(makeControl(journal), authenticator),
    );
    try {
      const firstStore = repository(event(payload));
      const firstRelay = new OutboxRelay(
        firstStore,
        createLocalExecutionControlSink({
          endpoint: transport.url,
          token: "relay-secret-2026",
          now: () => now,
          fetch: async (input, init) => {
            const response = await fetch(input, init);
            expect(response.status).toBe(200);
            await response.json();
            throw new Error("admission response lost");
          },
        }),
        relayOptions,
      );
      expect(await firstRelay.pumpOnce(now)).toMatchObject({
        kind: "retried",
        reason: "sink_failure",
      });
      expect(firstStore.acknowledged).toEqual([]);
      expect(journal.list()).toHaveLength(1);
      expect(JSON.stringify(journal.list())).not.toContain("private learner source");
      await transport.close();
      journal.close();

      journal = createSqliteExecutionJournal(path);
      const restored = makeControl(journal);
      transport = await startLoopbackExecutionRelay(
        createExecutionControlServer(restored, authenticator),
      );
      const retryStore = repository(event(payload));
      const retryRelay = new OutboxRelay(
        retryStore,
        createLocalExecutionControlSink({
          endpoint: transport.url,
          token: "relay-secret-2026",
          now: () => now,
        }),
        relayOptions,
      );
      expect(await retryRelay.pumpOnce(now)).toMatchObject({ kind: "delivered" });
      expect(retryStore.acknowledged).toEqual(["evt_aaaaaaaaaaaaaaaa"]);
      expect(journal.list()).toHaveLength(1);
      expect(restored.leaseNext({ workerId: "worker-a", now, leaseDurationMs: 900 })).toMatchObject(
        { ok: true, value: { runId: payload.descriptor.payload.runId } },
      );
      expect(restored.leaseNext({ workerId: "worker-b", now, leaseDurationMs: 900 })).toEqual({
        ok: true,
        value: null,
      });
    } finally {
      await transport.close();
      journal.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

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
