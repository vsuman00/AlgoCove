import { err, instantFromEpochMs, parseInstant } from "@algocove/domain";
import {
  createExecutionResult,
  digestDescriptor,
  signExecutionResult,
  verifyExecutionResult,
  verifyRunDescriptor,
  type SignedExecutionResult,
  type SignedRunDescriptor,
} from "@algocove/execution-contracts";
import {
  validateControlTime,
  validateDispatchKey,
  validateLeaseDuration,
  validateQuota,
  validateWorkerId,
} from "./admission.ts";
import {
  controlFailure,
  type AdmissionQuota,
  type AdmissionReceipt,
  type ControlResult,
  type ExecutionControlOptions,
  type ExecutionJournalRecord,
  type ExecutionRunSnapshot,
  type ExecutionRunState,
  type LeaseReceipt,
  type LifecycleReceipt,
  type ReconcileReceipt,
} from "./types.ts";
import type { RunDescriptor, TerminalCategory } from "@algocove/execution-contracts";

const TERMINAL_RESULT_TTL_MS = 5 * 60_000;

type MutableRecord = {
  descriptor: SignedRunDescriptor;
  descriptorDigest: string;
  dispatchKey: string;
  quota: AdmissionQuota;
  state: ExecutionRunState;
  activeLeaseEpoch: number;
  workerId?: string;
  leasedUntil?: string;
  reconciliationDeadline?: string;
  pendingResult?: SignedExecutionResult;
  terminalResult?: SignedExecutionResult;
};

export class ExecutionControl {
  private readonly records = new Map<string, MutableRecord>();
  private readonly dispatches = new Map<string, string>();
  private readonly queue: string[] = [];
  private readonly disabledProfiles = new Set<string>();
  private readonly options: ExecutionControlOptions;

  constructor(options: ExecutionControlOptions) {
    if (
      !Number.isSafeInteger(options.orphanTimeoutMs) ||
      options.orphanTimeoutMs < 1 ||
      options.orphanTimeoutMs > 300_000
    ) {
      throw new Error("Orphan timeout must be between 1ms and 300000ms.");
    }
    if (
      !Number.isSafeInteger(options.maxQueuePerQuota) ||
      options.maxQueuePerQuota < 1 ||
      options.maxQueuePerQuota > 1_000
    ) {
      throw new Error("Maximum queue length must be between 1 and 1000.");
    }
    this.options = options;
  }

  disableProfile(profileId: string): void {
    this.disabledProfiles.add(profileId);
  }

  enableProfile(profileId: string): void {
    this.disabledProfiles.delete(profileId);
  }

  admit(input: {
    readonly dispatchKey: string;
    readonly descriptor: SignedRunDescriptor;
    readonly quota: AdmissionQuota;
    readonly now: string;
  }): ControlResult<AdmissionReceipt> {
    const dispatchKey = validateDispatchKey(input.dispatchKey);
    if (!dispatchKey.ok) return dispatchKey;
    const quota = validateQuota(input.quota);
    if (!quota.ok) return quota;
    const now = validateControlTime(input.now);
    if (!now.ok) return now;
    const verified = verifyRunDescriptor(input.descriptor, {
      keys: this.options.verificationKeys,
      now: input.now,
    });
    if (!verified.ok) {
      return err(controlFailure("invalid_descriptor", verified.error.message));
    }
    const descriptorDigest = digestDescriptor(verified.value);
    const existingRunId = this.dispatches.get(input.dispatchKey);
    if (existingRunId !== undefined) {
      const existing = this.records.get(existingRunId);
      if (existing === undefined || existing.descriptorDigest !== descriptorDigest) {
        return err(
          controlFailure("idempotency_conflict", "Dispatch key was reused for another run."),
        );
      }
      return { ok: true, value: { ...this.snapshot(existing), replayed: true } };
    }
    const runKey = verified.value.runId as string;
    if (this.records.has(runKey)) {
      return err(
        controlFailure("idempotency_conflict", "Run ID is already admitted with another dispatch."),
      );
    }
    if (this.disabledProfiles.has(input.quota.profileId)) {
      return err(controlFailure("profile_disabled", "Runtime profile is disabled for new work."));
    }
    const queuedForQuota = this.queue.filter(
      (queuedRunId) => this.records.get(queuedRunId)?.quota.quotaKey === input.quota.quotaKey,
    ).length;
    if (queuedForQuota >= this.options.maxQueuePerQuota) {
      return err(controlFailure("quota_queue_full", "Execution quota queue is full."));
    }
    const record: MutableRecord = {
      descriptor: cloneJson(input.descriptor),
      descriptorDigest,
      dispatchKey: input.dispatchKey,
      quota: { ...input.quota },
      state: "queued",
      activeLeaseEpoch: verified.value.leaseEpoch,
    };
    this.records.set(runKey, record);
    this.dispatches.set(input.dispatchKey, runKey);
    this.queue.push(runKey);
    this.persist(record);
    return { ok: true, value: { ...this.snapshot(record), replayed: false } };
  }

