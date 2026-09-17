import {
  err,
  parseContentChecksum,
  parseId,
  parseInstant,
  type ContentChecksum,
  type Result,
} from "@algocove/domain";
import { digestDescriptor } from "./run-descriptor.ts";
import {
  contractFailure,
  CURRENT_EXECUTION_SCHEMA_VERSION,
  TERMINAL_CATEGORIES,
  type ContractFailure,
  type ExecutionPhase,
  type ResultClassification,
  type RunDescriptor,
  type TerminalCategory,
} from "./types.ts";

const MAX_RESULT_TTL_MS = 10 * 60 * 1_000;
const MAX_RESULT_ID_LENGTH = 128;
const MAX_DIAGNOSTIC_LENGTH = 4_096;
const MAX_DIAGNOSTICS = 8;
const RESULT_KEYS = [
  "schemaVersion",
  "resultId",
  "runId",
  "attemptId",
  "replayId",
  "leaseEpoch",
  "descriptorDigest",
  "terminalCategory",
  "classification",
  "phase",
  "issuedAt",
  "expiresAt",
  "keyId",
  "diagnostics",
] as const;

export type ExecutionResult = {
  readonly schemaVersion: typeof CURRENT_EXECUTION_SCHEMA_VERSION;
  readonly resultId: string;
  readonly runId: RunDescriptor["runId"];
  readonly attemptId: RunDescriptor["attemptId"];
  readonly replayId: RunDescriptor["replayId"];
  readonly leaseEpoch: number;
  readonly descriptorDigest: ContentChecksum;
  readonly terminalCategory: TerminalCategory;
  readonly classification: ResultClassification;
  readonly phase: ExecutionPhase;
  readonly issuedAt: RunDescriptor["issuedAt"];
  readonly expiresAt: RunDescriptor["expiresAt"];
  readonly keyId: RunDescriptor["keyId"];
  readonly diagnostics?: readonly string[];
};

export type ExecutionResultInput = {
  readonly descriptor: RunDescriptor;
  readonly resultId: string;
  readonly terminalCategory: TerminalCategory;
  readonly phase: ExecutionPhase;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly classification?: ResultClassification;
  readonly diagnostics?: readonly string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedString(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    /^[A-Za-z0-9._:-]+$/.test(value)
  );
}

function classificationFor(category: TerminalCategory): ResultClassification {
  if (category === "pass") return "success";
  if (category === "cancelled") return "control_plane";
  if (category === "infrastructure_error") return "infrastructure_failure";
  return "learner_failure";
}

function validateResultTime(
  issuedAt: string,
  expiresAt: string,
): Result<undefined, ContractFailure> {
  const issued = parseInstant(issuedAt);
  const expires = parseInstant(expiresAt);
  if (!issued.ok || !expires.ok)
    return err(
      contractFailure("invalid_timestamp", "Result timestamps must be valid UTC instants."),
    );
  const ttl = Date.parse(expires.value) - Date.parse(issued.value);
  if (ttl <= 0 || ttl > MAX_RESULT_TTL_MS) {
    return err(
      contractFailure(
        "invalid_expiry",
        "Result expiry must be after issue time and within the result validity window.",
      ),
    );
  }
  return { ok: true, value: undefined };
}

function validateDiagnostics(
  diagnostics: readonly string[] | undefined,
): Result<readonly string[] | undefined, ContractFailure> {
  if (diagnostics === undefined) return { ok: true, value: undefined };
  if (
    diagnostics.length > MAX_DIAGNOSTICS ||
    diagnostics.some((diagnostic) => diagnostic.length > MAX_DIAGNOSTIC_LENGTH)
  ) {
    return err(
      contractFailure(
        "invalid_result",
        "Result diagnostics are bounded and cannot contain oversized entries.",
      ),
    );
  }
  return { ok: true, value: [...diagnostics] };
}

export function createExecutionResult(
  input: ExecutionResultInput,
): Result<ExecutionResult, ContractFailure> {
  if (!isBoundedString(input.resultId, MAX_RESULT_ID_LENGTH)) {
    return err(contractFailure("invalid_result", "Result ID must be a bounded safe string."));
  }
  if (!TERMINAL_CATEGORIES.includes(input.terminalCategory)) {
    return err(contractFailure("invalid_result", "Terminal category is not supported."));
  }
  if (!input.descriptor.phasePlan.includes(input.phase)) {
    return err(
      contractFailure("invalid_phase", "Result phase must be declared by the run descriptor."),
    );
  }
  const expectedClassification = classificationFor(input.terminalCategory);
  if (input.classification !== undefined && input.classification !== expectedClassification) {
    return err(
      contractFailure(
        "classification_mismatch",
        "Terminal category determines result classification.",
      ),
    );
  }
  const time = validateResultTime(input.issuedAt, input.expiresAt);
  if (!time.ok) return time;
  if (Date.parse(input.issuedAt) < Date.parse(input.descriptor.issuedAt)) {
    return err(
      contractFailure("invalid_timestamp", "Result cannot predate its signed run descriptor."),
    );
  }
  const diagnostics = validateDiagnostics(input.diagnostics);
  if (!diagnostics.ok) return diagnostics;
  return {
    ok: true,
    value: {
      schemaVersion: CURRENT_EXECUTION_SCHEMA_VERSION,
      resultId: input.resultId,
      runId: input.descriptor.runId,
      attemptId: input.descriptor.attemptId,
      replayId: input.descriptor.replayId,
      leaseEpoch: input.descriptor.leaseEpoch,
      descriptorDigest: digestDescriptor(input.descriptor),
      terminalCategory: input.terminalCategory,
      classification: expectedClassification,
      phase: input.phase,
      issuedAt: input.issuedAt as RunDescriptor["issuedAt"],
      expiresAt: input.expiresAt as RunDescriptor["expiresAt"],
      keyId: input.descriptor.keyId,
      ...(diagnostics.value === undefined ? {} : { diagnostics: diagnostics.value }),
    },
  };
}

