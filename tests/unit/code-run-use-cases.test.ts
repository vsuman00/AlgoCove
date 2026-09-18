import { describe, expect, it } from "vitest";
import {
  createActor,
  createFixedClock,
  createRequestContext,
  createSequenceIdGenerator,
  createOutboxEvent,
  ingestTrustedPracticeResult,
  reconcilePracticeCodeRun,
  requestPracticeCodeRun,
  startPracticeAttempt,
  type AssessmentObservation,
  type CodeRunCommit,
  type CodeRunRecord,
  type CodeRunRepository,
  type CodeRunRequest,
  type ExecutionRelay,
  type ExecutionRelayPreparation,
  type TrustedExecutionResult,
} from "@algocove/application";
import {
  formatId,
  parseContentChecksum,
  parseInstant,
  startAttempt,
  startLearningSession,
  type OpaqueId,
  type AttemptEvent,
  type LearningAttempt,
  type LearningSession,
  type Result,
} from "@algocove/domain";
import type { OutboxEvent } from "@algocove/application";

const now = must(parseInstant("2026-09-18T10:00:00.000Z"));
const completedAt = must(parseInstant("2026-09-18T10:00:01.000Z"));
const learner = must(formatId("learner", "aaaaaaaaaaaaaaaa"));
const sessionId = must(formatId("session", "bbbbbbbbbbbbbbbb"));
const problemVersionId = must(formatId("problemVersion", "dddddddddddddddd"));
const manifestId = must(formatId("languageManifest", "eeeeeeeeeeeeeeee"));
const checksum = must(parseContentChecksum(`sha256:${"a".repeat(64)}`));
const otherChecksum = must(parseContentChecksum(`sha256:${"b".repeat(64)}`));
const descriptorDigest = must(parseContentChecksum(`sha256:${"c".repeat(64)}`));

function must<T, F>(result: Result<T, F>): T {
  if (!result.ok) throw new Error("Invalid code-run fixture.");
  return result.value;
}

function prepareRelay(run: CodeRunRequest, eventId: OpaqueId<"event">): ExecutionRelayPreparation {
  return {
    outbox: createOutboxEvent({
      eventId,
      topic: "execution.run.requested",
      aggregateId: run.runId,
      occurredAt: run.requestedAt,
      payload: {
        topic: "execution.run.requested",
        dispatchKey: `dispatch-${run.runId}`,
        descriptor: { runId: run.runId, sourceDigest: run.sourceChecksum },
        quota: { quotaKey: `learner:${run.learnerId}`, profileId: run.language, maxConcurrent: 1 },
      },
    }),
    token: null,
  };
}

function context() {
  return createRequestContext({
    actor: createActor({
      userId: learner,
      sessionId,
      roles: ["learner"],
    }),
    clock: createFixedClock(now),
    ids: createSequenceIdGenerator(100),
    serviceName: "unit-test",
  });
}

class FakeCodeRunRepository implements CodeRunRepository {
  readonly sessions = new Map<string, LearningSession>();
  readonly attempts = new Map<string, LearningAttempt>();
  readonly runs = new Map<string, CodeRunRecord>();
  readonly observations: AssessmentObservation[] = [];
  readonly outbox: OutboxEvent[] = [];
  readonly dispatchOutbox: OutboxEvent[] = [];

  seed(attempt: LearningAttempt): void {
    this.attempts.set(attempt.attemptId, attempt);
  }

  async createSession(session: LearningSession): Promise<LearningSession> {
    this.sessions.set(session.sessionId, session);
    return session;
  }

  async getSession(id: LearningSession["sessionId"], owner: LearningSession["learnerId"]) {
    const value = this.sessions.get(id);
    return value?.learnerId === owner ? value : null;
  }

  async updateSession(input: { session: LearningSession; expectedVersion: number }) {
    const current = this.sessions.get(input.session.sessionId);
    if (current?.version !== input.expectedVersion) return null;
    this.sessions.set(input.session.sessionId, input.session);
    return input.session;
  }

