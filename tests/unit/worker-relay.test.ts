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
  createWebsiteExecutionRelay,
  startLoopbackWebsiteExecutionRelay,
  type ExecutionJournal,
  type ExecutionDispatchMessage,
} from "@algocove/execution-control";
import { OutboxRelay } from "../../apps/worker/src/outbox-relay.ts";
import { createLocalExecutionControlSink } from "../../apps/worker/src/execution-control-sink.ts";
import { createHttpExecutionRelay } from "../../apps/web/src/adapters/execution-client.ts";
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

function websiteRun(message: ExecutionDispatchMessage) {
  return {
    runId: message.descriptor.payload.runId,
    learnerId: must(formatId("learner", "0000000000000011")),
    attemptId: message.descriptor.payload.attemptId,
    problemVersionId: message.descriptor.payload.problemVersionId,
    manifestId: must(formatId("languageManifest", "0000000000000011")),
    language: message.descriptor.payload.language,
    mode: "run" as const,
    sourceChecksum: message.descriptor.payload.sourceDigest,
    sourceLength: Buffer.byteLength("private learner source"),
    requestedAt: message.descriptor.payload.issuedAt,
  };
}

describe("application outbox execution relay", () => {
  it("connects the website adapter to local preparation, dispatch and cancellation endpoints", async () => {
    const message = messagePayload();
    const run = websiteRun(message);
    let dispatches = 0;
    const cancelled: string[] = [];
    const relay = createWebsiteExecutionRelay({
      prepareDescriptor: () => message,
      verificationKeys: new Map([[verificationKey.keyId, verificationKey]]),
      now: () => now,
      host: {
        dispatch: async ({ source }) => {
          expect(source).toBe("private learner source");
          dispatches += 1;
          return { runId: run.runId, replayed: false };
        },
        cancel: async ({ runId }) => {
          cancelled.push(runId);
        },
      },
    });
    const transport = await startLoopbackWebsiteExecutionRelay(relay, "website-relay-secret-2026");
    try {
      const client = createHttpExecutionRelay({
        baseUrl: transport.baseUrl,
        token: "website-relay-secret-2026",
      });
      const prepared = await client.prepare({
        run,
        source: "private learner source",
        eventId: must(formatId("event", "0000000000000011")),
      });
      expect(JSON.stringify(prepared)).not.toContain("private learner source");
      expect(
        await client.dispatch({ run, source: "private learner source", preparation: prepared }),
      ).toEqual({ runId: run.runId, replayed: false });
      expect(
        await client.dispatch({ run, source: "private learner source", preparation: prepared }),
      ).toEqual({ runId: run.runId, replayed: true });
      expect(dispatches).toBe(1);
      await client.cancel({ runId: run.runId, reason: "learner" });
      expect(cancelled).toEqual([run.runId]);
      const rejected = await fetch(new URL("v1/runs/prepare", transport.baseUrl), {
        method: "POST",
        headers: { authorization: "Bearer wrong", "content-type": "application/json" },
        body: JSON.stringify({ run, eventId: "evt_0000000000000011" }),
      });
      expect(rejected.status).toBe(401);
      const injected = await fetch(new URL("v1/runs/prepare", transport.baseUrl), {
        method: "POST",
        headers: {
          authorization: "Bearer website-relay-secret-2026",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          run: { ...run, source: "private learner source" },
          eventId: "evt_0000000000000011",
        }),
      });
      expect(injected.status).toBe(400);
    } finally {
      await transport.close();
    }
  });

  it("never repeats an uncertain source dispatch", async () => {
    const message = messagePayload();
    const run = websiteRun(message);
    let dispatches = 0;
    const relay = createWebsiteExecutionRelay({
      prepareDescriptor: () => message,
      verificationKeys: new Map([[verificationKey.keyId, verificationKey]]),
      now: () => now,
      host: {
        dispatch: async () => {
          dispatches += 1;
          throw new Error("host response lost");
        },
        cancel: async () => undefined,
      },
    });
    const prepared = relay.prepare(run, must(formatId("event", "0000000000000011")));
    await expect(
      relay.dispatch(run.runId, prepared.dispatchToken, "private learner source"),
    ).rejects.toThrow("host response lost");
    await expect(
      relay.dispatch(run.runId, prepared.dispatchToken, "private learner source"),
    ).rejects.toThrow("host response lost");
    expect(dispatches).toBe(1);
  });

  it("rejects expired tokens and cancellation before preparation", async () => {
    const message = messagePayload();
    const run = websiteRun(message);
    let clock = now;
    let dispatches = 0;
    const relay = createWebsiteExecutionRelay({
      prepareDescriptor: () => message,
      verificationKeys: new Map([[verificationKey.keyId, verificationKey]]),
      now: () => clock,
      host: {
        dispatch: async () => {
          dispatches += 1;
          return { runId: run.runId, replayed: false };
        },
        cancel: async () => undefined,
      },
    });
    const prepared = relay.prepare(run, must(formatId("event", "0000000000000011")));
    clock = message.descriptor.payload.expiresAt;
    await expect(
      relay.dispatch(run.runId, prepared.dispatchToken, "private learner source"),
    ).rejects.toThrow("unavailable");
    const cancelledId = must(formatId("codeRun", "0000000000000012"));
    await relay.cancel(cancelledId, "learner");
    expect(() =>
      relay.prepare({ ...run, runId: cancelledId }, must(formatId("event", "0000000000000012"))),
    ).toThrow("unavailable");
    expect(dispatches).toBe(0);
  });

  it("prepares a source-free website descriptor and deduplicates source dispatch", async () => {
    const message = messagePayload();
    const run = websiteRun(message);
    let dispatches = 0;
    const relay = createWebsiteExecutionRelay({
      prepareDescriptor: () => message,
      verificationKeys: new Map([[verificationKey.keyId, verificationKey]]),
      now: () => now,
      host: {
        dispatch: async (input) => {
          dispatches += 1;
          expect(input.source).toBe("private learner source");
          return { runId: run.runId, replayed: false };
        },
        cancel: async () => undefined,
      },
    });
    const prepared = relay.prepare(run, must(formatId("event", "0000000000000011")));
    expect(JSON.stringify(prepared)).not.toContain("private learner source");
    await expect(
      relay.dispatch(run.runId, prepared.dispatchToken, "different source"),
    ).rejects.toThrow("mismatch");
    const receipts = await Promise.all([
      relay.dispatch(run.runId, prepared.dispatchToken, "private learner source"),
      relay.dispatch(run.runId, prepared.dispatchToken, "private learner source"),
    ]);
    expect(receipts.every((receipt) => receipt.runId === run.runId)).toBe(true);
    expect(dispatches).toBe(1);
    expect(
      await relay.dispatch(run.runId, prepared.dispatchToken, "private learner source"),
    ).toMatchObject({ replayed: true });
    await relay.cancel(run.runId, "learner");
    await expect(
      relay.dispatch(run.runId, prepared.dispatchToken, "private learner source"),
    ).rejects.toThrow("unavailable");
  });

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
