import type {
  Branded,
  ContentChecksum,
  Instant,
  OpaqueId,
  PolicyVersion,
  ProblemLanguage,
  ProblemLanguageManifest,
  ProblemVersionId,
} from "@algocove/domain";

export const CURRENT_EXECUTION_SCHEMA_VERSION = 1 as const;

export type ExecutionSchemaVersion = typeof CURRENT_EXECUTION_SCHEMA_VERSION;
export type ExecutionPhase = "compile" | "run";
export const EXECUTION_PHASES: readonly ExecutionPhase[] = ["compile", "run"];

export type RunState = "queued" | "leased" | "compiling" | "running" | "terminal";
export const RUN_STATES: readonly RunState[] = [
  "queued",
  "leased",
  "compiling",
  "running",
  "terminal",
];

export type TerminalCategory =
  | "pass"
  | "wrong_answer"
  | "compile_error"
  | "type_error"
  | "runtime_error"
  | "limits"
  | "cancelled"
  | "infrastructure_error";

export const TERMINAL_CATEGORIES: readonly TerminalCategory[] = [
  "pass",
  "wrong_answer",
  "compile_error",
  "type_error",
  "runtime_error",
  "limits",
  "cancelled",
  "infrastructure_error",
];

export type ResultClassification =
  "success" | "learner_failure" | "infrastructure_failure" | "control_plane";

export type ExecutionLimits = {
  readonly compileTimeoutMs: number;
  readonly runTimeoutMs: number;
  readonly memoryLimitMb: number;
  readonly cpuLimitMillis: number;
  readonly pidLimit: number;
  readonly outputLimitBytes: number;
  readonly sourceLimitBytes: number;
};

export type LearnerRunInput = {
  readonly source: string;
  readonly language: ProblemLanguage;
};

export type ServerDescriptorContext = {
  readonly runId: OpaqueId<"codeRun">;
  readonly attemptId: OpaqueId<"attempt">;
  readonly replayId: string;
  readonly problemVersionId: ProblemVersionId;
  readonly manifestDigest: ContentChecksum;
  readonly fixtureDigest: ContentChecksum;
  readonly runtimeImageDigest: ContentChecksum;
  readonly languageManifest: ProblemLanguageManifest;
  readonly limits: ExecutionLimits;
  readonly phasePlan: readonly ExecutionPhase[];
  readonly policyVersion: PolicyVersion | number;
  readonly keyId: string;
  readonly leaseEpoch: number;
  readonly issuedAt: Instant | string;
  readonly expiresAt: Instant | string;
};

export type RunDescriptor = {
  readonly schemaVersion: ExecutionSchemaVersion;
  readonly runId: OpaqueId<"codeRun">;
  readonly attemptId: OpaqueId<"attempt">;
  readonly problemVersionId: ProblemVersionId;
  readonly language: ProblemLanguage;
  readonly adapterId: `harness.${ProblemLanguage}`;
  readonly entrySignature: string;
  readonly manifestDigest: ContentChecksum;
  readonly fixtureDigest: ContentChecksum;
  readonly runtimeImageDigest: ContentChecksum;
  readonly sourceDigest: ContentChecksum;
  readonly limits: ExecutionLimits;
  readonly phasePlan: readonly ExecutionPhase[];
  readonly replayId: string;
  readonly policyVersion: PolicyVersion;
  readonly keyId: string;
  readonly leaseEpoch: number;
  readonly issuedAt: Instant;
  readonly expiresAt: Instant;
};

export type DescriptorDigest = Branded<ContentChecksum, "DescriptorDigest">;

export type ContractFailureCode =
  | "invalid_contract"
  | "unsupported_schema_version"
  | "invalid_identifier"
  | "invalid_checksum"
  | "invalid_timestamp"
  | "invalid_expiry"
  | "invalid_limits"
  | "invalid_phase"
  | "language_mismatch"
  | "key_mismatch"
  | "key_not_acceptable"
  | "signature_invalid"
  | "expired"
  | "not_yet_valid"
  | "descriptor_mismatch"
  | "run_mismatch"
  | "replay_mismatch"
  | "lease_epoch_mismatch"
  | "classification_mismatch"
  | "invalid_result";

export type ContractFailure = {
  readonly code: ContractFailureCode;
  readonly message: string;
};

export function contractFailure(code: ContractFailureCode, message: string): ContractFailure {
  return { code, message };
}