  async createAttempt(input: { attempt: LearningAttempt; event: AttemptEvent }) {
    this.attempts.set(input.attempt.attemptId, input.attempt);
    return input.attempt;
  }

  async getAttempt(id: LearningAttempt["attemptId"], owner: LearningAttempt["learnerId"]) {
    const value = this.attempts.get(id);
    return value?.learnerId === owner ? value : null;
  }

  async listAttempts(owner: LearningAttempt["learnerId"]) {
    return [...this.attempts.values()].filter((attempt) => attempt.learnerId === owner);
  }

  async saveAttempt(input: {
    attempt: LearningAttempt;
    event: AttemptEvent;
    expectedVersion: number;
  }) {
    const current = this.attempts.get(input.attempt.attemptId);
    if (current?.version !== input.expectedVersion) return null;
    this.attempts.set(input.attempt.attemptId, input.attempt);
    return input.attempt;
  }

  async resetAttemptForLanguage(input: {
    previous: { attempt: LearningAttempt; event: AttemptEvent; expectedVersion: number };
    next: { attempt: LearningAttempt; event: AttemptEvent };
  }) {
    const current = this.attempts.get(input.previous.attempt.attemptId);
    if (current?.version !== input.previous.expectedVersion) return null;
    this.attempts.set(input.previous.attempt.attemptId, input.previous.attempt);
    this.attempts.set(input.next.attempt.attemptId, input.next.attempt);
    return input.next.attempt;
  }

  async createRunRequest(input: {
    run: CodeRunRequest;
    attempt: LearningAttempt;
    event: AttemptEvent;
    expectedAttemptVersion: number;
    outbox: OutboxEvent;
  }) {
    const current = this.attempts.get(input.attempt.attemptId);
    if (current?.version !== input.expectedAttemptVersion) return null;
    this.attempts.set(input.attempt.attemptId, input.attempt);
    this.runs.set(input.run.runId, {
      ...input.run,
      terminalResultId: null,
      terminalCategory: null,
      classification: null,
      completedAt: null,
    });
    this.dispatchOutbox.push(input.outbox);
    return input.attempt;
  }

  async getRun(runId: CodeRunRecord["runId"], owner: LearningAttempt["learnerId"]) {
    const value = this.runs.get(runId);
    return value?.learnerId === owner ? value : null;
  }

  async commitTerminalResult(input: {
    run: CodeRunRecord;
    result: TrustedExecutionResult;
    attempt: LearningAttempt;
    event: AttemptEvent | null;
    expectedAttemptVersion: number | null;
    observation: AssessmentObservation | null;
    outbox: OutboxEvent | null;
  }): Promise<CodeRunCommit | null> {
    const currentRun = this.runs.get(input.run.runId);
    if (currentRun?.terminalResultId !== null || currentRun === undefined) return null;
    if (input.expectedAttemptVersion !== null) {
      const currentAttempt = this.attempts.get(input.attempt.attemptId);
      if (currentAttempt?.version !== input.expectedAttemptVersion) return null;
    }
    this.runs.set(input.run.runId, {
      ...currentRun,
      terminalResultId: input.result.resultId,
      terminalCategory: input.result.terminalCategory,
      classification: input.result.classification,
      completedAt: input.result.completedAt,
    });
    this.attempts.set(input.attempt.attemptId, input.attempt);
    if (input.observation !== null) this.observations.push(input.observation);
    if (input.outbox !== null) this.outbox.push(input.outbox);
    return {
      disposition: "committed",
      attempt: input.attempt,
      observation: input.observation,
    };
  }
}

