export {
  canonicalizeRunDescriptor,
  createRunDescriptor,
  digestDescriptor,
  parseRunDescriptor,
  sha256Digest,
} from "./run-descriptor.ts";

export {
  canonicalizeExecutionResult,
  createExecutionResult,
  parseExecutionResult,
} from "./result.ts";

export {
  generateSigningKeyPair,
  importSigningKeyPair,
  signExecutionResult,
  signRunDescriptor,
  verifyExecutionResult,
  verifyRunDescriptor,
} from "./signing.ts";

export type {
  ContractFailure,
  ContractFailureCode,
  DescriptorDigest,
  ExecutionLimits,
  ExecutionPhase,
  ExecutionSchemaVersion,
  LearnerRunInput,
  ResultClassification,
  RunDescriptor,
  RunState,
  ServerDescriptorContext,
  TerminalCategory,
} from "./types.ts";

export {
  CURRENT_EXECUTION_SCHEMA_VERSION,
  EXECUTION_PHASES,
  RUN_STATES,
  TERMINAL_CATEGORIES,
} from "./types.ts";

export type { ExecutionResult, ExecutionResultInput } from "./result.ts";

export type {
  ResultVerificationOptions,
  SignedExecutionResult,
  SignedRunDescriptor,
  SigningKeyPair,
  VerificationKey,
  VerificationOptions,
} from "./signing.ts";
