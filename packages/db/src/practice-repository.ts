import type { Pool, QueryResultRow } from "pg";
import { snapshotAssessmentOutbox } from "@algocove/application";
import type {
  AssessmentObservation,
  CodeRunCommit,
  CodeRunRecord,
  CodeRunRequest,
  OutboxEvent,
  TrustedExecutionResult,
} from "@algocove/application";
import {
  type VerifiedRunEvidence,
  ATTEMPT_STATUSES,
  LEARNING_MODES,
  PROBLEM_LANGUAGES,
  SESSION_STATUSES,
  parseContentChecksum,
  parseId,
  parseInstant,
  type AttemptEvent,
  type LearningAttempt,
  type LearningSession,
  type OpaqueId,
} from "@algocove/domain";
import { withTransaction, type Transaction } from "./transaction.ts";

type SessionRow = QueryResultRow & {
  session_id: string;
  learner_id: string;
  mode: string;
  status: string;
  version: string | number;
  started_at: Date | string;
  updated_at: Date | string;
  ended_at: Date | string | null;
};

type AttemptRow = QueryResultRow & {
  attempt_id: string;
  session_id: string;
  learner_id: string;
  problem_version_id: string;
  manifest_id: string;
  language: string;
  mode: string;
  status: string;
  terminal_reason: LearningAttempt["terminalReason"];
  reset_from_attempt_id: string | null;
  version: string | number;
  event_sequence: string | number;
  started_at: Date | string;
  updated_at: Date | string;
  ended_at: Date | string | null;
};

type CodeRunRow = QueryResultRow & {
  run_id: string;
  learner_id: string;
  attempt_id: string;
  mode: CodeRunRecord["mode"];
  problem_version_id: string;
  manifest_id: string;
  language: string;
  source_checksum: string;
  source_length: number | string;
  requested_at: Date | string;
  terminal_result_id: string | null;
  terminal_category: CodeRunRecord["terminalCategory"];
  classification: CodeRunRecord["classification"];
  completed_at: Date | string | null;
};

const SESSION_COLUMNS = `session_id, learner_id, mode, status, version,
  started_at, updated_at, ended_at`;
const ATTEMPT_COLUMNS = `attempt_id, session_id, learner_id, problem_version_id,
  manifest_id, language, mode, status, terminal_reason, reset_from_attempt_id,
  version, event_sequence, started_at, updated_at, ended_at`;
const CODE_RUN_COLUMNS = `run_id, learner_id, attempt_id, mode, problem_version_id,
  manifest_id, language, source_checksum, source_length, requested_at, terminal_result_id,
  terminal_category, classification, completed_at`;

function positiveInteger(value: string | number, field: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1)
    throw new Error(`Database ${field} violates the practice contract.`);
  return parsed;
}

function instant(value: Date | string): LearningSession["startedAt"] {
  const parsed = parseInstant(value instanceof Date ? value : new Date(value));
  if (!parsed.ok) throw new Error("Database practice timestamp violates the instant contract.");
  return parsed.value;
}

function nullableInstant(value: Date | string | null): LearningSession["endedAt"] {
  return value === null ? null : instant(value);
}

function parseLearner(value: string) {
  const parsed = parseId("learner", value);
  if (!parsed.ok) throw new Error("Database practice learner violates the identifier contract.");
  return parsed.value;
}

function parseChecksum(value: string) {
  const parsed = parseContentChecksum(value);
  if (!parsed.ok) throw new Error("Database execution checksum violates the contract.");
  return parsed.value;
}

function parseIdOrThrow<TKind extends Parameters<typeof parseId>[0]>(kind: TKind, value: string) {
  const parsed = parseId(kind, value);
  if (!parsed.ok) throw new Error(`Database practice ${kind} violates the identifier contract.`);
  return parsed.value;
}

function oneOf<TValue extends string>(
  values: readonly TValue[],
  value: string,
  field: string,
): TValue {
  if (!values.includes(value as TValue))
    throw new Error(`Database practice ${field} violates the domain contract.`);
  return value as TValue;
}

