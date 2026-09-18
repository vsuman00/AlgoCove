import {
  recordRunRequested,
  submitAttempt,
  type AttemptEvent,
  type CodeRunId,
  type ContentChecksum,
  type LanguageManifestId,
  type LearningAttempt,
  type OpaqueId,
  type ProblemLanguage,
  type ProblemVersionId,
} from "@algocove/domain";
import { createOutboxEvent, type OutboxEvent } from "./outbox.ts";
import {
  conflictError,
  dependencyUnavailableError,
  notFoundError,
  validationError,
} from "./errors.ts";
import type { PracticeRepository } from "./practice-use-cases.ts";
import type { RequestContext } from "./request-context.ts";

/** The learner-facing action is explicit: Run never creates assessment credit. */
export type CodeRunMode = "run" | "submit";

export type ExecutionTerminalCategory =
  | "pass"
  | "wrong_answer"
  | "compile_error"
  | "type_error"
  | "runtime_error"
  | "limits"
  | "cancelled"
  | "infrastructure_error";

export type ExecutionResultClassification =
  "success" | "learner_failure" | "infrastructure_failure" | "control_plane";

/**
 * Application-owned run metadata. Raw source is intentionally absent: the
 * execution adapter receives it only for the immediate dispatch and durable
 * records retain the checksum and bounded length instead.
 */
export type CodeRunRecord = {
  readonly runId: CodeRunId;
  readonly learnerId: LearningAttempt["learnerId"];
  readonly attemptId: LearningAttempt["attemptId"];
  readonly mode: CodeRunMode;
  readonly problemVersionId: ProblemVersionId;
  readonly manifestId: LanguageManifestId;
  readonly language: ProblemLanguage;
  readonly sourceChecksum: ContentChecksum;
  readonly sourceLength: number;
  readonly requestedAt: LearningAttempt["updatedAt"];
  readonly terminalResultId: string | null;
  readonly terminalCategory: ExecutionTerminalCategory | null;
  readonly classification: ExecutionResultClassification | null;
  readonly completedAt: LearningAttempt["updatedAt"] | null;
};

export type CodeRunRequest = Omit<
  CodeRunRecord,
  "terminalResultId" | "terminalCategory" | "classification" | "completedAt"
>;

/** Trusted means the execution adapter already verified the signed result. */
export type TrustedExecutionResult = {
  readonly resultId: string;
  readonly runId: CodeRunId;
  readonly attemptId: LearningAttempt["attemptId"];
  readonly problemVersionId: ProblemVersionId;
  readonly manifestId: LanguageManifestId;
  readonly language: ProblemLanguage;
  readonly sourceChecksum: ContentChecksum;
  readonly terminalCategory: ExecutionTerminalCategory;
  readonly classification: ExecutionResultClassification;
  readonly descriptorDigest: ContentChecksum;
  readonly replayId: string;
  readonly leaseEpoch: number;
  readonly completedAt: LearningAttempt["updatedAt"];
};

export type AssessmentObservation = {
  readonly observationId: OpaqueId<"event">;
  readonly runId: CodeRunId;
  readonly attemptId: LearningAttempt["attemptId"];
  readonly learnerId: LearningAttempt["learnerId"];
  readonly problemVersionId: ProblemVersionId;
  readonly manifestId: LanguageManifestId;
  readonly language: ProblemLanguage;
  readonly sourceChecksum: ContentChecksum;
  readonly resultId: string;
  readonly terminalCategory: ExecutionTerminalCategory;
  readonly passed: boolean;
  readonly observedAt: LearningAttempt["updatedAt"];
};

export type CodeRunCommit = {
  readonly disposition: "committed" | "replayed";
  readonly attempt: LearningAttempt;
  readonly observation: AssessmentObservation | null;
};

/**
 * This port is intentionally broader than PracticeRepository. Its concrete
 * PostgreSQL adapter must begin one transaction before locking the attempt and
 * commit the run, terminal observation, attempt transition, and outbox event
 * together. The application never reaches into execution-control directly.
 */
export type CodeRunRepository = PracticeRepository & {
  createRunRequest(input: {
    readonly run: CodeRunRequest;
    readonly attempt: LearningAttempt;
    readonly event: AttemptEvent;
    readonly expectedAttemptVersion: number;
    readonly outbox: OutboxEvent;
  }): Promise<LearningAttempt | null>;
  getRun(runId: CodeRunId, learnerId: LearningAttempt["learnerId"]): Promise<CodeRunRecord | null>;
  commitTerminalResult(input: {
    readonly run: CodeRunRecord;
    readonly result: TrustedExecutionResult;
    readonly attempt: LearningAttempt;
    readonly event: AttemptEvent | null;
    readonly expectedAttemptVersion: number | null;
    readonly observation: AssessmentObservation | null;
    readonly outbox: OutboxEvent | null;
  }): Promise<CodeRunCommit | null>;
};

export type ExecutionRelayPreparation = {
  /** Descriptor-only event; source material must never be present in this payload. */
  readonly outbox: OutboxEvent;
  /** Adapter-owned ephemeral state used only for the immediate dispatch. */
  readonly token: unknown;
};