  leaseNext(input: {
    readonly workerId: string;
    readonly now: string;
    readonly leaseDurationMs: number;
  }): ControlResult<LeaseReceipt | null> {
    const worker = validateWorkerId(input.workerId);
    if (!worker.ok) return worker;
    const now = validateControlTime(input.now);
    if (!now.ok) return now;
    const duration = validateLeaseDuration(input.leaseDurationMs);
    if (!duration.ok) return duration;
    for (let index = 0; index < this.queue.length; index += 1) {
      const runKey = this.queue[index];
      const record = runKey === undefined ? undefined : this.records.get(runKey);
      if (record === undefined || record.state !== "queued") continue;
      if (this.disabledProfiles.has(record.quota.profileId)) continue;
      if (this.activeCount(record.quota.quotaKey) >= record.quota.maxConcurrent) continue;
      this.queue.splice(index, 1);
      const leasedUntil = addMilliseconds(input.now, input.leaseDurationMs);
      if (!leasedUntil.ok) return leasedUntil;
      record.state = "leased";
      record.workerId = input.workerId;
      record.leasedUntil = leasedUntil.value;
      this.persist(record);
      return {
        ok: true,
        value: { ...this.snapshot(record), descriptor: record.descriptor },
      };
    }
    return { ok: true, value: null };
  }

  markRunning(input: {
    readonly runId: RunDescriptor["runId"];
    readonly workerId: string;
    readonly leaseEpoch: number;
    readonly now: string;
  }): ControlResult<LifecycleReceipt> {
    const record = this.authorizeLease(input.runId, input.workerId, input.leaseEpoch, input.now);
    if (!record.ok) return record;
    if (record.value.state !== "leased" && record.value.state !== "cancellation_requested") {
      return err(controlFailure("invalid_state", "Only a leased run can become running."));
    }
    if (record.value.state === "leased") record.value.state = "running";
    this.persist(record.value);
    return { ok: true, value: this.snapshot(record.value) };
  }

  heartbeat(input: {
    readonly runId: RunDescriptor["runId"];
    readonly workerId: string;
    readonly leaseEpoch: number;
    readonly now: string;
    readonly leaseDurationMs: number;
  }): ControlResult<LifecycleReceipt> {
    const duration = validateLeaseDuration(input.leaseDurationMs);
    if (!duration.ok) return duration;
    const record = this.authorizeLease(input.runId, input.workerId, input.leaseEpoch, input.now);
    if (!record.ok) return record;
    if (
      record.value.leasedUntil !== undefined &&
      Date.parse(input.now) >= Date.parse(record.value.leasedUntil)
    ) {
      return err(controlFailure("lease_expired", "Worker lease has expired."));
    }
    const leasedUntil = addMilliseconds(input.now, input.leaseDurationMs);
    if (!leasedUntil.ok) return leasedUntil;
    record.value.leasedUntil = leasedUntil.value;
    this.persist(record.value);
    return { ok: true, value: this.snapshot(record.value) };
  }