function sessionFromRow(row: SessionRow): LearningSession {
  return {
    sessionId: parseIdOrThrow("session", row.session_id),
    learnerId: parseLearner(row.learner_id),
    mode: oneOf(LEARNING_MODES, row.mode, "mode"),
    status: oneOf(SESSION_STATUSES, row.status, "status"),
    version: positiveInteger(row.version, "session version"),
    startedAt: instant(row.started_at),
    updatedAt: instant(row.updated_at),
    endedAt: nullableInstant(row.ended_at),
  };
}

function attemptFromRow(row: AttemptRow): LearningAttempt {
  return {
    attemptId: parseIdOrThrow("attempt", row.attempt_id),
    sessionId: parseIdOrThrow("session", row.session_id),
    learnerId: parseLearner(row.learner_id),
    problemVersionId: parseIdOrThrow("problemVersion", row.problem_version_id),
    manifestId: parseIdOrThrow("languageManifest", row.manifest_id),
    language: oneOf(PROBLEM_LANGUAGES, row.language, "language"),
    mode: oneOf(LEARNING_MODES, row.mode, "mode"),
    status: oneOf(ATTEMPT_STATUSES, row.status, "status"),
    terminalReason: row.terminal_reason,
    resetFromAttemptId:
      row.reset_from_attempt_id === null
        ? null
        : parseIdOrThrow("attempt", row.reset_from_attempt_id),
    version: positiveInteger(row.version, "attempt version"),
    eventSequence: positiveInteger(row.event_sequence, "attempt event sequence"),
    startedAt: instant(row.started_at),
    updatedAt: instant(row.updated_at),
    endedAt: nullableInstant(row.ended_at),
  };
}

