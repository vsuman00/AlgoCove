import type { Result } from "@algocove/domain";
import type {
  ExecutionResult,
  SignedExecutionResult,
  SignedRunDescriptor,
  SigningKeyPair,
  VerificationKey,
} from "@algocove/execution-contracts";
import type { RunDescriptor, TerminalCategory } from "@algocove/execution-contracts";

export type InternalPrincipal = "application-relay" | "execution-worker" | "execution-operator";

export type AdmissionQuota = {
  readonly quotaKey: string;
  readonly profileId: string;
  readonly maxConcurrent: number;
};

export type ControlFailureCode =
  | "browser_forbidden"
  | "internal_auth_failed"
  | "operation_forbidden"
  | "invalid_request"
  | "invalid_descriptor"
  | "idempotency_conflict"
  | "quota_queue_full"
  | "profile_disabled"
  | "run_not_found"
  | "invalid_state"
  | "worker_mismatch"
  | "lease_fenced"
  | "lease_expired"
  | "terminal_conflict"
  | "signer_unavailable";

export type ControlFailure = {
  readonly code: ControlFailureCode;
  readonly message: string;
};

export type ControlResult<TValue> = Result<TValue, ControlFailure>;

export type ExecutionRunState =
  | "queued"
  | "leased"
  | "running"
  | "cancellation_requested"
  | "awaiting_teardown"
  | "orphaned"
  | "terminal";

export type ExecutionRunSnapshot = {
  readonly runId: RunDescriptor["runId"];
  readonly state: ExecutionRunState;
  readonly quotaKey: string;
  readonly profileId: string;
  readonly leaseEpoch: number;
  readonly queuePosition?: number;
  readonly workerId?: string;
  readonly leasedUntil?: string;
  readonly reconciliationDeadline?: string;
  readonly terminalCategory?: TerminalCategory;
  readonly terminalResult?: SignedExecutionResult;
};

export type AdmissionReceipt = ExecutionRunSnapshot & {
  readonly replayed: boolean;
};

export type LeaseReceipt = ExecutionRunSnapshot & {
  readonly descriptor: SignedRunDescriptor;
};

export type LifecycleReceipt = ExecutionRunSnapshot & {
  readonly replayed?: boolean;
};

export type ReconcileReceipt = {
  readonly reconciled: number;
  readonly runIds: readonly RunDescriptor["runId"][];
  readonly terminalCategory?: "infrastructure_error";
};

export type InternalOperation =
  | {
      readonly kind: "admit";
      readonly dispatchKey: string;
      readonly descriptor: SignedRunDescriptor;
      readonly quota: AdmissionQuota;
      readonly now: string;
    }
  | {
      readonly kind: "lease_next";
      readonly workerId: string;
      readonly now: string;
      readonly leaseDurationMs: number;
    }
  | {
      readonly kind: "mark_running";
      readonly runId: RunDescriptor["runId"];
      readonly workerId: string;
      readonly leaseEpoch: number;
      readonly now: string;
    }
  | {
      readonly kind: "heartbeat";
      readonly runId: RunDescriptor["runId"];
      readonly workerId: string;
      readonly leaseEpoch: number;
      readonly now: string;
      readonly leaseDurationMs: number;
    }
  | {
      readonly kind: "worker_lost";
      readonly runId: RunDescriptor["runId"];
      readonly workerId: string;
      readonly leaseEpoch: number;
      readonly now: string;
    }
  | {
      readonly kind: "record_result";
      readonly result: SignedExecutionResult;
      readonly now: string;
    }
  | {
      readonly kind: "confirm_teardown" | "teardown_failed";
      readonly runId: RunDescriptor["runId"];
      readonly workerId: string;
      readonly leaseEpoch: number;
      readonly now: string;
    }
  | {
      readonly kind: "cancel";
      readonly runId: RunDescriptor["runId"];
      readonly now: string;
      readonly reason: "learner" | "system" | "timeout";
    }
  | {
      readonly kind: "reconcile";
      readonly now: string;
    };

export type ExecutionControlOptions = {
  readonly verificationKeys: ReadonlyMap<string, VerificationKey>;
  readonly terminalSigningKeys: ReadonlyMap<string, SigningKeyPair>;
  readonly orphanTimeoutMs: number;
  readonly maxQueuePerQuota: number;
  readonly journal: ExecutionJournal;
};

export type InternalEnvelope = {
  readonly source: "internal";
  readonly principal: InternalPrincipal;
  readonly token: string;
  readonly operation: InternalOperation;
};

export type BrowserEnvelope = {
  readonly source: "browser";
  readonly principal: "browser";
  readonly token?: string;
  readonly operation: InternalOperation;
};

export type ExecutionControlRequest = InternalEnvelope | BrowserEnvelope;

export type ExecutionControlResponse =
  AdmissionReceipt | LeaseReceipt | LifecycleReceipt | ReconcileReceipt | null;

export type ExecutionJournalRecord = {
  readonly descriptor: SignedRunDescriptor;
  readonly descriptorDigest: string;
  readonly dispatchKey: string;
  readonly quota: AdmissionQuota;
  readonly state: ExecutionRunState;
  readonly activeLeaseEpoch: number;
  readonly workerId?: string;
  readonly leasedUntil?: string;
  readonly reconciliationDeadline?: string;
  readonly pendingResult?: SignedExecutionResult;
  readonly terminalResult?: SignedExecutionResult;
};

export type ExecutionJournal = {
  readonly get: (runId: RunDescriptor["runId"]) => ExecutionJournalRecord | undefined;
  readonly save: (record: ExecutionJournalRecord) => void;
};

export type ParsedResult = ExecutionResult;

export function controlFailure(code: ControlFailureCode, message: string): ControlFailure {
  return { code, message };
}
