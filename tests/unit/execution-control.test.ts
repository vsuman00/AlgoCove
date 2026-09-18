import { describe, expect, it } from "vitest";
import {
  createExecutionResult,
  createRunDescriptor,
  generateSigningKeyPair,
  signExecutionResult,
  signRunDescriptor,
  type ExecutionLimits,
  type SignedExecutionResult,
  type SignedRunDescriptor,
  type VerificationKey,
} from "@algocove/execution-contracts";
import { formatId, type ContentChecksum, type Result } from "@algocove/domain";
import {
  createExecutionControl,
  createExecutionControlServer,
  createInternalAuthenticator,
  createExecutionDispatchMessage,
  type ExecutionControlServer,
  type ExecutionJournal,
  type InternalOperation,
  type InternalPrincipal,
} from "@algocove/execution-control";
import {
  forwardExecutionResult,
  forwardTeardownFailure,
} from "../../apps/worker/src/execution-result-forwarder.ts";

const now = "2026-09-17T10:00:00.000Z";
const after = "2026-09-17T10:00:00.500Z";
const later = "2026-09-17T10:00:30.000Z";
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

function must<T>(result: Result<T, unknown>): T {
  if (!result.ok) throw new Error("Invalid execution-control fixture.");
  return result.value;
}

function id<TKind extends "codeRun" | "attempt" | "problemVersion">(kind: TKind, entropy: string) {
  return must(formatId(kind, entropy));
}

const signingKey = generateSigningKeyPair("exec-2026-09-a");
const verificationKey: VerificationKey = {
  keyId: signingKey.keyId,
  publicKey: signingKey.publicKey,
  status: "active",
};

function signedDescriptor(entropy: string, leaseEpoch = 1): SignedRunDescriptor {
  const descriptor = createRunDescriptor({
    learner: { language: "javascript", source: "private learner source" },
    server: {
      runId: id("codeRun", entropy),
      attemptId: id("attempt", "0000000000000001"),
      replayId: `replay-${entropy}`,
      problemVersionId: id("problemVersion", "0000000000000001"),
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
      leaseEpoch,
      issuedAt: now,
      expiresAt: later,
    },
  });
  return must(signRunDescriptor(must(descriptor), signingKey));
}

function signedResult(
  descriptor: SignedRunDescriptor,
  category: "pass" | "wrong_answer" | "infrastructure_error",
  resultId: string,
  issuedAt = after,
): SignedExecutionResult {
  const result = createExecutionResult({
    descriptor: descriptor.payload,
    resultId,
    terminalCategory: category,
    phase: "run",
    issuedAt,
    expiresAt: later,
  });
  return must(signExecutionResult(must(result), signingKey));
}

function createServer(): ExecutionControlServer {
  const records = new Map<string, ReturnType<ExecutionJournal["get"]>>();
  const journal: ExecutionJournal = {
    get: (runId) => records.get(runId),
    save: (record) => records.set(record.descriptor.payload.runId, record),
  };
  const control = createExecutionControl({
    verificationKeys: new Map([[verificationKey.keyId, verificationKey]]),
    terminalSigningKeys: new Map([[signingKey.keyId, signingKey]]),
    orphanTimeoutMs: 1_000,
    maxQueuePerQuota: 2,
    journal,
  });
  const authenticator = createInternalAuthenticator({
    "application-relay": "relay-secret-2026",
    "execution-worker": "worker-secret-2026",
    "execution-operator": "operator-secret-2026",
  });
  return createExecutionControlServer(control, authenticator);
}

function request(
  server: ExecutionControlServer,
  principal: InternalPrincipal,
  operation: InternalOperation,
) {
  const token = {
    "application-relay": "relay-secret-2026",
    "execution-worker": "worker-secret-2026",
    "execution-operator": "operator-secret-2026",
  }[principal];
  return server.handle({ source: "internal", principal, token, operation });
}

function quota(maxConcurrent = 1) {
  return {
    quotaKey: "learner:usr_aaaaaaaaaaaaaaaa",
    profileId: "javascript-default",
    maxConcurrent,
  };
}