function positiveIntegerOrZero(value: string | number, field: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Database ${field} violates the execution contract.`);
  }
  return parsed;
}

function codeRunFromRow(row: CodeRunRow): CodeRunRecord {
  const sourceLength = positiveIntegerOrZero(row.source_length, "source length");
  if (sourceLength > 1_048_576) {
    throw new Error("Database execution source length violates the execution contract.");
  }
  return {
    runId: parseIdOrThrow("codeRun", row.run_id),
    learnerId: parseLearner(row.learner_id),
    attemptId: parseIdOrThrow("attempt", row.attempt_id),
    mode: oneOf(["run", "submit"] as const, row.mode, "run mode"),
    problemVersionId: parseIdOrThrow("problemVersion", row.problem_version_id),
    manifestId: parseIdOrThrow("languageManifest", row.manifest_id),
    language: oneOf(PROBLEM_LANGUAGES, row.language, "language"),
    sourceChecksum: parseChecksum(row.source_checksum),
    sourceLength,
    requestedAt: instant(row.requested_at),
    terminalResultId: row.terminal_result_id,
    terminalCategory:
      row.terminal_category === null
        ? null
        : oneOf(
            [
              "pass",
              "wrong_answer",
              "compile_error",
              "type_error",
              "runtime_error",
              "limits",
              "cancelled",
              "infrastructure_error",
            ] as const,
            row.terminal_category,
            "terminal category",
          ),
    classification:
      row.classification === null
        ? null
        : oneOf(
            ["success", "learner_failure", "infrastructure_failure", "control_plane"] as const,
            row.classification,
            "result classification",
          ),
    completedAt: nullableInstant(row.completed_at),
  };
}

async function oneSession(
  database: {
    query<TRow extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: readonly unknown[],
    ): Promise<{ rows: TRow[] }>;
  },
  sessionId: OpaqueId<"session">,
  learnerId: LearningSession["learnerId"],
  lock = false,
): Promise<LearningSession | null> {
  const result = await database.query<SessionRow>(
    `SELECT ${SESSION_COLUMNS} FROM practice.learning_session
      WHERE session_id = $1 AND learner_id = $2${lock ? " FOR UPDATE" : ""}`,
    [sessionId, learnerId],
  );
  const row = result.rows[0];
  return row === undefined ? null : sessionFromRow(row);
}

async function oneAttempt(
  database: {
    query<TRow extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: readonly unknown[],
    ): Promise<{ rows: TRow[] }>;
  },
  attemptId: OpaqueId<"attempt">,
  learnerId: LearningAttempt["learnerId"],
  lock = false,
): Promise<LearningAttempt | null> {
  const result = await database.query<AttemptRow>(
    `SELECT ${ATTEMPT_COLUMNS} FROM practice.attempt
      WHERE attempt_id = $1 AND learner_id = $2${lock ? " FOR UPDATE" : ""}`,
    [attemptId, learnerId],
  );
  const row = result.rows[0];
  return row === undefined ? null : attemptFromRow(row);
}

async function oneCodeRun(
  database: {
    query<TRow extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: readonly unknown[],
    ): Promise<{ rows: TRow[] }>;
  },
  runId: CodeRunRecord["runId"],
  learnerId: CodeRunRecord["learnerId"],
  lock = false,
): Promise<CodeRunRecord | null> {
  const result = await database.query<CodeRunRow>(
    `SELECT ${CODE_RUN_COLUMNS} FROM practice.code_run
      WHERE run_id = $1 AND learner_id = $2${lock ? " FOR UPDATE" : ""}`,
    [runId, learnerId],
  );
  const row = result.rows[0];
  return row === undefined ? null : codeRunFromRow(row);
}

async function oneCodeRunById(
  database: {
    query<TRow extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: readonly unknown[],
    ): Promise<{ rows: TRow[] }>;
  },
  runId: CodeRunRecord["runId"],
): Promise<CodeRunRecord | null> {
  const result = await database.query<CodeRunRow>(
    `SELECT ${CODE_RUN_COLUMNS} FROM practice.code_run WHERE run_id = $1`,
    [runId],
  );
  const row = result.rows[0];
  return row === undefined ? null : codeRunFromRow(row);
}

export type PracticeAttemptWrite = {
  readonly attempt: LearningAttempt;
  readonly event: AttemptEvent;
  readonly expectedVersion: number;
};

export type PracticeAttemptReset = {
  readonly previous: PracticeAttemptWrite;
  readonly next: {
    readonly attempt: LearningAttempt;
    readonly event: AttemptEvent;
  };
};

/** PostgreSQL adapter for the owner-scoped Task 25 practice state. */
export class PostgresPracticeRepository {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async createSession(session: LearningSession): Promise<LearningSession> {
    const result = await this.pool.query<SessionRow>(
      `INSERT INTO practice.learning_session
        (session_id, learner_id, mode, status, version, started_at, updated_at, ended_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${SESSION_COLUMNS}`,
      [
        session.sessionId,
        session.learnerId,
        session.mode,
        session.status,
        session.version,
        session.startedAt,
        session.updatedAt,
        session.endedAt,
      ],
    );
    const row = result.rows[0];
    if (row === undefined) throw new Error("Database did not return the created learning session.");
    return sessionFromRow(row);
  }

  getSession(
    sessionId: OpaqueId<"session">,
    learnerId: LearningSession["learnerId"],
  ): Promise<LearningSession | null> {
    return oneSession(this.pool, sessionId, learnerId);
  }

  async findActiveSession(
    learnerId: LearningSession["learnerId"],
    mode: LearningSession["mode"],
  ): Promise<LearningSession | null> {
    const result = await this.pool.query<SessionRow>(
      `SELECT ${SESSION_COLUMNS} FROM practice.learning_session
        WHERE learner_id = $1 AND mode = $2 AND status = 'active'
        ORDER BY updated_at DESC, session_id DESC
        LIMIT 1`,
      [learnerId, mode],
    );
    const row = result.rows[0];
    return row === undefined ? null : sessionFromRow(row);
  }

  async updateSession(input: {
    readonly session: LearningSession;
    readonly expectedVersion: number;
  }): Promise<LearningSession | null> {
    const result = await this.pool.query<SessionRow>(
      `UPDATE practice.learning_session
          SET status = $3, version = $4, updated_at = $5, ended_at = $6
        WHERE session_id = $1 AND learner_id = $2 AND version = $7
       RETURNING ${SESSION_COLUMNS}`,
      [
        input.session.sessionId,
        input.session.learnerId,
        input.session.status,
        input.session.version,
        input.session.updatedAt,
        input.session.endedAt,
        input.expectedVersion,
      ],
    );
    const row = result.rows[0];
    return row === undefined ? null : sessionFromRow(row);
  }

  async createAttempt(input: {
    readonly attempt: LearningAttempt;
    readonly event: AttemptEvent;
  }): Promise<LearningAttempt> {
    return withTransaction(this.pool, async (transaction) => {
      await insertAttempt(transaction, input.attempt);
      await insertAttemptEvent(transaction, input.event);
      return input.attempt;
    });
  }

  async createRunRequest(input: {
    readonly run: CodeRunRequest;
    readonly attempt: LearningAttempt;
    readonly event: AttemptEvent;
    readonly expectedAttemptVersion: number;
    readonly outbox: OutboxEvent;
  }): Promise<LearningAttempt | null> {
    return withTransaction(this.pool, async (transaction) => {
      const current = await oneAttempt(
        transaction,
        input.attempt.attemptId,
        input.attempt.learnerId,
        true,
      );
      if (current === null || current.version !== input.expectedAttemptVersion) return null;
      await updateAttempt(transaction, input.attempt);
      await insertAttemptEvent(transaction, input.event);
      await insertCodeRun(transaction, input.run);
      await insertOutboxEvent(transaction, input.outbox);
      return input.attempt;
    });
  }

  getAttempt(
    attemptId: OpaqueId<"attempt">,
    learnerId: LearningAttempt["learnerId"],
  ): Promise<LearningAttempt | null> {
    return oneAttempt(this.pool, attemptId, learnerId);
  }

  async findActiveAttempt(input: {
    readonly learnerId: LearningAttempt["learnerId"];
    readonly problemVersionId: LearningAttempt["problemVersionId"];
    readonly manifestId: LearningAttempt["manifestId"];
    readonly language: LearningAttempt["language"];
    readonly includeSubmitted?: boolean;
  }): Promise<LearningAttempt | null> {
    const result = await this.pool.query<AttemptRow>(
      `SELECT ${ATTEMPT_COLUMNS} FROM practice.attempt
        WHERE learner_id = $1 AND problem_version_id = $2 AND manifest_id = $3
          AND language = $4 AND (status = 'active' OR ($5::boolean AND status = 'submitted'))
        ORDER BY updated_at DESC, attempt_id DESC
        LIMIT 1`,
      [
        input.learnerId,
        input.problemVersionId,
        input.manifestId,
        input.language,
        input.includeSubmitted === true,
      ],
    );
    const row = result.rows[0];
    return row === undefined ? null : attemptFromRow(row);
  }

  getRun(
    runId: CodeRunRecord["runId"],
    learnerId: CodeRunRecord["learnerId"],
  ): Promise<CodeRunRecord | null> {
    return oneCodeRun(this.pool, runId, learnerId);
  }

  getRunById(runId: CodeRunRecord["runId"]): Promise<CodeRunRecord | null> {
    return oneCodeRunById(this.pool, runId);
  }

  async getSubmissionObservation(
    runId: CodeRunRecord["runId"],
    learnerId: CodeRunRecord["learnerId"],
  ): Promise<{
    observationId: OpaqueId<"event">;
    problemVersionId: OpaqueId<"problemVersion">;
  } | null> {
    const result = await this.pool.query<{ observation_id: string; problem_version_id: string }>(
      `SELECT observation_id, problem_version_id FROM practice.assessment_observation
       WHERE run_id=$1 AND learner_id=$2`,
      [runId, learnerId],
    );
    const row = result.rows[0];
    return row === undefined
      ? null
      : {
          observationId: parseIdOrThrow("event", row.observation_id),
          problemVersionId: parseIdOrThrow("problemVersion", row.problem_version_id),
        };
  }

  async getVerifiedRunEvidence(input: {
    readonly attemptId: LearningAttempt["attemptId"];
    readonly learnerId: LearningAttempt["learnerId"];
  }): Promise<readonly VerifiedRunEvidence[]> {
    const result = await this.pool.query<{
      observation_id: string;
      attempt_id: string;
      problem_version_id: string;
      manifest_id: string;
      passed: boolean;
    }>(
      `SELECT observation_id, attempt_id, problem_version_id, manifest_id, passed
         FROM practice.assessment_observation WHERE attempt_id=$1 AND learner_id=$2 AND passed=true`,
      [input.attemptId, input.learnerId],
    );
    return result.rows.map((row) => ({
      observationId: parseIdOrThrow("event", row.observation_id),
      attemptId: parseIdOrThrow("attempt", row.attempt_id),
      problemVersionId: parseIdOrThrow("problemVersion", row.problem_version_id),
      manifestId: parseIdOrThrow("languageManifest", row.manifest_id),
      passed: row.passed,
    }));
  }

  /** Canonical, committed source facts for the mastery-owned consumer. */
  async loadAssessment(eventId: OpaqueId<"event">): Promise<{
    sourceEventId: OpaqueId<"event">;
    observation: AssessmentObservation;
    classification: TrustedExecutionResult["classification"];
  } | null> {
    const result = await this.pool.query<{
      observation_id: string;
      run_id: string;
      attempt_id: string;
      learner_id: string;
      problem_version_id: string;
      manifest_id: string;
      language: AssessmentObservation["language"];
      source_checksum: string;
      result_id: string;
      terminal_category: AssessmentObservation["terminalCategory"];
      passed: boolean;
      observed_at: Date;
      assistance_tier: number | null;
      assistance_captured_at: Date | null;
      classification: TrustedExecutionResult["classification"];
    }>(
      `SELECT o.* FROM platform.outbox_event e
        JOIN practice.assessment_observation o ON o.observation_id=e.payload->>'observationId'
        JOIN practice.code_run r ON r.run_id=o.run_id AND r.learner_id=o.learner_id
          AND r.terminal_result_id=o.result_id AND r.terminal_category=o.terminal_category
          AND r.classification=o.classification AND r.mode='submit'
       WHERE e.event_id=$1 AND e.topic='practice.assessment.observed'
         AND e.aggregate_id=o.attempt_id`,
      [eventId],
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    return {
      sourceEventId: eventId,
      classification: row.classification,
      observation: {
        observationId: parseIdOrThrow("event", row.observation_id),
        runId: parseIdOrThrow("codeRun", row.run_id),
        attemptId: parseIdOrThrow("attempt", row.attempt_id),
        learnerId: parseLearner(row.learner_id),
        problemVersionId: parseIdOrThrow("problemVersion", row.problem_version_id),
        manifestId: parseIdOrThrow("languageManifest", row.manifest_id),
        language: oneOf(PROBLEM_LANGUAGES, row.language, "language"),
        sourceChecksum: parseChecksum(row.source_checksum),
        resultId: row.result_id,
        terminalCategory: row.terminal_category,
        passed: row.passed,
        observedAt: instant(row.observed_at),
        assistanceTier: row.assistance_tier,
        assistanceCapturedAt: nullableInstant(row.assistance_captured_at),
      },
    };
  }

  /** The descriptor committed atomically with the run is the callback trust anchor. */
  async getRunDispatch(runId: CodeRunRecord["runId"]): Promise<unknown | null> {
    const result = await this.pool.query<{ payload: unknown }>(
      `SELECT payload FROM platform.outbox_event
        WHERE topic = 'execution.run.requested'
          AND payload->'descriptor'->'payload'->>'runId' = $1
        LIMIT 2`,
      [runId],
    );
    return result.rows.length === 1 ? (result.rows[0]?.payload ?? null) : null;
  }

  async getLatestRun(input: {
    readonly attemptId: LearningAttempt["attemptId"];
    readonly learnerId: LearningAttempt["learnerId"];
  }): Promise<CodeRunRecord | null> {
    const result = await this.pool.query<CodeRunRow>(
      `SELECT ${CODE_RUN_COLUMNS} FROM practice.code_run
        WHERE attempt_id = $1 AND learner_id = $2
        ORDER BY requested_at DESC, run_id DESC
        LIMIT 1`,
      [input.attemptId, input.learnerId],
    );
    const row = result.rows[0];
    return row === undefined ? null : codeRunFromRow(row);
  }

  async listAttempts(
    learnerId: LearningAttempt["learnerId"],
    limit = 50,
  ): Promise<readonly LearningAttempt[]> {
    const boundedLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
    const result = await this.pool.query<AttemptRow>(
      `SELECT ${ATTEMPT_COLUMNS} FROM practice.attempt
        WHERE learner_id = $1
        ORDER BY updated_at DESC, attempt_id DESC
        LIMIT $2`,
      [learnerId, boundedLimit],
    );
    return result.rows.map(attemptFromRow);
  }

  async saveAttempt(input: PracticeAttemptWrite): Promise<LearningAttempt | null> {
    return withTransaction(this.pool, async (transaction) => {
      const current = await oneAttempt(
        transaction,
        input.attempt.attemptId,
        input.attempt.learnerId,
        true,
      );
      if (current === null || current.version !== input.expectedVersion) return null;
      await updateAttempt(transaction, input.attempt);
      await insertAttemptEvent(transaction, input.event);
      return input.attempt;
    });
  }

  async resetAttemptForLanguage(input: PracticeAttemptReset): Promise<LearningAttempt | null> {
    return withTransaction(this.pool, async (transaction) => {
      const current = await oneAttempt(
        transaction,
        input.previous.attempt.attemptId,
        input.previous.attempt.learnerId,
        true,
      );
      if (current === null || current.version !== input.previous.expectedVersion) return null;
      await updateAttempt(transaction, input.previous.attempt);
      await insertAttemptEvent(transaction, input.previous.event);
      await insertAttempt(transaction, input.next.attempt);
      await insertAttemptEvent(transaction, input.next.event);
      return input.next.attempt;
    });
  }

  async commitTerminalResult(input: {
    readonly run: CodeRunRecord;
    readonly result: TrustedExecutionResult;
    readonly attempt: LearningAttempt;
    readonly event: AttemptEvent | null;
    readonly expectedAttemptVersion: number | null;
    readonly observation: AssessmentObservation | null;
    readonly outbox: OutboxEvent | null;
  }): Promise<CodeRunCommit | null> {
    return withTransaction(this.pool, async (transaction) => {
      const currentRun = await oneCodeRun(transaction, input.run.runId, input.run.learnerId, true);
      if (currentRun === null) return null;
      if (currentRun.terminalResultId !== null) {
        if (currentRun.terminalResultId !== input.result.resultId) return null;
        return {
          disposition: "replayed",
          attempt: input.attempt,
          observation: null,
        };
      }

      // Hint delivery and submissions share this owner lock. A disclosure that
      // wins first is included; a later disclosure cannot rewrite the snapshot.
      if (input.observation !== null) {
        await transaction.query(
          "SELECT learner_id FROM platform.learner WHERE learner_id=$1 FOR NO KEY UPDATE",
          [input.run.learnerId],
        );
      }

      if (input.expectedAttemptVersion !== null) {
        const currentAttempt = await oneAttempt(
          transaction,
          input.attempt.attemptId,
          input.attempt.learnerId,
          true,
        );
        if (currentAttempt === null || currentAttempt.version !== input.expectedAttemptVersion) {
          return null;
        }
        if (input.event === null) return null;
        await updateAttempt(transaction, input.attempt);
        await insertAttemptEvent(transaction, input.event);
      }

      await markCodeRunTerminal(
        transaction,
        input.run.runId,
        input.run.learnerId,
        input.result.resultId,
        input.result.terminalCategory,
        input.result.classification,
        input.result.completedAt,
      );
      let observation = input.observation;
      if (observation !== null) {
        const snapshot = await transaction.query<{ tier: number; captured_at: Date }>(
          `SELECT COALESCE(MAX(tier), 0)::integer AS tier, clock_timestamp() AS captured_at
             FROM practice.hint_exposure WHERE learner_id=$1 AND problem_version_id=$2`,
          [observation.learnerId, observation.problemVersionId],
        );
        observation = {
          ...observation,
          assistanceTier: snapshot.rows[0]!.tier,
          assistanceCapturedAt: instant(snapshot.rows[0]!.captured_at),
        };
        await insertAssessmentObservation(transaction, observation, input.result);
      }
      if (input.outbox !== null) {
        if (observation === null) throw new Error("Assessment event requires an observation.");
        await insertOutboxEvent(
          transaction,
          snapshotAssessmentOutbox(input.outbox, observation, input.result.classification),
        );
      }
      return {
        disposition: "committed",
        attempt: input.attempt,
        observation,
      };
    });
  }
}

async function insertAttempt(transaction: Transaction, attempt: LearningAttempt): Promise<void> {
  await transaction.query(
    `INSERT INTO practice.attempt
      (attempt_id, session_id, learner_id, problem_version_id, manifest_id, language, mode,
       status, terminal_reason, reset_from_attempt_id, version, event_sequence,
       started_at, updated_at, ended_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      attempt.attemptId,
      attempt.sessionId,
      attempt.learnerId,
      attempt.problemVersionId,
      attempt.manifestId,
      attempt.language,
      attempt.mode,
      attempt.status,
      attempt.terminalReason,
      attempt.resetFromAttemptId,
      attempt.version,
      attempt.eventSequence,
      attempt.startedAt,
      attempt.updatedAt,
      attempt.endedAt,
    ],
  );
}

