import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createOutboxEvent,
  createActor,
  createFixedClock,
  createRequestContext,
  createSequenceIdGenerator,
  ingestTrustedPracticeResult,
  requestPracticeCodeRun,
  startPracticeAttempt,
  startPracticeSession,
  type ExecutionRelay,
  type ExecutionRelayPreparation,
  type IdGenerator,
  type AssessmentObservation,
  type CodeRunRequest,
  type TrustedExecutionResult,
  revealAuthoredHint,
} from "@algocove/application";
import {
  bootstrapDatabase,
  createPool,
  migrate,
  PostgresDraftRepository,
  PostgresHintRepository,
  PostgresPseudocodeRepository,
  PostgresPracticeRepository,
  type DatabaseConnection,
} from "@algocove/db";
import {
  formatId,
  parseContentChecksum,
  parseInstant,
  draftExpiry,
  replacePseudocodeCurrent,
  recordSourceSaved,
  recordRunRequested,
  resetAttemptForLanguage,
  startAttempt,
  startLearningSession,
  startPracticeDraft as startDraftDomain,
  savePseudocodeRevision,
  startPseudocodeArtifact,
  submitAttempt,
} from "@algocove/domain";
import { sha256Digest } from "@algocove/execution-contracts";

const baseOperatorUrl =
  process.env.DATABASE_TEST_OPERATOR_URL ??
  process.env.DATABASE_ADMIN_URL ??
  "postgres://postgres:postgres@127.0.0.1:54329/algocove";
const runSuffix = `${process.pid}_${Date.now()}`;
const databaseName = `algocove_practice_${runSuffix}`;
const migrationRole = `algocove_practice_mig_${runSuffix}`;
const runtimeRole = `algocove_practice_run_${runSuffix}`;
const migrationPassword = `migration_${randomUUID()}`;
const runtimePassword = `runtime_${randomUUID()}`;

function databaseUrl(connectionString: string, database: string): string {
  const url = new URL(connectionString);
  url.pathname = `/${database}`;
  return url.toString();
}

function profile(connectionString: string, applicationName: string): DatabaseConnection {
  return { connectionString, applicationName, maxConnections: 4, statementTimeoutMs: 5_000 };
}

const operatorUrl = databaseUrl(baseOperatorUrl, "postgres");
const targetUrl = databaseUrl(baseOperatorUrl, databaseName);
const migrationUrl = `postgres://${migrationRole}:${encodeURIComponent(migrationPassword)}@${new URL(targetUrl).host}/${databaseName}`;
const runtimeUrl = `postgres://${runtimeRole}:${encodeURIComponent(runtimePassword)}@${new URL(targetUrl).host}/${databaseName}`;

const instant = parseInstant("2026-09-18T10:00:00.000Z");
const later = parseInstant("2026-09-18T10:01:00.000Z");
const learner = formatId("learner", "aaaaaaaaaaaaaaaa");
const otherLearner = formatId("learner", "bbbbbbbbbbbbbbbb");
const session = formatId("session", "cccccccccccccccc");
const attempt = formatId("attempt", "dddddddddddddddd");
const resetAttempt = formatId("attempt", "eeeeeeeeeeeeeeee");
const codeRun = formatId("codeRun", "8888888888888888");
const draft = formatId("draft", "bbbbbbbbbbbbbbbb");
const pseudocode = formatId("pseudocode", "cccccccccccccccc");
const problem = formatId("problemVersion", "ffffffffffffffff");
const pythonManifest = formatId("languageManifest", "1111111111111111");
const typescriptManifest = formatId("languageManifest", "2222222222222222");
const startedEvent = formatId("event", "3333333333333333");
const sourceEventA = formatId("event", "4444444444444444");
const sourceEventB = formatId("event", "5555555555555555");
const resetPreviousEvent = formatId("event", "6666666666666666");
const resetNextEvent = formatId("event", "7777777777777777");
const submitEvent = formatId("event", "9999999999999999");
const submitAttemptEvent = formatId("event", "aaaaaaaaaaaaaaaa");
const observationId = formatId("event", "aaaaaaaaaaaaaaab");
const outboxId = formatId("event", "aaaaaaaaaaaaaaac");
const executionDispatchId = formatId("event", "aaaaaaaaaaaaaaad");
const checksum = parseContentChecksum(`sha256:${"a".repeat(64)}`);
const descriptorDigest = parseContentChecksum(`sha256:${"c".repeat(64)}`);