describe("execution-control service boundary", () => {
  it("rejects browser-origin calls and accepts only authenticated internal relay calls", async () => {
    const server = createServer();
    const descriptor = signedDescriptor("0000000000000001");

    await expect(
      server.handle({
        source: "browser",
        principal: "browser",
        token: "relay-secret-2026",
        operation: {
          kind: "admit",
          dispatchKey: "dispatch-1",
          descriptor,
          quota: quota(),
          now,
        },
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "browser_forbidden" } });
    await expect(
      request(server, "application-relay", {
        kind: "admit",
        dispatchKey: "dispatch-1",
        descriptor,
        quota: quota(),
        now,
      }),
    ).resolves.toMatchObject({ ok: true, value: { state: "queued", replayed: false } });
    await expect(
      server.handle({
        source: "internal",
        principal: "application-relay",
        token: "wrong",
        operation: { kind: "admit", dispatchKey: "dispatch-2", descriptor, quota: quota(), now },
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "internal_auth_failed" } });
  });

  it("deduplicates concurrent dispatches and queues beyond the per-profile quota", async () => {
    const server = createServer();
    const first = signedDescriptor("0000000000000002");
    const second = signedDescriptor("0000000000000003");
    const firstOperation: InternalOperation = {
      kind: "admit",
      dispatchKey: "dispatch-concurrent",
      descriptor: first,
      quota: quota(),
      now,
    };
    const admissions = await Promise.all([
      request(server, "application-relay", firstOperation),
      request(server, "application-relay", firstOperation),
    ]);
    expect(admissions[0]).toMatchObject({ ok: true, value: { replayed: false } });
    expect(admissions[1]).toMatchObject({ ok: true, value: { replayed: true } });

    await expect(
      request(server, "application-relay", {
        kind: "admit",
        dispatchKey: "dispatch-second",
        descriptor: second,
        quota: quota(),
        now,
      }),
    ).resolves.toMatchObject({ ok: true, value: { state: "queued", queuePosition: 2 } });
    await expect(
      request(server, "application-relay", {
        kind: "admit",
        dispatchKey: "dispatch-concurrent",
        descriptor: second,
        quota: quota(),
        now,
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "idempotency_conflict" } });
  });

  it("leases one run, fences a lost worker, and never auto-replaces uncertain execution", async () => {
    const server = createServer();
    const descriptor = signedDescriptor("0000000000000004", 1);
    await request(server, "application-relay", {
      kind: "admit",
      dispatchKey: "dispatch-lost",
      descriptor,
      quota: quota(),
      now,
    });
    const lease = await request(server, "execution-worker", {
      kind: "lease_next",
      workerId: "worker-a",
      now,
      leaseDurationMs: 900,
    });
    expect(lease).toMatchObject({ ok: true, value: { state: "leased", leaseEpoch: 1 } });
    await request(server, "execution-worker", {
      kind: "mark_running",
      runId: descriptor.payload.runId,
      workerId: "worker-a",
      leaseEpoch: 1,
      now,
    });
    await expect(
      request(server, "execution-worker", {
        kind: "worker_lost",
        runId: descriptor.payload.runId,
        workerId: "worker-a",
        leaseEpoch: 1,
        now,
      }),
    ).resolves.toMatchObject({
      ok: true,
      value: { state: "orphaned", reconciliationDeadline: "2026-09-17T10:00:01.000Z" },
    });
    await expect(
      request(server, "execution-worker", {
        kind: "record_result",
        result: signedResult(descriptor, "pass", "result-lost-worker"),
        now: after,
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "lease_fenced" } });
    await expect(
      request(server, "execution-operator", { kind: "reconcile", now: after }),
    ).resolves.toMatchObject({ ok: true, value: { reconciled: 0 } });
    await expect(
      request(server, "execution-operator", {
        kind: "reconcile",
        now: "2026-09-17T10:00:02.000Z",
      }),
    ).resolves.toMatchObject({
      ok: true,
      value: { reconciled: 1, terminalCategory: "infrastructure_error" },
    });
    await expect(
      request(server, "execution-worker", {
        kind: "lease_next",
        workerId: "worker-b",
        now: "2026-09-17T10:00:03.000Z",
        leaseDurationMs: 900,
      }),
    ).resolves.toMatchObject({ ok: true, value: null });
  });

  it("lets a terminal result win a cancellation race and deduplicates terminal effects", async () => {
    const server = createServer();
    const descriptor = signedDescriptor("0000000000000005");
    await request(server, "application-relay", {
      kind: "admit",
      dispatchKey: "dispatch-cancel-race",
      descriptor,
      quota: quota(),
      now,
    });
    await request(server, "execution-worker", {
      kind: "lease_next",
      workerId: "worker-a",
      now,
      leaseDurationMs: 900,
    });
    await request(server, "execution-worker", {
      kind: "mark_running",
      runId: descriptor.payload.runId,
      workerId: "worker-a",
      leaseEpoch: 1,
      now,
    });
    await expect(
      request(server, "application-relay", {
        kind: "cancel",
        runId: descriptor.payload.runId,
        now: after,
        reason: "learner",
      }),
    ).resolves.toMatchObject({ ok: true, value: { state: "cancellation_requested" } });
    const result = signedResult(descriptor, "pass", "result-cancel-race");
    await expect(
      request(server, "execution-worker", { kind: "record_result", result, now: after }),
    ).resolves.toMatchObject({ ok: true, value: { state: "awaiting_teardown" } });
    await expect(
      request(server, "execution-worker", {
        kind: "confirm_teardown",
        runId: descriptor.payload.runId,
        workerId: "worker-a",
        leaseEpoch: 1,
        now: later,
      }),
    ).resolves.toMatchObject({ ok: true, value: { state: "terminal", terminalCategory: "pass" } });
    await expect(
      request(server, "execution-worker", { kind: "record_result", result, now: later }),
    ).resolves.toMatchObject({ ok: true, value: { replayed: true, state: "terminal" } });
  });

  it("forwards only control-plane terminal results after teardown confirmation", async () => {
    const server = createServer();
    const descriptor = signedDescriptor("0000000000000008");
    await request(server, "application-relay", {
      kind: "admit",
      dispatchKey: "dispatch-forward",
      descriptor,
      quota: quota(),
      now,
    });
    await request(server, "execution-worker", {
      kind: "lease_next",
      workerId: "worker-a",
      now,
      leaseDurationMs: 900,
    });
    const delivered: SignedExecutionResult[] = [];
    const result = signedResult(descriptor, "pass", "result-forward");
    await expect(
      forwardExecutionResult(
        server,
        {
          deliver: async (value) => {
            delivered.push(value);
          },
        },
        {
          token: "worker-secret-2026",
          workerId: "worker-a",
          runId: descriptor.payload.runId,
          leaseEpoch: 1,
          result,
          now: after,
        },
      ),
    ).resolves.toMatchObject({ ok: true, value: { state: "terminal", terminalCategory: "pass" } });
    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toEqual(result);

    await forwardExecutionResult(
      server,
      {
        deliver: async (value) => {
          delivered.push(value);
        },
      },
      {
        token: "worker-secret-2026",
        workerId: "worker-a",
        runId: descriptor.payload.runId,
        leaseEpoch: 1,
        result,
        now: later,
      },
    );
    expect(delivered).toHaveLength(2);
    expect(delivered[1]).toEqual(result);

    const failureServer = createServer();
    const failureDescriptor = signedDescriptor("0000000000000009");
    await request(failureServer, "application-relay", {
      kind: "admit",
      dispatchKey: "dispatch-forward-failure",
      descriptor: failureDescriptor,
      quota: quota(),
      now,
    });
    await request(failureServer, "execution-worker", {
      kind: "lease_next",
      workerId: "worker-a",
      now,
      leaseDurationMs: 900,
    });
    await request(failureServer, "execution-worker", {
      kind: "record_result",
      result: signedResult(failureDescriptor, "wrong_answer", "result-before-teardown"),
      now: after,
    });
    await expect(
      forwardTeardownFailure(
        failureServer,
        {
          deliver: async (value) => {
            delivered.push(value);
          },
        },
        {
          token: "worker-secret-2026",
          workerId: "worker-a",
          runId: failureDescriptor.payload.runId,
          leaseEpoch: 1,
          now: later,
        },
      ),
    ).resolves.toMatchObject({
      ok: true,
      value: { state: "terminal", terminalCategory: "infrastructure_error" },
    });
    expect(delivered.at(-1)?.payload.terminalCategory).toBe("infrastructure_error");
  });

  it("converts teardown failure into an infrastructure terminal result", async () => {
    const server = createServer();
    const descriptor = signedDescriptor("0000000000000006");
    await request(server, "application-relay", {
      kind: "admit",
      dispatchKey: "dispatch-teardown",
      descriptor,
      quota: quota(),
      now,
    });
    await request(server, "execution-worker", {
      kind: "lease_next",
      workerId: "worker-a",
      now,
      leaseDurationMs: 900,
    });
    const result = signedResult(descriptor, "wrong_answer", "result-teardown");
    await request(server, "execution-worker", { kind: "record_result", result, now: after });
    await expect(
      request(server, "execution-worker", {
        kind: "teardown_failed",
        runId: descriptor.payload.runId,
        workerId: "worker-a",
        leaseEpoch: 1,
        now: later,
      }),
    ).resolves.toMatchObject({
      ok: true,
      value: { state: "terminal", terminalCategory: "infrastructure_error" },
    });
  });

  it("creates a descriptor-only relay message and rejects arbitrary payload fields", () => {
    const descriptor = signedDescriptor("0000000000000007");
    const message = createExecutionDispatchMessage({
      dispatchKey: "dispatch-relay",
      descriptor,
      quota: quota(),
      now,
      verificationKeys: new Map([[verificationKey.keyId, verificationKey]]),
    });
    expect(message).toMatchObject({
      ok: true,
      value: { topic: "execution.run.requested", dispatchKey: "dispatch-relay" },
    });
    expect(JSON.stringify(message)).not.toContain("private learner source");
  });
});