  workerLost(input: {
    readonly runId: RunDescriptor["runId"];
    readonly workerId: string;
    readonly leaseEpoch: number;
    readonly now: string;
  }): ControlResult<LifecycleReceipt> {
    const record = this.authorizeLease(input.runId, input.workerId, input.leaseEpoch, input.now);
    if (!record.ok) return record;
    if (!["leased", "running", "cancellation_requested"].includes(record.value.state)) {
      return err(
        controlFailure("invalid_state", "Only an active worker lease can become orphaned."),
      );
    }
    const deadline = addMilliseconds(input.now, this.options.orphanTimeoutMs);
    if (!deadline.ok) return deadline;
    record.value.state = "orphaned";
    record.value.activeLeaseEpoch += 1;
    record.value.reconciliationDeadline = deadline.value;
    this.persist(record.value);
    return { ok: true, value: this.snapshot(record.value) };
  }

  cancel(input: {
    readonly runId: RunDescriptor["runId"];
    readonly now: string;
    readonly reason: "learner" | "system" | "timeout";
  }): ControlResult<LifecycleReceipt> {
    const now = validateControlTime(input.now);
    if (!now.ok) return now;
    const record = this.records.get(input.runId as string);
    if (record === undefined)
      return err(controlFailure("run_not_found", "Execution run was not found."));
    if (record.state === "terminal")
      return { ok: true, value: { ...this.snapshot(record), replayed: true } };
    if (record.state === "queued") {
      this.removeFromQueue(input.runId as string);
      const terminal = this.createServiceResult(
        record,
        "cancelled",
        input.now,
        `cancel-${record.descriptor.payload.runId}`,
      );
      if (!terminal.ok) return terminal;
      record.state = "terminal";
      record.terminalResult = terminal.value;
      this.persist(record);
      return { ok: true, value: this.snapshot(record) };
    }
    if (record.state === "orphaned") return { ok: true, value: this.snapshot(record) };
    record.state = record.state === "awaiting_teardown" ? record.state : "cancellation_requested";
    this.persist(record);
    return { ok: true, value: this.snapshot(record) };
  }

  recordResult(input: {
    readonly result: SignedExecutionResult;
    readonly now: string;
  }): ControlResult<LifecycleReceipt> {
    const runKey = input.result.payload.runId as string;
    const record = this.records.get(runKey);
    if (record === undefined)
      return err(controlFailure("run_not_found", "Execution run was not found."));
    if (record.state === "terminal") {
      if (sameSignedResult(record.terminalResult, input.result)) {
        return { ok: true, value: { ...this.snapshot(record), replayed: true } };
      }
      return err(
        controlFailure("terminal_conflict", "A different terminal result already won this run."),
      );
    }
    if (record.state === "orphaned")
      return err(controlFailure("lease_fenced", "Orphaned worker lease is fenced."));
    if (record.pendingResult !== undefined) {
      if (sameSignedResult(record.pendingResult, input.result)) {
        return { ok: true, value: { ...this.snapshot(record), replayed: true } };
      }
      return err(controlFailure("terminal_conflict", "A result is already awaiting teardown."));
    }
    if (!["leased", "running", "cancellation_requested"].includes(record.state)) {
      return err(controlFailure("invalid_state", "Run is not accepting a worker result."));
    }
    const verified = verifyExecutionResult(input.result, {
      keys: this.options.verificationKeys,
      now: input.now,
      expectedDescriptorDigest: record.descriptorDigest,
      expectedRunId: record.descriptor.payload.runId,
      expectedAttemptId: record.descriptor.payload.attemptId,
      expectedReplayId: record.descriptor.payload.replayId,
      expectedLeaseEpoch: record.activeLeaseEpoch,
    });
    if (!verified.ok) {
      return err(
        controlFailure(
          verified.error.code === "lease_epoch_mismatch" ? "lease_fenced" : "invalid_descriptor",
          verified.error.message,
        ),
      );
    }
    record.pendingResult = cloneJson(input.result);
    record.state = "awaiting_teardown";
    this.persist(record);
    return { ok: true, value: this.snapshot(record) };
  }