if (
  !instant.ok ||
  !later.ok ||
  !learner.ok ||
  !otherLearner.ok ||
  !session.ok ||
  !attempt.ok ||
  !resetAttempt.ok ||
  !codeRun.ok ||
  !draft.ok ||
  !pseudocode.ok ||
  !problem.ok ||
  !pythonManifest.ok ||
  !typescriptManifest.ok ||
  !startedEvent.ok ||
  !sourceEventA.ok ||
  !sourceEventB.ok ||
  !resetPreviousEvent.ok ||
  !resetNextEvent.ok ||
  !submitEvent.ok ||
  !submitAttemptEvent.ok ||
  !observationId.ok ||
  !outboxId.ok ||
  !executionDispatchId.ok ||
  !checksum.ok ||
  !descriptorDigest.ok
) {
  throw new Error("practice integration fixtures are invalid");
}

let operatorPool: ReturnType<typeof createPool> | undefined;
let runtimePool: ReturnType<typeof createPool> | undefined;
let practice: PostgresPracticeRepository;
let drafts: PostgresDraftRepository;
let pseudocodes: PostgresPseudocodeRepository;
let hints: PostgresHintRepository;

describe("PostgreSQL practice state", () => {
  beforeAll(async () => {
    operatorPool = createPool(profile(operatorUrl, "algocove-practice-operator"));
    operatorPool.on("error", () => undefined);
    await operatorPool.query(`CREATE DATABASE "${databaseName}"`);
    await bootstrapDatabase({
      operatorConnectionString: targetUrl,
      migrationRole: { name: migrationRole, password: migrationPassword },
      runtimeRole: { name: runtimeRole, password: runtimePassword },
      logger: { info: () => undefined },
    });
    await migrate({ connectionString: migrationUrl, logger: { info: () => undefined } });
    runtimePool = createPool(profile(runtimeUrl, "algocove-practice-runtime"));
    runtimePool.on("error", () => undefined);
    practice = new PostgresPracticeRepository(runtimePool);
    drafts = new PostgresDraftRepository(runtimePool);
    pseudocodes = new PostgresPseudocodeRepository(runtimePool);
    hints = new PostgresHintRepository(runtimePool);

    await runtimePool.query("INSERT INTO platform.learner (learner_id) VALUES ($1), ($2)", [
      learner.value,
      otherLearner.value,
    ]);
    await runtimePool.query(
      `INSERT INTO content.content_item (content_id, content_kind)
       VALUES ('con_aaaaaaaaaaaaaaaa', 'problem')`,
    );
    await runtimePool.query(
      `INSERT INTO content.problem (problem_id, content_id)
       VALUES ('pro_aaaaaaaaaaaaaaaa', 'con_aaaaaaaaaaaaaaaa')`,
    );
    await runtimePool.query(
      `INSERT INTO content.content_version
        (content_version_id, content_id, title, checksum, provenance_kind,
         rights_holder, license, author_id, status, payload_status)
       VALUES ('cnt_aaaaaaaaaaaaaaaa', 'con_aaaaaaaaaaaaaaaa', 'Practice fixture', $1,
               'original', 'AlgoCove', 'algocove-original-v1', $2, 'draft', 'available')`,
      [`sha256:${"b".repeat(64)}`, learner.value],
    );
    await runtimePool.query(
      `INSERT INTO content.problem_version
        (problem_version_id, problem_id, content_version_id, statement)
       VALUES ($1, 'pro_aaaaaaaaaaaaaaaa', 'cnt_aaaaaaaaaaaaaaaa', 'Practice fixture statement')`,
      [problem.value],
    );
    await runtimePool.query(
      `INSERT INTO content.problem_language_manifest
        (manifest_id, problem_version_id, language, starter_template,
         entry_signature, adapter_id, limits_profile, status)
       VALUES
        ($1, $3, 'python', 'solve(input)', 'solve(input)', 'harness.python',
         '{"compileTimeoutMs":5000,"runTimeoutMs":2000,"memoryLimitMb":256}', 'draft'),
        ($2, $3, 'typescript', 'solve(input)', 'function solve(input): Output', 'harness.typescript',
         '{"compileTimeoutMs":8000,"runTimeoutMs":2000,"memoryLimitMb":256}', 'draft')`,
      [pythonManifest.value, typescriptManifest.value, problem.value],
    );
    await runtimePool.query(
      `INSERT INTO content.problem_hint (problem_version_id, hint_id, tier, kind, body)
       VALUES ($1, 'hint-arrays-1', 1, 'clarification',
               'What must remain true after each pointer move?')`,
      [problem.value],
    );
  });

  afterAll(async () => {
    await runtimePool?.end();
    await operatorPool?.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await operatorPool?.query(`DROP ROLE IF EXISTS "${migrationRole}"`);
    await operatorPool?.query(`DROP ROLE IF EXISTS "${runtimeRole}"`);
    await operatorPool?.end();
  });

  it("persists owner-scoped attempts and fences competing optimistic writes", async () => {
    const sessionResult = startLearningSession({
      sessionId: session.value,
      learnerId: learner.value,
      mode: "practice",
      startedAt: instant.value,
    });
    if (!sessionResult.ok) throw new Error(sessionResult.error.message);
    await practice.createSession(sessionResult.value);

    const attemptResult = startAttempt(sessionResult.value, {
      attemptId: attempt.value,
      eventId: startedEvent.value,
      problemVersionId: problem.value,
      manifestId: pythonManifest.value,
      language: "python",
      startedAt: instant.value,
    });
    if (!attemptResult.ok) throw new Error(attemptResult.error.message);
    await practice.createAttempt(attemptResult.value);

    const first = recordSourceSaved(attemptResult.value.attempt, {
      eventId: sourceEventA.value,
      sourceChecksum: checksum.value,
      sourceLength: 18,
      occurredAt: later.value,
    });
    const second = recordSourceSaved(attemptResult.value.attempt, {
      eventId: sourceEventB.value,
      sourceChecksum: checksum.value,
      sourceLength: 19,
      occurredAt: later.value,
    });
    if (!first.ok || !second.ok) throw new Error("practice transitions are invalid");

    const writes = await Promise.all([
      practice.saveAttempt({
        attempt: first.value.attempt,
        event: first.value.event,
        expectedVersion: 1,
      }),
      practice.saveAttempt({
        attempt: second.value.attempt,
        event: second.value.event,
        expectedVersion: 1,
      }),
    ]);
    expect(writes.filter((value) => value !== null)).toHaveLength(1);
    expect((await practice.getAttempt(attempt.value, learner.value))?.version).toBe(2);
    expect(await practice.getAttempt(attempt.value, otherLearner.value)).toBeNull();
  });

  it("atomically records a language reset and returns only the owner's history", async () => {
    const current = await practice.getAttempt(attempt.value, learner.value);
    if (current === null) throw new Error("practice attempt fixture was not persisted");
    const sessionRecord = await practice.getSession(session.value, learner.value);
    if (sessionRecord === null) throw new Error("practice session fixture was not persisted");
    const reset = resetAttemptForLanguage(sessionRecord, current, {
      nextAttemptId: resetAttempt.value,
      previousEventId: resetPreviousEvent.value,
      nextEventId: resetNextEvent.value,
      problemVersionId: problem.value,
      manifestId: typescriptManifest.value,
      language: "typescript",
      resetAt: later.value,
    });
    if (!reset.ok) throw new Error(reset.error.message);

    const saved = await practice.resetAttemptForLanguage({
      previous: {
        attempt: reset.value.previous.attempt,
        event: reset.value.previous.event,
        expectedVersion: current.version,
      },
      next: reset.value.next,
    });
    expect(saved).toMatchObject({ attemptId: resetAttempt.value, language: "typescript" });
    expect(await practice.getAttempt(attempt.value, learner.value)).toMatchObject({
      status: "abandoned",
      terminalReason: "language_changed",
    });
    expect((await practice.listAttempts(learner.value)).map((item) => item.attemptId)).toEqual([
      resetAttempt.value,
      attempt.value,
    ]);
    expect(await practice.listAttempts(otherLearner.value)).toEqual([]);
  });

  it("replaces current drafts and appends only explicit saved revisions", async () => {
    const current = await practice.getAttempt(resetAttempt.value, learner.value);
    if (current === null) throw new Error("reset practice attempt fixture was not persisted");
    const expiresAt = draftExpiry(later.value);
    if (!expiresAt.ok) throw new Error(expiresAt.error.message);
    const started = startDraftDomain({
      draftId: draft.value,
      attempt: current,
      kind: "pseudocode",
      startedAt: later.value,
      expiresAt: expiresAt.value,
    });
    if (!started.ok) throw new Error(started.error.message);
    await drafts.createDraft(started.value);

    const replaced = {
      ...started.value,
      currentText: "state: answer",
      currentRevision: 1,
      version: 2,
      updatedAt: later.value,
    };
    expect(
      await drafts.replaceCurrentDraft({ draft: replaced, expectedVersion: started.value.version }),
    ).toMatchObject({ currentRevision: 1, savedRevision: 0 });
    expect(await drafts.listDraftRevisions(draft.value, learner.value)).toEqual([]);

    const saved = {
      ...replaced,
      savedRevision: 1,
      version: 3,
    };
    const revision = {
      draftId: draft.value,
      attemptId: current.attemptId,
      learnerId: learner.value,
      kind: "pseudocode" as const,
      revision: 1,
      text: "state: answer",
      savedAt: later.value,
      expiresAt: expiresAt.value,
    };
    expect(
      await drafts.saveDraftRevision({ draft: saved, revision, expectedVersion: replaced.version }),
    ).toMatchObject({ savedRevision: 1, version: 3 });
    expect(await drafts.listDraftRevisions(draft.value, learner.value)).toMatchObject([
      { revision: 1, text: "state: answer" },
    ]);
    await drafts.deleteLearnerDrafts(otherLearner.value);
    expect(await drafts.getDraft(draft.value, otherLearner.value)).toBeNull();
  });

  it("persists structured pseudocode current fields and append-only revisions privately", async () => {
    const current = await practice.getAttempt(resetAttempt.value, learner.value);
    if (current === null) throw new Error("reset practice attempt was not persisted");
    const started = startPseudocodeArtifact({
      pseudocodeId: pseudocode.value,
      attempt: current,
      startedAt: later.value,
    });
    if (!started.ok) throw new Error(started.error.message);
    await pseudocodes.createPseudocode(started.value);

    const fields = {
      inputs: "array of numbers",
      state: "left and right indices",
      initialization: "left = 0, right = n - 1",
      invariant: "discarded ranges cannot improve the answer",
      loop: "move the smaller boundary",
      termination: "left meets right",
      output: "maximum area",
      complexity: "O(n) time and O(1) space",
    } as const;
    const replaced = replacePseudocodeCurrent(started.value, { fields, updatedAt: later.value });
    if (!replaced.ok) throw new Error(replaced.error.message);
    expect(
      await pseudocodes.replaceCurrentPseudocode({
        artifact: replaced.value.artifact,
        expectedVersion: started.value.version,
      }),
    ).toMatchObject({ currentRevision: 1, savedRevision: 0 });

    const saved = savePseudocodeRevision(replaced.value.artifact, { savedAt: later.value });
    if (!saved.ok || saved.value.revision === undefined)
      throw new Error("Revision was not created");
    expect(
      await pseudocodes.savePseudocodeRevision({
        artifact: saved.value.artifact,
        revision: saved.value.revision,
        expectedVersion: replaced.value.artifact.version,
      }),
    ).toMatchObject({ savedRevision: 1, version: 3 });
    expect(
      await pseudocodes.listPseudocodeRevisions(pseudocode.value, learner.value),
    ).toMatchObject([{ revision: 1, fields: { invariant: fields.invariant } }]);
    expect(await pseudocodes.getPseudocode(pseudocode.value, otherLearner.value)).toBeNull();
  });

  it("commits authored hint exposure before returning the hint and replays idempotently", async () => {
    const context = createRequestContext({
      actor: createActor({ userId: learner.value, sessionId: session.value, roles: ["learner"] }),
      clock: createFixedClock(later.value),
      ids: createSequenceIdGenerator(400),
      serviceName: "practice-integration",
    });
    const first = await revealAuthoredHint(context, hints, {
      attemptId: resetAttempt.value,
      hintId: "hint-arrays-1",
      requestedTier: 1,
      idempotencyKey: "hint-integration-1",
    });
    expect(first).toMatchObject({ disposition: "committed", exposure: { tier: 1 } });
    const replay = await revealAuthoredHint(context, hints, {
      attemptId: resetAttempt.value,
      hintId: "hint-arrays-1",
      requestedTier: 1,
      idempotencyKey: "hint-integration-1",
    });
    expect(replay).toMatchObject({ disposition: "replayed", hint: { hintId: "hint-arrays-1" } });
    expect(
      await hints.getHighestExposedTier({
        learnerId: learner.value,
        problemVersionId: problem.value,
      }),
    ).toBe(1);
  });

  it("rejects authored hint content when its kind does not match its ladder tier", async () => {
    await expect(
      runtimePool!.query(
        `INSERT INTO content.problem_hint (problem_version_id, hint_id, tier, kind, body)
         VALUES ($1, 'hint-invalid-ladder', 1, 'example', 'This pairing must be rejected.')`,
        [problem.value],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("runs application orchestration against PostgreSQL and preserves lost dispatches", async () => {
    let applicationEntropy = 0;
    const applicationIds: IdGenerator = {
      generate<TKind extends Parameters<typeof formatId>[0]>(kind: TKind) {
        const formatted = formatId(kind, `${"z".repeat(15)}${applicationEntropy.toString(16)}`);
        applicationEntropy += 1;
        if (!formatted.ok) throw new Error(formatted.error.message);
        return formatted.value;
      },
    };
    const context = createRequestContext({
      actor: createActor({
        userId: otherLearner.value,
        sessionId: session.value,
        roles: ["learner"],
      }),
      clock: createFixedClock(later.value),
      ids: applicationIds,
      serviceName: "practice-application-integration",
    });
    const rescueSession = await startPracticeSession(context, practice, "rescue");
    const rescueAttempt = await startPracticeAttempt(context, practice, {
      sessionId: rescueSession.sessionId,
      problemVersionId: problem.value,
      manifestId: pythonManifest.value,
      language: "python",
    });

    const makePreparation = (
      run: CodeRunRequest,
      eventId: Parameters<ExecutionRelay["prepare"]>[0]["eventId"],
    ): ExecutionRelayPreparation => ({
      outbox: createOutboxEvent({
        eventId,
        topic: "execution.run.requested",
        aggregateId: run.runId,
        occurredAt: later.value,
        payload: {
          topic: "execution.run.requested",
          dispatchKey: `dispatch-${run.runId}`,
          descriptor: { runId: run.runId, sourceDigest: run.sourceChecksum },
          quota: { quotaKey: `learner:${run.learnerId}`, profileId: "python", maxConcurrent: 1 },
        },
      }),
      token: "application-integration-token",
    });
    const dispatched: CodeRunRequest[] = [];
    const relay: ExecutionRelay = {
      prepare: async ({ run, eventId }) => makePreparation(run, eventId),
      dispatch: async ({ run }) => {
        dispatched.push(run);
        return { runId: run.runId, replayed: false };
      },
      cancel: async () => undefined,
    };
    const source = "print('application boundary')\n";
    const sourceChecksum = sha256Digest(source);
    const requested = await requestPracticeCodeRun(context, practice, relay, {
      attemptId: rescueAttempt.attemptId,
      mode: "run",
      source,
      sourceChecksum,
      sourceLength: Buffer.byteLength(source, "utf8"),
    });
    expect(requested.run).toMatchObject({ mode: "run", sourceChecksum });
    expect(dispatched).toHaveLength(1);

    const runResult: TrustedExecutionResult = {
      resultId: "application-result-1",
      runId: requested.run.runId,
      attemptId: requested.run.attemptId,
      problemVersionId: requested.run.problemVersionId,
      manifestId: requested.run.manifestId,
      language: requested.run.language,
      sourceChecksum,
      terminalCategory: "pass",
      classification: "success",
      descriptorDigest: descriptorDigest.value,
      replayId: "application-replay-1",
      leaseEpoch: 1,
      completedAt: later.value,
    };
    await expect(
      ingestTrustedPracticeResult(context, practice, { result: runResult }),
    ).resolves.toMatchObject({ disposition: "committed", observation: null });
    await expect(
      ingestTrustedPracticeResult(context, practice, { result: runResult }),
    ).resolves.toMatchObject({ disposition: "replayed", observation: null });

    const wrongSource = "print('wrong answer')\n";
    const wrongRequest = await requestPracticeCodeRun(context, practice, relay, {
      attemptId: rescueAttempt.attemptId,
      mode: "submit",
      source: wrongSource,
      sourceChecksum: sha256Digest(wrongSource),
      sourceLength: Buffer.byteLength(wrongSource, "utf8"),
    });
    await expect(
      ingestTrustedPracticeResult(context, practice, {
        result: {
          resultId: "application-result-wrong",
          runId: wrongRequest.run.runId,
          attemptId: wrongRequest.run.attemptId,
          problemVersionId: wrongRequest.run.problemVersionId,
          manifestId: wrongRequest.run.manifestId,
          language: wrongRequest.run.language,
          sourceChecksum: wrongRequest.run.sourceChecksum,
          terminalCategory: "wrong_answer",
          classification: "learner_failure",
          descriptorDigest: descriptorDigest.value,
          replayId: "application-replay-wrong",
          leaseEpoch: 1,
          completedAt: later.value,
        },
      }),
    ).resolves.toMatchObject({
      disposition: "committed",
      attempt: { status: "submitted" },
      observation: { passed: false, terminalCategory: "wrong_answer" },
    });

    const infrastructureAttempt = await startPracticeAttempt(context, practice, {
      sessionId: rescueSession.sessionId,
      problemVersionId: problem.value,
      manifestId: pythonManifest.value,
      language: "python",
    });

    let lostRun: CodeRunRequest | null = null;
    const lostRelay: ExecutionRelay = {
      prepare: async ({ run, eventId }) => makePreparation(run, eventId),
      dispatch: async ({ run }) => {
        lostRun = run;
        throw new Error("execution host response lost");
      },
      cancel: async () => undefined,
    };
    await expect(
      requestPracticeCodeRun(context, practice, lostRelay, {
        attemptId: infrastructureAttempt.attemptId,
        mode: "submit",
        source: "print('lost response')\n",
        sourceChecksum: sha256Digest("print('lost response')\n"),
        sourceLength: Buffer.byteLength("print('lost response')\n", "utf8"),
      }),
    ).rejects.toThrow("temporarily unavailable");
    expect(lostRun).not.toBeNull();
    expect(await practice.getRun(lostRun!.runId, otherLearner.value)).toMatchObject({
      terminalResultId: null,
    });
    await expect(
      ingestTrustedPracticeResult(context, practice, {
        result: {
          resultId: "application-result-infrastructure",
          runId: lostRun!.runId,
          attemptId: lostRun!.attemptId,
          problemVersionId: lostRun!.problemVersionId,
          manifestId: lostRun!.manifestId,
          language: lostRun!.language,
          sourceChecksum: lostRun!.sourceChecksum,
          terminalCategory: "infrastructure_error",
          classification: "infrastructure_failure",
          descriptorDigest: descriptorDigest.value,
          replayId: "application-replay-infrastructure",
          leaseEpoch: 1,
          completedAt: later.value,
        },
      }),
    ).resolves.toMatchObject({
      disposition: "committed",
      attempt: { status: "submitted" },
      observation: { passed: false, terminalCategory: "infrastructure_error" },
    });
  });

  it("commits a submit result, immutable observation, and outbox event as one idempotent boundary", async () => {
    const current = await practice.getAttempt(resetAttempt.value, learner.value);
    if (current === null) throw new Error("reset practice attempt fixture was not persisted");
    const runTransition = recordRunRequested(current, {
      eventId: submitEvent.value,
      runId: codeRun.value,
      sourceChecksum: checksum.value,
      occurredAt: later.value,
    });
    if (!runTransition.ok) throw new Error(runTransition.error.message);
    const run: CodeRunRequest = {
      runId: codeRun.value,
      learnerId: learner.value,
      attemptId: current.attemptId,
      mode: "submit",
      problemVersionId: current.problemVersionId,
      manifestId: current.manifestId,
      language: current.language,
      sourceChecksum: checksum.value,
      sourceLength: 18,
      requestedAt: later.value,
    };
    const requested = await practice.createRunRequest({
      run,
      attempt: runTransition.value.attempt,
      event: runTransition.value.event,
      expectedAttemptVersion: current.version,
      outbox: createOutboxEvent({
        eventId: executionDispatchId.value,
        topic: "execution.run.requested",
        aggregateId: run.runId,
        occurredAt: later.value,
        payload: {
          topic: "execution.run.requested",
          dispatchKey: `dispatch-${run.runId}`,
          descriptor: { runId: run.runId, sourceDigest: run.sourceChecksum },
          quota: { quotaKey: `learner:${run.learnerId}`, profileId: "python", maxConcurrent: 1 },
        },
      }),
    });
    expect(requested).toMatchObject({ version: 2, status: "active" });

    const result: TrustedExecutionResult = {
      resultId: "result-integration-1",
      runId: run.runId,
      attemptId: run.attemptId,
      problemVersionId: run.problemVersionId,
      manifestId: run.manifestId,
      language: run.language,
      sourceChecksum: run.sourceChecksum,
      terminalCategory: "pass",
      classification: "success",
      descriptorDigest: descriptorDigest.value,
      replayId: "replay-integration-1",
      leaseEpoch: 1,
      completedAt: later.value,
    };
    const submitted = submitAttempt(runTransition.value.attempt, {
      eventId: submitAttemptEvent.value,
      runId: run.runId,
      sourceChecksum: run.sourceChecksum,
      submittedAt: later.value,
    });
    if (!submitted.ok) throw new Error(submitted.error.message);
    const observation: AssessmentObservation = {
      observationId: observationId.value,
      runId: run.runId,
      attemptId: run.attemptId,
      learnerId: run.learnerId,
      problemVersionId: run.problemVersionId,
      manifestId: run.manifestId,
      language: run.language,
      sourceChecksum: run.sourceChecksum,
      resultId: result.resultId,
      terminalCategory: "pass",
      passed: true,
      observedAt: later.value,
    };
    const outbox = createOutboxEvent({
      eventId: outboxId.value,
      topic: "practice.assessment.observed",
      aggregateId: run.attemptId,
      occurredAt: later.value,
      payload: { runId: run.runId, resultId: result.resultId, passed: true },
    });
    const runRecord = {
      ...run,
      terminalResultId: null,
      terminalCategory: null,
      classification: null,
      completedAt: null,
    } as const;
    const committed = await practice.commitTerminalResult({
      run: runRecord,
      result,
      attempt: submitted.value.attempt,
      event: submitted.value.event,
      expectedAttemptVersion: runTransition.value.attempt.version,
      observation,
      outbox,
    });
    expect(committed).toMatchObject({
      disposition: "committed",
      attempt: { status: "submitted" },
      observation: { resultId: result.resultId, passed: true },
    });
    expect(await practice.getRun(run.runId, learner.value)).toMatchObject({
      terminalResultId: result.resultId,
      terminalCategory: "pass",
      classification: "success",
      completedAt: later.value,
    });
    expect(
      await runtimePool!.query(
        "SELECT observation_id, result_id FROM practice.assessment_observation WHERE run_id = $1",
        [run.runId],
      ),
    ).toMatchObject({
      rows: [{ observation_id: observationId.value, result_id: result.resultId }],
    });
    const replay = await practice.commitTerminalResult({
      run: runRecord,
      result,
      attempt: submitted.value.attempt,
      event: submitted.value.event,
      expectedAttemptVersion: runTransition.value.attempt.version,
      observation,
      outbox,
    });
    expect(replay).toMatchObject({ disposition: "replayed" });
    expect(
      await runtimePool!.query(
        "SELECT count(*)::int AS count FROM platform.outbox_event WHERE event_id = $1",
        [outboxId.value],
      ),
    ).toMatchObject({ rows: [{ count: 1 }] });
  });
});
