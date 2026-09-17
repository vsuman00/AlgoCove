import { createHash } from "node:crypto";
import {
  err,
  languageProfile,
  parseContentChecksum,
  parseId,
  parseInstant,
  policyVersion,
  PROBLEM_LANGUAGES,
  type ContentChecksum,
  type ProblemLanguage,
  type Result,
} from "@algocove/domain";
import {
  contractFailure,
  CURRENT_EXECUTION_SCHEMA_VERSION,
  EXECUTION_PHASES,
  type ContractFailure,
  type ExecutionLimits,
  type ExecutionPhase,
  type LearnerRunInput,
  type RunDescriptor,
  type ServerDescriptorContext,
} from "./types.ts";

const MAX_DESCRIPTOR_TTL_MS = 5 * 60 * 1_000;
const MAX_SOURCE_BYTES = 1_048_576;
const MAX_REPLAY_ID_LENGTH = 128;
const MAX_KEY_ID_LENGTH = 128;
const DESCRIPTOR_KEYS = [
  "schemaVersion",
  "runId",
  "attemptId",
  "problemVersionId",
  "language",
  "adapterId",
  "entrySignature",
  "manifestDigest",
  "fixtureDigest",
  "runtimeImageDigest",
  "sourceDigest",
  "limits",
  "phasePlan",
  "replayId",
  "policyVersion",
  "keyId",
  "leaseEpoch",
  "issuedAt",
  "expiresAt",
] as const;