  confirmTeardown(input: {
    readonly runId: RunDescriptor["runId"];
    readonly workerId: string;
    readonly leaseEpoch: number;
    readonly now: string;
  }): ControlResult<LifecycleReceipt> {
    const record = this.authorizeLease(input.runId, input.workerId, input.leaseEpoch, input.now);
    if (!record.ok) return record;
    if (record.value.state !== "awaiting_teardown" || record.value.pendingResult === undefined) {
      return err(
        controlFailure("invalid_state", "Only a result awaiting teardown can be committed."),
      );
    }
    record.value.terminalResult = record.value.pendingResult;
    delete record.value.pendingResult;
    record.value.state = "terminal";
    this.persist(record.value);
    return { ok: true, value: this.snapshot(record.value) };
  }

  teardownFailed(input: {
    readonly runId: RunDescriptor["runId"];
    readonly workerId: string;
    readonly leaseEpoch: number;
    readonly now: string;
  }): ControlResult<LifecycleReceipt> {
    const record = this.authorizeLease(input.runId, input.workerId, input.leaseEpoch, input.now);
    if (!record.ok) return record;
    if (record.value.state !== "awaiting_teardown") {
      return err(
        controlFailure("invalid_state", "Teardown failure is only valid after a worker result."),
      );
    }
    const terminal = this.createServiceResult(
      record.value,
      "infrastructure_error",
      input.now,
      `teardown-${record.value.descriptor.payload.runId}`,
    );
    if (!terminal.ok) return terminal;
    record.value.state = "terminal";
    record.value.terminalResult = terminal.value;
    delete record.value.pendingResult;
    this.persist(record.value);
    return { ok: true, value: this.snapshot(record.value) };
  }

  reconcile(now: string): ControlResult<ReconcileReceipt> {
    const valid = validateControlTime(now);
    if (!valid.ok) return valid;
    const runIds: RunDescriptor["runId"][] = [];
    for (const record of this.records.values()) {
      if (record.state !== "orphaned" || record.reconciliationDeadline === undefined) continue;
      if (Date.parse(now) < Date.parse(record.reconciliationDeadline)) continue;
      const terminal = this.createServiceResult(
        record,
        "infrastructure_error",
        now,
        `reconcile-${record.descriptor.payload.runId}`,
      );
      if (!terminal.ok) return terminal;
      record.state = "terminal";
      record.terminalResult = terminal.value;
      this.persist(record);
      runIds.push(record.descriptor.payload.runId);
    }
    return {
      ok: true,
      value: {
        reconciled: runIds.length,
        runIds,
        ...(runIds.length === 0 ? {} : { terminalCategory: "infrastructure_error" as const }),
      },
    };
  }

  private authorizeLease(
    runId: RunDescriptor["runId"],
    workerId: string,
    leaseEpoch: number,
    now: string,
  ): ControlResult<MutableRecord> {
    const worker = validateWorkerId(workerId);
    if (!worker.ok) return worker;
    const time = validateControlTime(now);
    if (!time.ok) return time;
    const record = this.records.get(runId as string);
    if (record === undefined)
      return err(controlFailure("run_not_found", "Execution run was not found."));
    if (record.activeLeaseEpoch !== leaseEpoch)
      return err(controlFailure("lease_fenced", "Lease epoch is stale."));
    if (record.workerId !== workerId)
      return err(controlFailure("worker_mismatch", "Worker does not own this lease."));
    return { ok: true, value: record };
  }

  private activeCount(quotaKey: string): number {
    return [...this.records.values()].filter(
      (record) =>
        record.quota.quotaKey === quotaKey &&
        ["leased", "running", "cancellation_requested", "awaiting_teardown", "orphaned"].includes(
          record.state,
        ),
    ).length;
  }

  private removeFromQueue(runKey: string): void {
    const index = this.queue.indexOf(runKey);
    if (index >= 0) this.queue.splice(index, 1);
  }