async function updateAttempt(transaction: Transaction, attempt: LearningAttempt): Promise<void> {
  await transaction.query(
    `UPDATE practice.attempt
        SET status = $3, terminal_reason = $4, version = $5, event_sequence = $6,
            updated_at = $7, ended_at = $8
      WHERE attempt_id = $1 AND learner_id = $2`,
    [
      attempt.attemptId,
      attempt.learnerId,
      attempt.status,
      attempt.terminalReason,
      attempt.version,
      attempt.eventSequence,
      attempt.updatedAt,
      attempt.endedAt,
    ],
  );
}

async function insertAttemptEvent(transaction: Transaction, event: AttemptEvent): Promise<void> {
  await transaction.query(
    `INSERT INTO practice.attempt_event
      (event_id, attempt_id, learner_id, sequence, kind, metadata, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
    [
      event.eventId,
      event.attemptId,
      event.learnerId,
      event.sequence,
      event.kind,
      JSON.stringify(event.metadata),
      event.occurredAt,
    ],
  );
}

async function insertCodeRun(transaction: Transaction, run: CodeRunRequest): Promise<void> {
  await transaction.query(
    `INSERT INTO practice.code_run
      (run_id, learner_id, attempt_id, mode, problem_version_id, manifest_id, language,
       source_checksum, source_length, requested_at, terminal_result_id,
       terminal_category, classification, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL, NULL, NULL, NULL)`,
    [
      run.runId,
      run.learnerId,
      run.attemptId,
      run.mode,
      run.problemVersionId,
      run.manifestId,
      run.language,
      run.sourceChecksum,
      run.sourceLength,
      run.requestedAt,
    ],
  );
}

async function markCodeRunTerminal(
  transaction: Transaction,
  runId: CodeRunRecord["runId"],
  learnerId: CodeRunRecord["learnerId"],
  resultId: string,
  terminalCategory: NonNullable<CodeRunRecord["terminalCategory"]>,
  classification: NonNullable<CodeRunRecord["classification"]>,
  completedAt: NonNullable<CodeRunRecord["completedAt"]>,
): Promise<void> {
  const updated = await transaction.query(
    `UPDATE practice.code_run
        SET terminal_result_id = $3, terminal_category = $4,
            classification = $5, completed_at = $6
      WHERE run_id = $1 AND learner_id = $2 AND terminal_result_id IS NULL`,
    [runId, learnerId, resultId, terminalCategory, classification, completedAt],
  );
  if (updated.rowCount !== 1) {
    throw new Error("Execution run was not available for terminal commit.");
  }
}

async function insertAssessmentObservation(
  transaction: Transaction,
  observation: AssessmentObservation,
  result: TrustedExecutionResult,
): Promise<void> {
  await transaction.query(
    `INSERT INTO practice.assessment_observation
      (observation_id, run_id, attempt_id, learner_id, problem_version_id, manifest_id,
       language, source_checksum, result_id, terminal_category, classification,
       descriptor_digest, replay_id, lease_epoch, passed, observed_at,
       assistance_tier, assistance_captured_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
    [
      observation.observationId,
      observation.runId,
      observation.attemptId,
      observation.learnerId,
      observation.problemVersionId,
      observation.manifestId,
      observation.language,
      observation.sourceChecksum,
      observation.resultId,
      observation.terminalCategory,
      result.classification,
      result.descriptorDigest,
      result.replayId,
      result.leaseEpoch,
      observation.passed,
      observation.observedAt,
      observation.assistanceTier,
      observation.assistanceCapturedAt,
    ],
  );
}

async function insertOutboxEvent(transaction: Transaction, event: OutboxEvent): Promise<void> {
  await transaction.query(
    `INSERT INTO platform.outbox_event
      (event_id, topic, aggregate_id, payload, occurred_at)
     VALUES ($1, $2, $3, $4::jsonb, $5)`,
    [
      event.eventId,
      event.topic,
      event.aggregateId,
      JSON.stringify(event.payload),
      event.occurredAt,
    ],
  );
}