type DescriptorInput = {
  readonly learner: LearnerRunInput;
  readonly server: ServerDescriptorContext;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProblemLanguage(value: unknown): value is ProblemLanguage {
  return typeof value === "string" && (PROBLEM_LANGUAGES as readonly string[]).includes(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isBoundedString(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    /^[A-Za-z0-9._:-]+$/.test(value)
  );
}

function validateDigest(value: unknown, field: string): Result<ContentChecksum, ContractFailure> {
  const parsed = parseContentChecksum(value);
  return parsed.ok
    ? parsed
    : err(contractFailure("invalid_checksum", `${field} must be a sha256 content checksum.`));
}

function validateTime(
  value: unknown,
  field: string,
): Result<
  ReturnType<typeof parseInstant> extends Result<infer T, unknown> ? T : never,
  ContractFailure
> {
  const parsed = parseInstant(value);
  return parsed.ok
    ? parsed
    : err(contractFailure("invalid_timestamp", `${field} must be a valid UTC instant.`));
}

function validateExpiry(issuedAt: string, expiresAt: string): Result<undefined, ContractFailure> {
  const issuedMs = Date.parse(issuedAt);
  const expiresMs = Date.parse(expiresAt);
  const ttl = expiresMs - issuedMs;
  if (!Number.isFinite(ttl) || ttl <= 0 || ttl > MAX_DESCRIPTOR_TTL_MS) {
    return err(
      contractFailure(
        "invalid_expiry",
        `Descriptor expiry must be after issue time and no more than ${MAX_DESCRIPTOR_TTL_MS}ms later.`,
      ),
    );
  }
  return { ok: true, value: undefined };
}

function validatePhasePlan(value: unknown): Result<readonly ExecutionPhase[], ContractFailure> {
  if (!Array.isArray(value) || value.length === 0 || value.length > EXECUTION_PHASES.length) {
    return err(
      contractFailure("invalid_phase", "A run must declare at least one execution phase."),
    );
  }
  const phases = value.filter((phase): phase is ExecutionPhase =>
    EXECUTION_PHASES.includes(phase as ExecutionPhase),
  );
  if (
    phases.length !== value.length ||
    new Set(phases).size !== phases.length ||
    !phases.includes("run")
  ) {
    return err(
      contractFailure(
        "invalid_phase",
        "Phase plan must contain unique compile/run phases and always include run.",
      ),
    );
  }
  if (phases.includes("compile") && phases.indexOf("compile") > phases.indexOf("run")) {
    return err(
      contractFailure("invalid_phase", "Compile must precede run when both phases are declared."),
    );
  }
  return { ok: true, value: phases };
}

function validateLimits(
  value: unknown,
  language: ProblemLanguage,
): Result<ExecutionLimits, ContractFailure> {
  if (!isRecord(value)) {
    return err(contractFailure("invalid_limits", "Execution limits must be an object."));
  }
  const fields = [
    "compileTimeoutMs",
    "runTimeoutMs",
    "memoryLimitMb",
    "cpuLimitMillis",
    "pidLimit",
    "outputLimitBytes",
    "sourceLimitBytes",
  ] as const;
  if (fields.some((field) => !isPositiveInteger(value[field]))) {
    return err(
      contractFailure("invalid_limits", "Execution limits must be positive safe integers."),
    );
  }
  const limits = value as unknown as ExecutionLimits;
  const profile = languageProfile(language).limitsProfile;
  if (
    limits.compileTimeoutMs !== profile.compileTimeoutMs ||
    limits.runTimeoutMs !== profile.runTimeoutMs ||
    limits.memoryLimitMb !== profile.memoryLimitMb ||
    limits.compileTimeoutMs > 60_000 ||
    limits.runTimeoutMs > 30_000 ||
    limits.memoryLimitMb > 4_096 ||
    limits.cpuLimitMillis > 120_000 ||
    limits.pidLimit > 512 ||
    limits.outputLimitBytes > 8 * 1_048_576 ||
    limits.sourceLimitBytes > MAX_SOURCE_BYTES
  ) {
    return err(
      contractFailure(
        "invalid_limits",
        "Execution limits do not match the published language profile or safe maximums.",
      ),
    );
  }
  return { ok: true, value: { ...limits } };
}

function validateCommonContext(
  context: ServerDescriptorContext,
  language: ProblemLanguage,
): Result<undefined, ContractFailure> {
  if (
    !parseId("codeRun", context.runId).ok ||
    !parseId("attempt", context.attemptId).ok ||
    !parseId("problemVersion", context.problemVersionId).ok
  ) {
    return err(
      contractFailure(
        "invalid_identifier",
        "Run, attempt, and problem-version identifiers must be valid opaque IDs.",
      ),
    );
  }
  if (
    !isBoundedString(context.replayId, MAX_REPLAY_ID_LENGTH) ||
    !isBoundedString(context.keyId, MAX_KEY_ID_LENGTH)
  ) {
    return err(
      contractFailure(
        "invalid_identifier",
        "Replay and key identifiers must be bounded safe strings.",
      ),
    );
  }
  if (!isPositiveInteger(context.leaseEpoch)) {
    return err(
      contractFailure("invalid_identifier", "Lease epoch must be a positive safe integer."),
    );
  }
  const policy = policyVersion(context.policyVersion);
  if (!policy.ok) return err(contractFailure("invalid_contract", policy.error.message));
  if (context.languageManifest.language !== language) {
    return err(
      contractFailure(
        "language_mismatch",
        "Learner language must match the server-selected published manifest.",
      ),
    );
  }
  const profile = languageProfile(language);
  if (
    context.languageManifest.adapterId !== profile.adapterId ||
    context.languageManifest.entrySignature !== profile.entrySignature
  ) {
    return err(
      contractFailure(
        "language_mismatch",
        "Published language adapter does not match the domain profile.",
      ),
    );
  }
  for (const field of ["manifestDigest", "fixtureDigest", "runtimeImageDigest"] as const) {
    if (!validateDigest(context[field], field).ok) {
      return err(
        contractFailure("invalid_checksum", `${field} must be a sha256 content checksum.`),
      );
    }
  }
  const issued = validateTime(context.issuedAt, "issuedAt");
  const expires = validateTime(context.expiresAt, "expiresAt");
  if (!issued.ok || !expires.ok)
    return err(
      contractFailure("invalid_timestamp", "Descriptor timestamps must be valid UTC instants."),
    );
  const expiry = validateExpiry(issued.value, expires.value);
  if (!expiry.ok) return expiry;
  return { ok: true, value: undefined };
}

export function sha256Digest(value: string): ContentChecksum {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}` as ContentChecksum;
}

export function createRunDescriptor(
  input: DescriptorInput,
): Result<RunDescriptor, ContractFailure> {
  if (!isProblemLanguage(input.learner.language) || typeof input.learner.source !== "string") {
    return err(
      contractFailure(
        "invalid_contract",
        "Learner input must contain only a supported language and source string.",
      ),
    );
  }
  if (Buffer.byteLength(input.learner.source, "utf8") > MAX_SOURCE_BYTES) {
    return err(
      contractFailure("invalid_contract", "Learner source exceeds the server-owned source limit."),
    );
  }
  const context = validateCommonContext(input.server, input.learner.language);
  if (!context.ok) return context;
  const limits = validateLimits(input.server.limits, input.learner.language);
  if (!limits.ok) return limits;
  const phasePlan = validatePhasePlan(input.server.phasePlan);
  if (!phasePlan.ok) return phasePlan;
  const issuedAt = validateTime(input.server.issuedAt, "issuedAt");
  const expiresAt = validateTime(input.server.expiresAt, "expiresAt");
  if (!issuedAt.ok || !expiresAt.ok)
    return err(
      contractFailure("invalid_timestamp", "Descriptor timestamps must be valid UTC instants."),
    );
  const policy = policyVersion(input.server.policyVersion);
  if (!policy.ok) return err(contractFailure("invalid_contract", policy.error.message));
  const manifestDigest = validateDigest(input.server.manifestDigest, "manifestDigest");
  const fixtureDigest = validateDigest(input.server.fixtureDigest, "fixtureDigest");
  const runtimeImageDigest = validateDigest(input.server.runtimeImageDigest, "runtimeImageDigest");
  if (!manifestDigest.ok || !fixtureDigest.ok || !runtimeImageDigest.ok) {
    return err(
      contractFailure("invalid_checksum", "Descriptor digests must be valid sha256 checksums."),
    );
  }
  return {
    ok: true,
    value: {
      schemaVersion: CURRENT_EXECUTION_SCHEMA_VERSION,
      runId: input.server.runId,
      attemptId: input.server.attemptId,
      problemVersionId: input.server.problemVersionId,
      language: input.learner.language,
      adapterId: input.server.languageManifest.adapterId,
      entrySignature: input.server.languageManifest.entrySignature,
      manifestDigest: manifestDigest.value,
      fixtureDigest: fixtureDigest.value,
      runtimeImageDigest: runtimeImageDigest.value,
      sourceDigest: sha256Digest(input.learner.source),
      limits: limits.value,
      phasePlan: phasePlan.value,
      replayId: input.server.replayId,
      policyVersion: policy.value,
      keyId: input.server.keyId,
      leaseEpoch: input.server.leaseEpoch,
      issuedAt: issuedAt.value,
      expiresAt: expiresAt.value,
    },
  };
}

export function canonicalizeRunDescriptor(descriptor: RunDescriptor): string {
  return JSON.stringify({
    schemaVersion: descriptor.schemaVersion,
    runId: descriptor.runId,
    attemptId: descriptor.attemptId,
    problemVersionId: descriptor.problemVersionId,
    language: descriptor.language,
    adapterId: descriptor.adapterId,
    entrySignature: descriptor.entrySignature,
    manifestDigest: descriptor.manifestDigest,
    fixtureDigest: descriptor.fixtureDigest,
    runtimeImageDigest: descriptor.runtimeImageDigest,
    sourceDigest: descriptor.sourceDigest,
    limits: {
      compileTimeoutMs: descriptor.limits.compileTimeoutMs,
      runTimeoutMs: descriptor.limits.runTimeoutMs,
      memoryLimitMb: descriptor.limits.memoryLimitMb,
      cpuLimitMillis: descriptor.limits.cpuLimitMillis,
      pidLimit: descriptor.limits.pidLimit,
      outputLimitBytes: descriptor.limits.outputLimitBytes,
      sourceLimitBytes: descriptor.limits.sourceLimitBytes,
    },
    phasePlan: [...descriptor.phasePlan],
    replayId: descriptor.replayId,
    policyVersion: descriptor.policyVersion,
    keyId: descriptor.keyId,
    leaseEpoch: descriptor.leaseEpoch,
    issuedAt: descriptor.issuedAt,
    expiresAt: descriptor.expiresAt,
  });
}

export function digestDescriptor(descriptor: RunDescriptor): ContentChecksum {
  return sha256Digest(canonicalizeRunDescriptor(descriptor));
}

export function parseRunDescriptor(input: unknown): Result<RunDescriptor, ContractFailure> {
  if (!isRecord(input))
    return err(contractFailure("invalid_contract", "Run descriptor must be an object."));
  if (input.schemaVersion !== CURRENT_EXECUTION_SCHEMA_VERSION) {
    return err(
      contractFailure(
        "unsupported_schema_version",
        "Run descriptor schema version is not supported.",
      ),
    );
  }
  if (Object.keys(input).some((key) => !(DESCRIPTOR_KEYS as readonly string[]).includes(key))) {
    return err(contractFailure("invalid_contract", "Run descriptor contains an unknown field."));
  }
  if (
    !isProblemLanguage(input.language) ||
    typeof input.adapterId !== "string" ||
    typeof input.entrySignature !== "string"
  ) {
    return err(contractFailure("invalid_contract", "Run descriptor language fields are invalid."));
  }
  const profile = languageProfile(input.language);
  if (input.adapterId !== profile.adapterId || input.entrySignature !== profile.entrySignature) {
    return err(
      contractFailure(
        "language_mismatch",
        "Run descriptor language adapter does not match the domain profile.",
      ),
    );
  }
  const runId = parseId("codeRun", input.runId);
  const attemptId = parseId("attempt", input.attemptId);
  const problemVersionId = parseId("problemVersion", input.problemVersionId);
  if (!runId.ok || !attemptId.ok || !problemVersionId.ok) {
    return err(contractFailure("invalid_identifier", "Run descriptor identifiers are invalid."));
  }
  const checksums = DESCRIPTOR_KEYS.filter((key) => key.endsWith("Digest")).map(
    (key) => [key, validateDigest(input[key], key)] as const,
  );
  if (checksums.some(([, result]) => !result.ok)) {
    return err(contractFailure("invalid_checksum", "Run descriptor contains an invalid digest."));
  }
  const limits = validateLimits(input.limits, input.language);
  if (!limits.ok) return limits;
  const phasePlan = validatePhasePlan(input.phasePlan);
  if (!phasePlan.ok) return phasePlan;
  if (
    !isBoundedString(input.replayId, MAX_REPLAY_ID_LENGTH) ||
    !isBoundedString(input.keyId, MAX_KEY_ID_LENGTH)
  ) {
    return err(
      contractFailure(
        "invalid_identifier",
        "Run descriptor replay and key identifiers are invalid.",
      ),
    );
  }
  const policy = policyVersion(input.policyVersion as number);
  if (!policy.ok) return err(contractFailure("invalid_contract", policy.error.message));
  if (!isPositiveInteger(input.leaseEpoch))
    return err(contractFailure("invalid_identifier", "Lease epoch is invalid."));
  const issuedAt = validateTime(input.issuedAt, "issuedAt");
  const expiresAt = validateTime(input.expiresAt, "expiresAt");
  if (!issuedAt.ok || !expiresAt.ok)
    return err(contractFailure("invalid_timestamp", "Run descriptor timestamps are invalid."));
  const expiry = validateExpiry(issuedAt.value, expiresAt.value);
  if (!expiry.ok) return expiry;
  return {
    ok: true,
    value: {
      schemaVersion: CURRENT_EXECUTION_SCHEMA_VERSION,
      runId: runId.value,
      attemptId: attemptId.value,
      problemVersionId: problemVersionId.value,
      language: input.language,
      adapterId: input.adapterId,
      entrySignature: input.entrySignature,
      manifestDigest: checksums[0]?.[1].ok ? checksums[0][1].value : ("" as ContentChecksum),
      fixtureDigest: checksums[1]?.[1].ok ? checksums[1][1].value : ("" as ContentChecksum),
      runtimeImageDigest: checksums[2]?.[1].ok ? checksums[2][1].value : ("" as ContentChecksum),
      sourceDigest: checksums[3]?.[1].ok ? checksums[3][1].value : ("" as ContentChecksum),
      limits: limits.value,
      phasePlan: phasePlan.value,
      replayId: input.replayId,
      policyVersion: policy.value,
      keyId: input.keyId,
      leaseEpoch: input.leaseEpoch as number,
      issuedAt: issuedAt.value,
      expiresAt: expiresAt.value,
    },
  };
}