  private snapshot(record: MutableRecord): ExecutionRunSnapshot {
    const queuePosition =
      record.state === "queued"
        ? this.queue.indexOf(record.descriptor.payload.runId as string) + 1
        : 0;
    return {
      runId: record.descriptor.payload.runId,
      state: record.state,
      quotaKey: record.quota.quotaKey,
      profileId: record.quota.profileId,
      leaseEpoch: record.activeLeaseEpoch,
      ...(queuePosition > 0 ? { queuePosition } : {}),
      ...(record.workerId === undefined ? {} : { workerId: record.workerId }),
      ...(record.leasedUntil === undefined ? {} : { leasedUntil: record.leasedUntil }),
      ...(record.reconciliationDeadline === undefined
        ? {}
        : { reconciliationDeadline: record.reconciliationDeadline }),
      ...(record.terminalResult === undefined
        ? {}
        : {
            terminalCategory: record.terminalResult.payload.terminalCategory,
            terminalResult: cloneJson(record.terminalResult),
          }),
    };
  }

  private persist(record: MutableRecord): void {
    this.options.journal.save(journalRecord(record));
  }

  private createServiceResult(
    record: MutableRecord,
    category: TerminalCategory,
    issuedAt: string,
    resultId: string,
  ): ControlResult<SignedExecutionResult> {
    const signer = this.options.terminalSigningKeys.get(record.descriptor.payload.keyId);
    if (signer === undefined)
      return err(
        controlFailure(
          "signer_unavailable",
          "No terminal signer is available for this descriptor key.",
        ),
      );
    const expiresAt = addMilliseconds(issuedAt, TERMINAL_RESULT_TTL_MS);
    if (!expiresAt.ok) return expiresAt;
    const phase = record.descriptor.payload.phasePlan.includes("run") ? "run" : "compile";
    const result = createExecutionResult({
      descriptor: record.descriptor.payload,
      resultId,
      terminalCategory: category,
      phase,
      issuedAt,
      expiresAt: expiresAt.value,
    });
    if (!result.ok) return err(controlFailure("invalid_request", result.error.message));
    const signed = signExecutionResult(result.value, signer);
    if (!signed.ok) return err(controlFailure("signer_unavailable", signed.error.message));
    return signed;
  }
}

export function createExecutionControl(options: ExecutionControlOptions): ExecutionControl {
  return new ExecutionControl(options);
}

function addMilliseconds(now: string, milliseconds: number): ControlResult<string> {
  const instant = parseInstant(now);
  if (!instant.ok || !Number.isSafeInteger(milliseconds) || milliseconds < 0) {
    return err(controlFailure("invalid_request", "Cannot construct a bounded lifecycle deadline."));
  }
  const next = instantFromEpochMs(Date.parse(instant.value) + milliseconds);
  return next.ok
    ? next
    : err(
        controlFailure(
          "invalid_request",
          "Lifecycle deadline is outside the supported time range.",
        ),
      );
}

function sameSignedResult(
  left: SignedExecutionResult | undefined,
  right: SignedExecutionResult,
): boolean {
  return (
    left !== undefined &&
    left.algorithm === right.algorithm &&
    left.keyId === right.keyId &&
    left.signature === right.signature
  );
}

export function journalRecord(record: MutableRecord): ExecutionJournalRecord {
  return {
    descriptor: cloneJson(record.descriptor),
    descriptorDigest: record.descriptorDigest,
    dispatchKey: record.dispatchKey,
    quota: { ...record.quota },
    state: record.state,
    activeLeaseEpoch: record.activeLeaseEpoch,
    ...(record.workerId === undefined ? {} : { workerId: record.workerId }),
    ...(record.leasedUntil === undefined ? {} : { leasedUntil: record.leasedUntil }),
    ...(record.reconciliationDeadline === undefined
      ? {}
      : { reconciliationDeadline: record.reconciliationDeadline }),
    ...(record.pendingResult === undefined
      ? {}
      : { pendingResult: cloneJson(record.pendingResult) }),
    ...(record.terminalResult === undefined
      ? {}
      : { terminalResult: cloneJson(record.terminalResult) }),
  };
}

function cloneJson<TValue>(value: TValue): TValue {
  return JSON.parse(JSON.stringify(value)) as TValue;
}