function makeResult(
  run: CodeRunRequest,
  overrides: Partial<TrustedExecutionResult> = {},
): TrustedExecutionResult {
  return {
    resultId: "result-1",
    runId: run.runId,
    attemptId: run.attemptId,
    problemVersionId: run.problemVersionId,
    manifestId: run.manifestId,
    language: run.language,
    sourceChecksum: run.sourceChecksum,
    terminalCategory: "pass",
    classification: "success",
    descriptorDigest,
    replayId: "replay-1",
    leaseEpoch: 1,
    completedAt,
    ...overrides,
  };
}

describe("Task 25a code-run application boundary", () => {
  it("commits a durable run request before dispatch and preserves it when the relay response is lost", async () => {
    const repository = new FakeCodeRunRepository();
    const session = must(
      startLearningSession({ sessionId, learnerId: learner, mode: "practice", startedAt: now }),
    );
    await repository.createSession(session);
    const attempt = await startPracticeAttempt(context(), repository, {
      sessionId,
      problemVersionId,
      manifestId,
      language: "python",
    });
    repository.seed(attempt);
    const relay: ExecutionRelay = {
      prepare: async ({ run, eventId }) => prepareRelay(run, eventId),
      dispatch: async () => {
        throw new Error("relay unavailable");
      },
      cancel: async () => undefined,
    };

    await expect(
      requestPracticeCodeRun(context(), repository, relay, {
        attemptId: attempt.attemptId,
        mode: "run",
        source: "private learner source",
        sourceChecksum: checksum,
        sourceLength: 24,
      }),
    ).rejects.toMatchObject({ code: "dependency_unavailable" });
    expect(repository.runs.size).toBe(1);
    expect(repository.dispatchOutbox).toHaveLength(1);
    expect(repository.attempts.get(attempt.attemptId)).toMatchObject({ version: 2 });
    expect(JSON.stringify([...repository.runs.values()])).not.toContain("sourceCode");
  });

  it("keeps Run non-assessing and commits Submit observation/outbox exactly once", async () => {
    const repository = new FakeCodeRunRepository();
    const session = must(
      startLearningSession({ sessionId, learnerId: learner, mode: "practice", startedAt: now }),
    );
    await repository.createSession(session);
    const attempt = await startPracticeAttempt(context(), repository, {
      sessionId,
      problemVersionId,
      manifestId,
      language: "python",
    });
    repository.seed(attempt);
    const relay: ExecutionRelay = {
      prepare: async ({ run, eventId }) => prepareRelay(run, eventId),
      dispatch: async ({ run }) => ({ runId: run.runId, replayed: false }),
      cancel: async () => undefined,
    };
    const runRequest = await requestPracticeCodeRun(context(), repository, relay, {
      attemptId: attempt.attemptId,
      mode: "run",
      source: "private learner source",
      sourceChecksum: checksum,
      sourceLength: 24,
    });
    const runResult = await ingestTrustedPracticeResult(context(), repository, {
      result: makeResult(runRequest.run),
    });
    expect(runResult.attempt.status).toBe("active");
    expect(repository.observations).toHaveLength(0);
    expect(repository.outbox).toHaveLength(0);
    expect(repository.dispatchOutbox).toHaveLength(1);

    const secondAttempt = await startPracticeAttempt(context(), repository, {
      sessionId,
      problemVersionId,
      manifestId,
      language: "python",
    });
    repository.seed(secondAttempt);
    const submitRequest = await requestPracticeCodeRun(context(), repository, relay, {
      attemptId: secondAttempt.attemptId,
      mode: "submit",
      source: "private learner source",
      sourceChecksum: checksum,
      sourceLength: 24,
    });
    const submitResult = makeResult(submitRequest.run, { resultId: "result-2" });
    const committed = await ingestTrustedPracticeResult(context(), repository, {
      result: submitResult,
    });
    expect(committed).toMatchObject({ disposition: "committed", observation: { passed: true } });
    expect(committed.attempt.status).toBe("submitted");
    expect(repository.observations).toHaveLength(1);
    expect(repository.outbox).toHaveLength(1);

    const replay = await ingestTrustedPracticeResult(context(), repository, {
      result: submitResult,
    });
    expect(replay.disposition).toBe("replayed");
    expect(repository.observations).toHaveLength(1);
    expect(repository.outbox).toHaveLength(1);
  });

  it("rejects a result whose source, problem, language, or manifest does not match the run", async () => {
    const repository = new FakeCodeRunRepository();
    const session = must(
      startLearningSession({ sessionId, learnerId: learner, mode: "practice", startedAt: now }),
    );
    await repository.createSession(session);
    const attempt = await startPracticeAttempt(context(), repository, {
      sessionId,
      problemVersionId,
      manifestId,
      language: "python",
    });
    repository.seed(attempt);
    const relay: ExecutionRelay = {
      prepare: async ({ run, eventId }) => prepareRelay(run, eventId),
      dispatch: async ({ run }) => ({ runId: run.runId, replayed: false }),
      cancel: async () => undefined,
    };
    const runRequest = await requestPracticeCodeRun(context(), repository, relay, {
      attemptId: attempt.attemptId,
      mode: "submit",
      source: "private learner source",
      sourceChecksum: checksum,
      sourceLength: 24,
    });

    await expect(
      ingestTrustedPracticeResult(context(), repository, {
        result: makeResult(runRequest.run, { sourceChecksum: otherChecksum }),
      }),
    ).rejects.toMatchObject({ code: "invalid_request" });
    await expect(
      ingestTrustedPracticeResult(context(), repository, {
        result: makeResult(runRequest.run, {
          terminalCategory: "infrastructure_error",
          classification: "success",
        }),
      }),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(repository.runs.get(runRequest.run.runId)?.terminalResultId).toBeNull();
    expect(repository.observations).toHaveLength(0);
  });

  it("reconciles a lost response without replacing the run or duplicating assessment effects", async () => {
    const repository = new FakeCodeRunRepository();
    const session = must(
      startLearningSession({
        sessionId,
        learnerId: learner,
        mode: "practice",
        startedAt: now,
      }),
    );
    const attempt = must(
      startAttempt(session, {
        attemptId: must(formatId("attempt", "cccccccccccccccc")),
        eventId: must(formatId("event", "1111111111111111")),
        problemVersionId,
        manifestId,
        language: "python",
        startedAt: now,
      }),
    ).attempt;
    repository.seed(attempt);
    let terminal: TrustedExecutionResult | null = null;
    const runResult = await requestPracticeCodeRun(
      context(),
      repository,
      {
        prepare: async ({ run, eventId }) => prepareRelay(run, eventId),
        dispatch: async ({ run }) => ({ runId: run.runId, replayed: false }),
        cancel: async () => undefined,
      },
      {
        attemptId: attempt.attemptId,
        mode: "submit",
        source: "solve(input)",
        sourceChecksum: checksum,
        sourceLength: 12,
      },
    );

    await expect(
      reconcilePracticeCodeRun(
        context(),
        repository,
        {
          getTerminalResult: async () => terminal,
        },
        runResult.run.runId,
      ),
    ).resolves.toBeNull();

    terminal = makeResult(runResult.run);
    const committed = await reconcilePracticeCodeRun(
      context(),
      repository,
      { getTerminalResult: async () => terminal },
      runResult.run.runId,
    );
    expect(committed).toMatchObject({ disposition: "committed", observation: { passed: true } });
    expect(repository.observations).toHaveLength(1);
    expect(repository.outbox).toHaveLength(1);

    await expect(
      reconcilePracticeCodeRun(
        context(),
        repository,
        {
          getTerminalResult: async () => terminal,
        },
        runResult.run.runId,
      ),
    ).resolves.toMatchObject({ disposition: "replayed" });
    expect(repository.observations).toHaveLength(1);
    expect(repository.outbox).toHaveLength(1);
  });
});