export type ExecutionRelay = {
  prepare(input: {
    readonly run: CodeRunRequest;
    readonly source: string;
    readonly eventId: OpaqueId<"event">;
  }): Promise<ExecutionRelayPreparation>;
  dispatch(input: {
    readonly run: CodeRunRequest;
    /** Ephemeral source delivery; adapters must never place it in relay payloads or logs. */
    readonly source: string;
    readonly preparation: ExecutionRelayPreparation;
  }): Promise<{ readonly runId: CodeRunId; readonly replayed: boolean }>;
  cancel(input: {
    readonly runId: CodeRunId;
    readonly reason: "learner" | "system" | "timeout";
  }): Promise<void>;
};

/**
 * Read-only result lookup used after an ambiguous relay or worker response.
 * The adapter behind this port must only return results that passed the
 * execution-control signature, descriptor, and lease checks.
 */
export type ExecutionResultLookup = {
  getTerminalResult(input: {
    readonly runId: CodeRunId;
    readonly attemptId: LearningAttempt["attemptId"];
    readonly learnerId: LearningAttempt["learnerId"];
  }): Promise<TrustedExecutionResult | null>;
};

export async function requestPracticeCodeRun(
  context: RequestContext,
  repository: CodeRunRepository,
  relay: ExecutionRelay,
  input: {
    readonly attemptId: LearningAttempt["attemptId"];
    readonly mode: CodeRunMode;
    readonly source: string;
    readonly sourceChecksum: ContentChecksum;
    readonly sourceLength: number;
  },
): Promise<{ readonly attempt: LearningAttempt; readonly run: CodeRunRequest }> {
  const attempt = await ownedAttempt(context, repository, input.attemptId);
  validateSourceLength(input.sourceLength);
  if (input.mode === "submit" && attempt.status !== "active") {
    throw validationError("Only an active attempt can be submitted.", {
      field: "invalid_state",
    });
  }

  const runId = context.ids.generate("codeRun");
  const transition = recordRunRequested(attempt, {
    eventId: context.ids.generate("event"),
    runId,
    sourceChecksum: input.sourceChecksum,
    occurredAt: context.now,
  });
  if (!transition.ok) {
    throw validationError(transition.error.message, { field: transition.error.code });
  }

  const run: CodeRunRequest = {
    runId,
    learnerId: attempt.learnerId,
    attemptId: attempt.attemptId,
    mode: input.mode,
    problemVersionId: attempt.problemVersionId,
    manifestId: attempt.manifestId,
    language: attempt.language,
    sourceChecksum: input.sourceChecksum,
    sourceLength: input.sourceLength,
    requestedAt: context.now,
  };
  let preparation: ExecutionRelayPreparation;
  try {
    preparation = await relay.prepare({
      run,
      source: input.source,
      eventId: context.ids.generate("event"),
    });
  } catch {
    throw dependencyUnavailableError("Execution dispatch is temporarily unavailable.");
  }
  const saved = await repository.createRunRequest({
    run,
    attempt: transition.value.attempt,
    event: transition.value.event,
    expectedAttemptVersion: attempt.version,
    outbox: preparation.outbox,
  });
  if (saved === null) throwVersionConflict(attempt.version);

  try {
    await relay.dispatch({ run, source: input.source, preparation });
  } catch {
    // The durable request remains available for relay retry/reconciliation. A
    // lost response is not permission to create a second run or roll it back.
    throw dependencyUnavailableError("Execution dispatch is temporarily unavailable.");
  }
  return { attempt: saved, run };
}

export async function ingestTrustedPracticeResult(
  context: RequestContext,
  repository: CodeRunRepository,
  input: { readonly result: TrustedExecutionResult },
): Promise<CodeRunCommit> {
  const run = await repository.getRun(input.result.runId, context.actor.userId);
  if (run === null) throw notFoundError("Execution run is not available.");
  validateResultMatchesRun(run, input.result);

  if (run.terminalResultId !== null) {
    if (run.terminalResultId !== input.result.resultId) {
      throw conflictError("A different terminal result already won this run.");
    }
    const attempt = await ownedAttempt(context, repository, run.attemptId);
    return { disposition: "replayed", attempt, observation: null };
  }

  const attempt = await ownedAttempt(context, repository, run.attemptId);
  if (attempt.status !== "active") {
    throw conflictError("The attempt is no longer accepting an execution result.");
  }

  const isSubmission = run.mode === "submit";
  const transition = isSubmission
    ? submitAttempt(attempt, {
        eventId: context.ids.generate("event"),
        runId: run.runId,
        sourceChecksum: run.sourceChecksum,
        submittedAt: input.result.completedAt,
      })
    : { ok: true as const, value: { attempt, event: null } };
  if (!transition.ok) {
    throw validationError(transition.error.message, { field: transition.error.code });
  }

  const observation = isSubmission ? makeAssessmentObservation(context, run, input.result) : null;
  const outbox = isSubmission
    ? createOutboxEvent({
        eventId: context.ids.generate("event"),
        topic: "practice.assessment.observed",
        aggregateId: run.attemptId,
        occurredAt: input.result.completedAt,
        payload: {
          observationId: observation?.observationId,
          runId: run.runId,
          attemptId: run.attemptId,
          learnerId: run.learnerId,
          problemVersionId: run.problemVersionId,
          manifestId: run.manifestId,
          language: run.language,
          sourceChecksum: run.sourceChecksum,
          resultId: input.result.resultId,
          terminalCategory: input.result.terminalCategory,
          passed: observation?.passed,
        },
      })
    : null;

  const committed = await repository.commitTerminalResult({
    run,
    result: input.result,
    attempt: transition.value.attempt,
    event: transition.value.event,
    expectedAttemptVersion: isSubmission ? attempt.version : null,
    observation,
    outbox,
  });
  if (committed === null) {
    throw conflictError("Execution result raced with another attempt operation.");
  }
  return committed;
}

