import { DatabaseSync } from "node:sqlite";
import {
  createExecutionResult,
  signExecutionResult,
  type SigningKeyPair,
  type VerificationKey,
  type SignedExecutionResult,
} from "@algocove/execution-contracts";
import {
  createExecutionControl,
  createSqliteExecutionJournal,
  type ExecutionControl,
  type IsolatedSourceHost,
  type ExecutionDispatchMessage,
} from "@algocove/execution-control";
import { createGvisorRunner, dockerCommand, type HostVerdict } from "./docker-runner.ts";

type Options = {
  journalPath: string;
  key: SigningKeyPair;
  verificationKeys: ReadonlyMap<string, VerificationKey>;
  images: Parameters<typeof createGvisorRunner>[0];
  deliver: (result: SignedExecutionResult) => Promise<void>;
  /** Only tests substitute the runner. The CLI always uses gVisor. */
  runner?: ReturnType<typeof createGvisorRunner>;
};

export async function createLocalSourceHost(options: Options): Promise<
  IsolatedSourceHost & {
    readonly control: ExecutionControl;
    close(): Promise<void>;
    drain(): Promise<void>;
  }
> {
  const journal = createSqliteExecutionJournal(options.journalPath);
  const metadata = new DatabaseSync(options.journalPath);
  metadata.exec(
    "CREATE TABLE IF NOT EXISTS host_cancel (run_id TEXT PRIMARY KEY); CREATE TABLE IF NOT EXISTS host_delivery (run_id TEXT PRIMARY KEY)",
  );
  const control = createExecutionControl({
    verificationKeys: options.verificationKeys,
    terminalSigningKeys: new Map([[options.key.keyId, options.key]]),
    journal,
    orphanTimeoutMs: 1,
    maxQueuePerQuota: 100,
  });
  const runner = options.runner ?? createGvisorRunner(options.images);
  const sources = new Map<string, string>();
  const restoredQueued = new Set(
    journal
      .list()
      .filter((record) => record.state === "queued")
      .map((record) => record.descriptor.payload.runId),
  );
  const active = new Map<string, AbortController>();
  const workerId = "local-gvisor-host";
  let stopped = false;
  let pumping: Promise<void> | undefined;
  const now = () => new Date().toISOString();
  const must = <T>(
    value: { ok: true; value: T } | { ok: false; error: { message: string } },
  ): T => {
    if (!value.ok) throw new Error(value.error.message);
    return value.value;
  };
  const deliver = async () => {
    for (const record of journal.list()) {
      const result = record.terminalResult;
      if (
        result === undefined ||
        metadata.prepare("SELECT 1 FROM host_delivery WHERE run_id=?").get(result.payload.runId) !==
          undefined
      )
        continue;
      // Expired signatures require operator reconciliation, never a forged fresh pass.
      if (Date.parse(result.payload.expiresAt) <= Date.now()) continue;
      try {
        await options.deliver(result);
        metadata
          .prepare("INSERT OR IGNORE INTO host_delivery VALUES (?)")
          .run(result.payload.runId);
      } catch {
        /* Durable terminal remains pending for retry. */
      }
    }
  };
  const pump = async () => {
    await deliver();
    while (!stopped) {
      const lease = must(
        control.leaseNext({
          workerId,
          now: now(),
          leaseDurationMs: 60000,
          isReady: (runId) =>
            sources.has(runId) ||
            restoredQueued.has(runId) ||
            Date.now() - Date.parse(journal.get(runId)!.descriptor.payload.issuedAt) >= 5000,
        }),
      );
      if (lease === null) break;
      const descriptor = lease.descriptor.payload;
      const source = sources.get(descriptor.runId);
      sources.delete(descriptor.runId);
      const abort = new AbortController();
      active.set(descriptor.runId, abort);
      if (
        metadata.prepare("SELECT 1 FROM host_cancel WHERE run_id=?").get(descriptor.runId) !==
        undefined
      )
        abort.abort();
      must(
        control.markRunning({
          runId: descriptor.runId,
          workerId,
          leaseEpoch: lease.leaseEpoch,
          now: now(),
        }),
      );
      let verdict: HostVerdict;
      try {
        verdict =
          source === undefined
            ? { category: "infrastructure_error", phase: "run", teardownConfirmed: true }
            : await runner(descriptor, source, abort.signal);
      } catch {
        verdict = { category: "infrastructure_error", phase: "run", teardownConfirmed: false };
      }
      active.delete(descriptor.runId);
      const issuedAt = now();
      const result = must(
        signExecutionResult(
          must(
            createExecutionResult({
              descriptor,
              resultId: `local-${descriptor.runId}`,
              terminalCategory: abort.signal.aborted ? "cancelled" : verdict.category,
              phase: verdict.phase,
              issuedAt,
              expiresAt: new Date(Date.parse(issuedAt) + 300000).toISOString(),
            }),
          ),
          options.key,
        ),
      );
      must(control.recordResult({ result, now: issuedAt }));
      const teardown = {
        runId: descriptor.runId,
        workerId,
        leaseEpoch: lease.leaseEpoch,
        now: now(),
      };
      if (verdict.teardownConfirmed) must(control.confirmTeardown(teardown));
      else must(control.teardownFailed(teardown));
      await deliver();
    }
  };
  const schedule = () => {
    if (stopped || pumping !== undefined) return;
    pumping = pump().finally(() => {
      pumping = undefined;
    });
    // Keep failure observable through drain; avoid an unhandled rejection in the background.
    void pumping.catch(() => {
      stopped = true;
    });
  };
  // Uncertain work is fenced and killed after restart; raw source is never recovered.
  for (const record of journal.list()) {
    if (record.state === "queued" || record.state === "terminal") continue;
    if (options.runner === undefined) {
      const name = `algocove-local-${record.descriptor.payload.runId}`;
      await dockerCommand(["rm", "-f", name]);
      const residue = await dockerCommand(["ps", "-aq", "--filter", `name=^/${name}$`]);
      if (residue.code !== 0 || residue.stdout.trim() !== "") {
        metadata.close();
        journal.close();
        throw new Error("Cannot confirm orphan teardown; host is quarantined.");
      }
    }
    if (record.state !== "orphaned" && record.workerId !== undefined)
      must(
        control.workerLost({
          runId: record.descriptor.payload.runId,
          workerId: record.workerId,
          leaseEpoch: record.activeLeaseEpoch,
          now: now(),
        }),
      );
  }
  // The 1ms recovery fence is local only; await it without blocking the event loop.
  await new Promise((resolve) => setTimeout(resolve, 2));
  must(control.reconcile(now()));
  schedule();
  const timer = setInterval(schedule, 1000);
  timer.unref();
  return {
    control,
    async dispatch({ message, source }: { message: ExecutionDispatchMessage; source: string }) {
      if (stopped) throw new Error("Execution host is stopped.");
      if (
        metadata
          .prepare("SELECT 1 FROM host_cancel WHERE run_id=?")
          .get(message.descriptor.payload.runId) !== undefined
      )
        throw new Error("Run was cancelled before admission.");
      const receipt = must(
        control.admit({
          dispatchKey: message.dispatchKey,
          descriptor: message.descriptor,
          quota: message.quota,
          now: now(),
        }),
      );
      if (
        receipt.state === "queued" &&
        !sources.has(receipt.runId) &&
        !restoredQueued.has(receipt.runId)
      )
        sources.set(receipt.runId, source);
      schedule();
      return { runId: receipt.runId, replayed: receipt.replayed };
    },
    async cancel({ runId, reason }) {
      if (stopped) throw new Error("Execution host is stopped.");
      metadata.prepare("INSERT OR IGNORE INTO host_cancel VALUES (?)").run(runId);
      active.get(runId)?.abort();
      if (journal.get(runId) !== undefined) must(control.cancel({ runId, reason, now: now() }));
      sources.delete(runId);
      schedule();
    },
    async drain() {
      await pumping;
      await deliver();
    },
    async close() {
      stopped = true;
      clearInterval(timer);
      for (const abort of active.values()) abort.abort();
      try {
        await pumping;
      } finally {
        sources.clear();
        metadata.close();
        journal.close();
      }
    },
  };
}