export function canonicalizeExecutionResult(result: ExecutionResult): string {
  return JSON.stringify({
    schemaVersion: result.schemaVersion,
    resultId: result.resultId,
    runId: result.runId,
    attemptId: result.attemptId,
    replayId: result.replayId,
    leaseEpoch: result.leaseEpoch,
    descriptorDigest: result.descriptorDigest,
    terminalCategory: result.terminalCategory,
    classification: result.classification,
    phase: result.phase,
    issuedAt: result.issuedAt,
    expiresAt: result.expiresAt,
    keyId: result.keyId,
    ...(result.diagnostics === undefined ? {} : { diagnostics: [...result.diagnostics] }),
  });
}

export function parseExecutionResult(input: unknown): Result<ExecutionResult, ContractFailure> {
  if (!isRecord(input))
    return err(contractFailure("invalid_result", "Execution result must be an object."));
  if (input.schemaVersion !== CURRENT_EXECUTION_SCHEMA_VERSION) {
    return err(
      contractFailure(
        "unsupported_schema_version",
        "Execution result schema version is not supported.",
      ),
    );
  }
  if (Object.keys(input).some((key) => !(RESULT_KEYS as readonly string[]).includes(key))) {
    return err(contractFailure("invalid_result", "Execution result contains an unknown field."));
  }
  const runId = parseId("codeRun", input.runId);
  const attemptId = parseId("attempt", input.attemptId);
  const descriptorDigest = parseContentChecksum(input.descriptorDigest);
  if (!runId.ok || !attemptId.ok || !descriptorDigest.ok) {
    return err(
      contractFailure("invalid_result", "Execution result identifiers or digests are invalid."),
    );
  }
  if (
    !isBoundedString(input.resultId, MAX_RESULT_ID_LENGTH) ||
    !isBoundedString(input.replayId, MAX_RESULT_ID_LENGTH) ||
    !isBoundedString(input.keyId, MAX_RESULT_ID_LENGTH)
  ) {
    return err(contractFailure("invalid_result", "Execution result identifiers are invalid."));
  }
  if (!TERMINAL_CATEGORIES.includes(input.terminalCategory as TerminalCategory)) {
    return err(contractFailure("invalid_result", "Execution result terminal category is invalid."));
  }
  const category = input.terminalCategory as TerminalCategory;
  if (!(["compile", "run"] as readonly string[]).includes(input.phase as string)) {
    return err(contractFailure("invalid_phase", "Execution result phase is invalid."));
  }
  const classification = classificationFor(category);
  if (input.classification !== classification)
    return err(
      contractFailure("classification_mismatch", "Execution result classification is invalid."),
    );
  if (!Number.isSafeInteger(input.leaseEpoch) || (input.leaseEpoch as number) <= 0) {
    return err(contractFailure("invalid_result", "Execution result lease epoch is invalid."));
  }
  const issuedAt = parseInstant(input.issuedAt);
  const expiresAt = parseInstant(input.expiresAt);
  if (!issuedAt.ok || !expiresAt.ok)
    return err(contractFailure("invalid_timestamp", "Execution result timestamps are invalid."));
  const time = validateResultTime(issuedAt.value, expiresAt.value);
  if (!time.ok) return time;
  if (
    input.diagnostics !== undefined &&
    (!Array.isArray(input.diagnostics) ||
      input.diagnostics.some((value) => typeof value !== "string"))
  ) {
    return err(contractFailure("invalid_result", "Execution result diagnostics must be strings."));
  }
  const diagnostics = validateDiagnostics(input.diagnostics as readonly string[] | undefined);
  if (!diagnostics.ok) return diagnostics;
  return {
    ok: true,
    value: {
      schemaVersion: CURRENT_EXECUTION_SCHEMA_VERSION,
      resultId: input.resultId,
      runId: runId.value,
      attemptId: attemptId.value,
      replayId: input.replayId,
      leaseEpoch: input.leaseEpoch as number,
      descriptorDigest: descriptorDigest.value,
      terminalCategory: category,
      classification,
      phase: input.phase as ExecutionPhase,
      issuedAt: issuedAt.value,
      expiresAt: expiresAt.value,
      keyId: input.keyId,
      ...(diagnostics.value === undefined ? {} : { diagnostics: diagnostics.value }),
    },
  };
}