export async function cancelPracticeCodeRun(
  context: RequestContext,
  repository: CodeRunRepository,
  relay: ExecutionRelay,
  input: {
    readonly runId: CodeRunId;
    readonly reason: "learner" | "system" | "timeout";
  },
): Promise<void> {
  const run = await repository.getRun(input.runId, context.actor.userId);
  if (run === null) throw notFoundError("Execution run is not available.");
  await relay.cancel({ runId: run.runId, reason: input.reason });
}

/**
 * Reconcile an uncertain execution without creating a replacement run. A
 * missing terminal result is intentionally a pending outcome; the execution
 * control reconciliation deadline is responsible for eventually producing a
 * trusted infrastructure result.
 */
export async function reconcilePracticeCodeRun(
  context: RequestContext,
  repository: CodeRunRepository,
  results: ExecutionResultLookup,
  runId: CodeRunId,
): Promise<CodeRunCommit | null> {
  const run = await repository.getRun(runId, context.actor.userId);
  if (run === null) throw notFoundError("Execution run is not available.");
  if (run.terminalResultId !== null) {
    const attempt = await ownedAttempt(context, repository, run.attemptId);
    return { disposition: "replayed", attempt, observation: null };
  }
  const result = await results.getTerminalResult({
    runId: run.runId,
    attemptId: run.attemptId,
    learnerId: run.learnerId,
  });
  if (result === null) return null;
  return ingestTrustedPracticeResult(context, repository, { result });
}

function makeAssessmentObservation(
  context: RequestContext,
  run: CodeRunRecord,
  result: TrustedExecutionResult,
): AssessmentObservation {
  return {
    observationId: context.ids.generate("event"),
    runId: run.runId,
    attemptId: run.attemptId,
    learnerId: run.learnerId,
    problemVersionId: run.problemVersionId,
    manifestId: run.manifestId,
    language: run.language,
    sourceChecksum: run.sourceChecksum,
    resultId: result.resultId,
    terminalCategory: result.terminalCategory,
    passed: result.terminalCategory === "pass" && result.classification === "success",
    observedAt: result.completedAt,
  };
}

function validateResultMatchesRun(run: CodeRunRecord, result: TrustedExecutionResult): void {
  const mismatches = [
    run.attemptId !== result.attemptId,
    run.problemVersionId !== result.problemVersionId,
    run.manifestId !== result.manifestId,
    run.language !== result.language,
    run.sourceChecksum !== result.sourceChecksum,
  ];
  if (mismatches.some(Boolean)) {
    throw validationError(
      "Execution result does not match the requested problem, language, manifest, or source.",
      { field: "result_mismatch" },
    );
  }
  const expectedClassification =
    result.terminalCategory === "pass"
      ? "success"
      : result.terminalCategory === "infrastructure_error"
        ? "infrastructure_failure"
        : result.terminalCategory === "cancelled"
          ? "control_plane"
          : "learner_failure";
  if (result.classification !== expectedClassification) {
    throw validationError("Execution result classification does not match its terminal category.", {
      field: "result_classification",
    });
  }
  if (
    result.resultId.length < 1 ||
    result.resultId.length > 128 ||
    result.replayId.length < 1 ||
    result.replayId.length > 128 ||
    !Number.isSafeInteger(result.leaseEpoch) ||
    result.leaseEpoch < 1
  ) {
    throw validationError("Execution result lease and replay metadata is invalid.", {
      field: "result_metadata",
    });
  }
}

function validateSourceLength(sourceLength: number): void {
  if (!Number.isSafeInteger(sourceLength) || sourceLength < 0 || sourceLength > 1_048_576) {
    throw validationError("Source length exceeds the bounded execution limit.", {
      field: "source_length",
    });
  }
}

async function ownedAttempt(
  context: RequestContext,
  repository: PracticeRepository,
  attemptId: LearningAttempt["attemptId"],
): Promise<LearningAttempt> {
  const attempt = await repository.getAttempt(attemptId, context.actor.userId);
  if (attempt === null) throw notFoundError("Learning attempt is not available.");
  return attempt;
}

function throwVersionConflict(expectedVersion: number): never {
  throw conflictError("Practice state changed since it was loaded.", { expectedVersion });
}
