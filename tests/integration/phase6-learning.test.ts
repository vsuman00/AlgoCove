import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  consumePracticeAssessment,
  getOwnedProgress,
  getLearnerHome,
  createActor,
  createFixedClock,
  createOutboxEvent,
  createRequestContext,
  ingestTrustedPracticeResult,
  requestPracticeCodeRun,
  revealAuthoredHint,
  startPracticeAttempt,
  startPracticeSession,
  type ExecutionRelay,
  type IdGenerator,
} from "@algocove/application";
import {
  bootstrapDatabase,
  createPool,
  migrate,
  PostgresHintRepository,
  PostgresReviewRepository,
  PostgresProgressRepository,
  PostgresConceptMappingRepository,
  PostgresMasteryConceptSource,
  PostgresMasteryRepository,
  PostgresPracticeRepository,
} from "@algocove/db";
import {
  formatId,
  MASTERY_POLICY_V1,
  parseId,
  parseInstant,
  type ProblemLanguage,
  type Result,
} from "@algocove/domain";
import { sha256Digest } from "@algocove/execution-contracts";

function must<T>(result: Result<T, unknown>): T {
  if (!result.ok) throw new Error("Invalid mastery integration fixture");
  return result.value;
}
const suffix = `${process.pid}_${Date.now()}`;
const databaseName = `algocove_learning_${suffix}`;
const migrationRole = `algocove_learning_mig_${suffix}`;
const runtimeRole = `algocove_learning_run_${suffix}`;
const baseUrl = new URL(
  process.env.DATABASE_TEST_OPERATOR_URL ??
    process.env.DATABASE_ADMIN_URL ??
    "postgres://postgres:postgres@127.0.0.1:54329/postgres",
);
const targetUrl = new URL(baseUrl);
targetUrl.pathname = `/${databaseName}`;
const migrationUrl = new URL(targetUrl);
migrationUrl.username = migrationRole;
migrationUrl.password = randomUUID();
const runtimeUrl = new URL(targetUrl);
runtimeUrl.username = runtimeRole;
runtimeUrl.password = randomUUID();
baseUrl.pathname = "/postgres";
const operator = createPool({
  connectionString: baseUrl.toString(),
  applicationName: "mastery-test-operator",
  maxConnections: 2,
  statementTimeoutMs: 5000,
});
const runtime = createPool({
  connectionString: runtimeUrl.toString(),
  applicationName: "mastery-test-runtime",
  maxConnections: 4,
  statementTimeoutMs: 5000,
});
const practice = new PostgresPracticeRepository(runtime);
const mastery = new PostgresMasteryRepository(runtime);
const reviews = new PostgresReviewRepository(runtime);
const progress = new PostgresProgressRepository(runtime);
const hints = new PostgresHintRepository(runtime);
const ports = { practice, mastery, curriculum: new PostgresMasteryConceptSource(runtime) };
const learnerId = must(formatId("learner", "eeeeeeeeeeeeeeee"));
const conceptId = must(formatId("concept", "aaaaaaaaaaaaaaaa"));
const problemVersionId = must(formatId("problemVersion", "dddddddddddddddd"));
let entropy = 1000;
const ids: IdGenerator = {
  generate(kind) {
    return must(formatId(kind, String(entropy++).padStart(16, "0")));
  },
};
let tick = 0;
function context() {
  const now = must(parseInstant(new Date(Date.UTC(2026, 9, 2, 10, tick++)).toISOString()));
  return createRequestContext({
    actor: createActor({
      userId: learnerId,
      sessionId: must(formatId("session", "eeeeeeeeeeeeeeee")),
      roles: ["learner"],
    }),
    clock: createFixedClock(now),
    ids,
    serviceName: "mastery-integration",
  });
}
const relay: ExecutionRelay = {
  prepare: async ({ run, eventId }) => ({
    outbox: createOutboxEvent({
      eventId,
      topic: "execution.run.requested",
      aggregateId: run.runId,
      occurredAt: run.requestedAt,
      payload: {
        dispatchKey: run.runId,
        descriptor: { runId: run.runId, sourceDigest: run.sourceChecksum },
      },
    }),
    token: "fixture-dispatch",
  }),
  dispatch: async ({ run }) => ({ runId: run.runId, replayed: false }),
  cancel: async () => undefined,
};
let sessionId: Awaited<ReturnType<typeof startPracticeSession>>["sessionId"];
async function submit(language: "python" | "javascript", disclose = false) {
  const ctx = context();
  const attempt = await startPracticeAttempt(ctx, practice, {
    sessionId,
    problemVersionId,
    manifestId: must(
      formatId("languageManifest", language === "python" ? "aaaaaaaaaaaaaaaa" : "bbbbbbbbbbbbbbbb"),
    ),
    language,
  });
  if (disclose)
    await revealAuthoredHint(ctx, hints, {
      attemptId: attempt.attemptId,
      hintId: "hint-arrays-4",
      requestedTier: 4,
      idempotencyKey: `mastery-hint-${attempt.attemptId}`,
    });
  const source = "original integration fixture";
  const requested = await requestPracticeCodeRun(ctx, practice, relay, {
    attemptId: attempt.attemptId,
    mode: "submit",
    source,
    sourceChecksum: sha256Digest(source),
    sourceLength: Buffer.byteLength(source),
  });
  const receipt = await ingestTrustedPracticeResult(context(), practice, {
    result: {
      resultId: `result-${requested.run.runId}`,
      runId: requested.run.runId,
      attemptId: attempt.attemptId,
      problemVersionId,
      manifestId: requested.run.manifestId,
      language: language as ProblemLanguage,
      sourceChecksum: requested.run.sourceChecksum,
      terminalCategory: "pass",
      classification: "success",
      descriptorDigest: sha256Digest("descriptor"),
      replayId: requested.run.runId,
      leaseEpoch: 1,
      completedAt: context().now,
    },
  });
  if (receipt.observation === null) throw new Error("Submission observation missing");
  const event = await runtime.query<{ event_id: string }>(
    "SELECT event_id FROM platform.outbox_event WHERE topic='practice.assessment.observed' AND payload->>'observationId'=$1",
    [receipt.observation.observationId],
  );
  return {
    observation: receipt.observation,
    eventId: must(parseId("event", event.rows[0]?.event_id)),
  };
}

describe("Phase 6 learning sources, reviews and progress", () => {
  beforeAll(async () => {
    operator.on("error", () => undefined);
    runtime.on("error", () => undefined);
    await operator.query(`CREATE DATABASE "${databaseName}"`);
    await bootstrapDatabase({
      operatorConnectionString: targetUrl.toString(),
      migrationRole: { name: migrationRole, password: migrationUrl.password },
      runtimeRole: { name: runtimeRole, password: runtimeUrl.password },
      logger: { info: () => undefined },
    });
    await migrate({ connectionString: migrationUrl.toString(), logger: { info: () => undefined } });
    for (let n = 0; n < 2; n++)
      execFileSync(process.execPath, ["packages/db/src/cli/seed-practice.ts"], {
        env: { ...process.env, DATABASE_ADMIN_URL: targetUrl.toString() },
        stdio: "pipe",
      });
    await runtime.query("INSERT INTO platform.learner(learner_id) VALUES ($1)", [learnerId]);
    sessionId = (await startPracticeSession(context(), practice, "practice")).sessionId;
  });
  afterAll(async () => {
    await runtime.end();
    await operator.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await operator.query(`DROP ROLE IF EXISTS "${migrationRole}"`);
    await operator.query(`DROP ROLE IF EXISTS "${runtimeRole}"`);
    await operator.end();
  });

  let first: Awaited<ReturnType<typeof submit>>;
  let reviewId: ReturnType<typeof ids.generate<"event">>;
  let pseudocodeId: ReturnType<typeof ids.generate<"pseudocode">>;
  const future = must(parseInstant("2026-10-15T10:00:00.000Z"));
  const answers = { measure: "15", move: "shorter_post" };
  it("persists code activity and detects unconsumed sources before showing credit", async () => {
    await runtime.query(
      "INSERT INTO platform.learner_profile(learner_id,goal,target_role,timezone,daily_capacity_minutes,horizon_days,preferred_languages,updated_by) VALUES($1,'Learn patterns','Engineer','America/New_York',30,30,ARRAY['python'],$1)",
      [learnerId],
    );
    expect((await getLearnerHome(context(), progress)).action.kind).toBe("intro");
    first = await submit("python");
    await consumePracticeAssessment({ now: context().now, ids }, ports, first.eventId);
    const next = await submit("python");
    expect((await progress.getProgress({ learnerId, now: context().now })).mastery[0]?.status).toBe(
      "projection_pending",
    );
    await consumePracticeAssessment({ now: context().now, ids }, ports, next.eventId);
    const queue = await reviews.listReviews({ learnerId, now: future });
    expect(queue).toHaveLength(1);
    reviewId = queue[0]!.reviewId;
    expect(queue[0]).toMatchObject({
      timing: "overdue",
      exercise: { exerciseId: "boundary-transfer-v1" },
    });
    expect(JSON.stringify(queue)).not.toContain('"answer":');
    expect(
      (
        await runtime.query(
          "SELECT count(*)::integer AS n FROM mastery.review_event WHERE kind='superseded'",
        )
      ).rows[0]?.n,
    ).toBe(1);
    expect((await progress.getProgress({ learnerId, now: context().now })).activities).toHaveLength(
      2,
    );
  });
  it("grades saved structured answers, keeps prose advisory, deduplicates confidence and rejects other owners", async () => {
    const origin = (
      await runtime.query(
        "SELECT * FROM practice.attempt WHERE learner_id=$1 ORDER BY started_at LIMIT 1",
        [learnerId],
      )
    ).rows[0]!;
    pseudocodeId = ids.generate("pseudocode");
    const fields = {
      inputs: "untrusted prose",
      state: "",
      initialization: "",
      invariant: "",
      loop: "",
      termination: "",
      output: "",
      complexity: "",
      structuredAnswers: { area: "minimum_times_width", boundary: "shorter" },
    };
    await runtime.query(
      "INSERT INTO practice.pseudocode_artifact(pseudocode_id,attempt_id,learner_id,problem_version_id,manifest_id,language,current_fields,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8)",
      [
        pseudocodeId,
        origin.attempt_id,
        learnerId,
        problemVersionId,
        origin.manifest_id,
        origin.language,
        JSON.stringify(fields),
        context().now,
      ],
    );
    await runtime.query(
      "INSERT INTO practice.pseudocode_revision(pseudocode_id,learner_id,attempt_id,problem_version_id,manifest_id,language,revision,fields,saved_at) VALUES($1,$2,$3,$4,$5,$6,1,$7::jsonb,$8)",
      [
        pseudocodeId,
        learnerId,
        origin.attempt_id,
        problemVersionId,
        origin.manifest_id,
        origin.language,
        JSON.stringify(fields),
        context().now,
      ],
    );
    const input = {
      learnerId,
      pseudocodeId,
      revision: 1,
      confidence: "high" as const,
      now: context().now,
    };
    const rollbackId = ids.generate("event");
    await expect(
      reviews.observeExplanation({ ...input, observationId: rollbackId, eventId: first.eventId }),
    ).rejects.toMatchObject({ code: "23505" });
    expect(
      (
        await runtime.query("SELECT 1 FROM practice.learning_observation WHERE observation_id=$1", [
          rollbackId,
        ])
      ).rowCount,
    ).toBe(0);
    expect(
      (
        await runtime.query("SELECT 1 FROM practice.study_activity WHERE observation_id=$1", [
          rollbackId,
        ])
      ).rowCount,
    ).toBe(0);
    const results = await Promise.all(
      [0, 1].map(() =>
        reviews.observeExplanation({
          ...input,
          observationId: ids.generate("event"),
          eventId: ids.generate("event"),
        }),
      ),
    );
    expect(results.map((r) => r.disposition).sort()).toEqual(["committed", "replayed"]);
    expect(results[0]!.correct).toBe(true);
    await consumePracticeAssessment({ now: context().now, ids }, ports, results[0]!.sourceEventId);
    const snapshot = await progress.getProgress({ learnerId, now: context().now });
    expect(snapshot.calibration).toHaveLength(1);
    expect(snapshot.calibration[0]).toMatchObject({
      confidence: "high",
      provenance: "learner_reported",
      correct: true,
    });
    expect(snapshot.mastery[0]!.projection.languageProficiency.python?.observedPasses).toBe(2);
    await expect(
      reviews.observeExplanation({
        ...input,
        confidence: "low",
        observationId: ids.generate("event"),
        eventId: ids.generate("event"),
      }),
    ).rejects.toMatchObject({ code: "version_conflict" });
    const other = must(formatId("learner", "9999999999999999"));
    await runtime.query("INSERT INTO platform.learner(learner_id) VALUES($1)", [other]);
    await expect(
      reviews.observeExplanation({
        ...input,
        learnerId: other,
        observationId: ids.generate("event"),
        eventId: ids.generate("event"),
      }),
    ).rejects.toMatchObject({ code: "not_found" });
    await runtime.query(
      'INSERT INTO practice.pseudocode_revision(pseudocode_id,learner_id,attempt_id,problem_version_id,manifest_id,language,revision,fields,saved_at) SELECT pseudocode_id,learner_id,attempt_id,problem_version_id,manifest_id,language,2,jsonb_set(fields,\'{structuredAnswers}\',\'{"area":"sum","boundary":"both"}\'::jsonb),$2 FROM practice.pseudocode_revision WHERE pseudocode_id=$1 AND revision=1',
      [pseudocodeId, context().now],
    );
    const wrong = await reviews.observeExplanation({
      ...input,
      revision: 2,
      confidence: null,
      now: context().now,
      observationId: ids.generate("event"),
      eventId: ids.generate("event"),
    });
    expect(wrong.correct).toBe(false);
    await consumePracticeAssessment({ now: context().now, ids }, ports, wrong.sourceEventId);
    await expect(
      runtime.query("UPDATE practice.learning_observation SET facts=facts"),
    ).rejects.toMatchObject({ code: "55006" });
  });
  it("answers an overdue independent transfer once under concurrent retries and schedules the next watermark", async () => {
    const input = {
      learnerId,
      reviewId,
      exerciseId: "boundary-transfer-v1",
      answers,
      confidence: "medium" as const,
      now: future,
    };
    await expect(
      reviews.answerReview({
        ...input,
        answers: { measure: "invented", move: "shorter_post" },
        observationId: ids.generate("event"),
        eventId: ids.generate("event"),
      }),
    ).rejects.toMatchObject({ code: "invalid_request" });
    await expect(
      reviews.answerReview({
        ...input,
        learnerId: must(formatId("learner", "9999999999999999")),
        observationId: ids.generate("event"),
        eventId: ids.generate("event"),
      }),
    ).rejects.toMatchObject({ code: "not_found" });
    const results = await Promise.all(
      [0, 1].map(() =>
        reviews.answerReview({
          ...input,
          observationId: ids.generate("event"),
          eventId: ids.generate("event"),
        }),
      ),
    );
    expect(results.map((r) => r.disposition).sort()).toEqual(["committed", "replayed"]);
    expect((await reviews.listReviews({ learnerId, now: future }))[0]!.status).toBe(
      "awaiting_projection",
    );
    const delivered = await consumePracticeAssessment(
      { now: future, ids },
      ports,
      results[0]!.sourceEventId,
    );
    expect(delivered.projections[0]).toMatchObject({ band: "independent_delayed_transfer" });
    expect(delivered.projections[0]!.languageProficiency.python?.observedPasses).toBe(2);
    await consumePracticeAssessment({ now: future, ids }, ports, results[0]!.sourceEventId);
    const queue = await reviews.listReviews({ learnerId, now: future });
    expect(queue).toHaveLength(2);
    expect(queue.find((r) => r.reviewId === reviewId)).toMatchObject({
      status: "completed",
      exercise: { exerciseId: "boundary-transfer-v1" },
    });
    expect(queue.filter((r) => r.status === "due")).toHaveLength(1);
    await expect(
      reviews.answerReview({
        ...input,
        answers: { ...answers, measure: "40" },
        observationId: ids.generate("event"),
        eventId: ids.generate("event"),
      }),
    ).rejects.toMatchObject({ code: "version_conflict" });
    expect((await progress.getProgress({ learnerId, now: future })).reviewHealth).toMatchObject({
      completed: 1,
      pending: 0,
    });
  });
  it("defers without erasing history and treats repeated exercises as recall, including wrong answers", async () => {
    const queue = await reviews.listReviews({ learnerId, now: future });
    const next = queue.find((r) => r.status === "due")!;
    const until = must(parseInstant("2026-10-30T10:00:00.000Z"));
    await reviews.deferReview({
      learnerId,
      reviewId: next.reviewId,
      until,
      now: future,
      eventId: ids.generate("event"),
    });
    await reviews.deferReview({
      learnerId,
      reviewId: next.reviewId,
      until,
      now: future,
      eventId: ids.generate("event"),
    });
    const deferred = (await reviews.listReviews({ learnerId, now: future })).find(
      (r) => r.reviewId === next.reviewId,
    )!;
    expect(deferred).toMatchObject({ status: "deferred", timing: "upcoming" });
    await expect(
      reviews.answerReview({
        learnerId,
        reviewId: next.reviewId,
        exerciseId: next.exercise!.exerciseId,
        answers,
        confidence: null,
        now: future,
        observationId: ids.generate("event"),
        eventId: ids.generate("event"),
      }),
    ).rejects.toMatchObject({ code: "invalid_request" });
    const result = await reviews.answerReview({
      learnerId,
      reviewId: next.reviewId,
      exerciseId: "boundary-transfer-v1",
      answers: { measure: "40", move: "taller_post" },
      confidence: "high",
      now: until,
      observationId: ids.generate("event"),
      eventId: ids.generate("event"),
    });
    expect(result.correct).toBe(false);
    const fact = (
      await runtime.query(
        "SELECT facts FROM practice.learning_observation WHERE observation_id=$1",
        [result.observationId],
      )
    ).rows[0]!.facts;
    expect(fact).toMatchObject({ transfer: false, sourceKind: "review" });
    await consumePracticeAssessment({ now: until, ids }, ports, result.sourceEventId);
    const report = await progress.getProgress({ learnerId, now: until });
    expect(report.mastery[0]!.projection.band).toBe("needs_practice");
    expect(report.activities.some((a) => a.observationId === result.observationId)).toBe(true);
    expect(
      (await reviews.listReviews({ learnerId, now: until })).filter((r) => r.status === "due"),
    ).toHaveLength(1);
  });
  it("separates external reports and immutable timezone history, with prospective pause fences", async () => {
    const ref = must(formatId("externalReference", "aaaaaaaaaaaaaaaa"));
    await runtime.query(
      "INSERT INTO content.external_reference(external_reference_id,provider,external_key,title,canonical_url,attribution,url_status) VALUES($1,'neetcode','patterns','Reviewed pattern practice','https://neetcode.io/practice','NeetCode','reviewed')",
      [ref],
    );
    const before = await getOwnedProgress(context(), progress);
    const command = {
      learnerId,
      now: context().now,
      referenceId: ref,
      kind: "completed" as const,
      idempotencyKey: "phase6-journal-1",
      eventId: ids.generate("event"),
    };
    await progress.recordExternal(command);
    await progress.recordExternal({ ...command, eventId: ids.generate("event") });
    const after = await getOwnedProgress(context(), progress);
    expect(after.externalPractice.completed).toBe(1);
    expect(after.consistency.activeDays).toBe(before.consistency.activeDays);
    expect(after.mastery).toEqual(before.mastery);
    expect(after.planAdherence).toMatchObject({ status: "no_accepted_plan", totalDue: null });
    await expect(
      progress.recordExternal({ ...command, kind: "corrected", eventId: ids.generate("event") }),
    ).rejects.toMatchObject({ code: "version_conflict" });
    await progress.recordExternal({
      ...command,
      kind: "corrected",
      idempotencyKey: "phase6-journal-2",
      now: context().now,
      eventId: ids.generate("event"),
    });
    expect(
      (await progress.getProgress({ learnerId, now: context().now })).externalPractice.completed,
    ).toBe(0);
    const pause = {
      learnerId,
      now: context().now,
      timezone: "America/New_York",
      startDay: "2026-10-03",
      endDay: "2026-10-04",
      eventId: ids.generate("event"),
    };
    await progress.pauseStudy(pause);
    await progress.pauseStudy({ ...pause, eventId: ids.generate("event") });
    await expect(
      progress.pauseStudy({ ...pause, startDay: "2026-10-01", eventId: ids.generate("event") }),
    ).rejects.toMatchObject({ code: "invalid_request" });
    const activityBefore = (
      await runtime.query("SELECT * FROM practice.study_activity ORDER BY observation_id")
    ).rows;
    await runtime.query(
      "UPDATE platform.learner_profile SET timezone='Asia/Kolkata' WHERE learner_id=$1",
      [learnerId],
    );
    await expect(
      progress.pauseStudy({ ...pause, eventId: ids.generate("event") }),
    ).rejects.toMatchObject({ code: "version_conflict" });
    expect(
      (await runtime.query("SELECT * FROM practice.study_activity ORDER BY observation_id")).rows,
    ).toEqual(activityBefore);
    expect((await getOwnedProgress(context(), progress)).consistency.activeDays).toBe(0);
  });
  it("rebuilds all source kinds without changing their facts or review identities", async () => {
    const output = execFileSync(
      process.execPath,
      ["apps/worker/src/mastery-cli.ts", "consume", "--limit=100"],
      { env: { ...process.env, DATABASE_URL: runtimeUrl.toString() }, encoding: "utf8" },
    );
    expect(output).toContain('"kind":"delivered"');
    expect(output).toContain('"kind":"idle"');
    const facts = (
      await runtime.query("SELECT facts FROM mastery.evidence ORDER BY observation_id")
    ).rows;
    const items = (
      await runtime.query("SELECT review_id,status FROM mastery.review_item ORDER BY review_id")
    ).rows;
    const before = (await mastery.readView({ learnerId, conceptId, policyVersion: 1 }))!.projection;
    await runtime.query("DELETE FROM mastery.projection WHERE learner_id=$1", [learnerId]);
    expect(await mastery.rebuild({ learnerId, conceptId, policy: MASTERY_POLICY_V1 })).toEqual(
      before,
    );
    expect(
      (await runtime.query("SELECT facts FROM mastery.evidence ORDER BY observation_id")).rows,
    ).toEqual(facts);
    expect(
      (await runtime.query("SELECT review_id,status FROM mastery.review_item ORDER BY review_id"))
        .rows,
    ).toEqual(items);
  });
  it("authors mappings only on owned drafts and invalidates prior review decisions", async () => {
    const repository = new PostgresConceptMappingRepository(runtime);
    const author = must(formatId("learner", "aaaaaaaaaaaaaaaa"));
    await expect(
      repository.replaceDraftMapping({
        problemVersionId,
        learnerId: author,
        now: context().now,
        mappings: [{ conceptId, rationale: "New mapping" }],
      }),
    ).rejects.toMatchObject({ code: "version_conflict" });
    const draftId = ids.generate("contentVersion"),
      problemId = ids.generate("problemVersion");
    await runtime.query(
      "INSERT INTO content.content_version(content_version_id,content_id,title,checksum,provenance_kind,rights_holder,license,author_id,status,payload_status) SELECT $1,content_id,title,checksum,provenance_kind,rights_holder,license,author_id,'draft','available' FROM content.content_version WHERE content_version_id='cnt_aaaaaaaaaaaaaaaa'",
      [draftId],
    );
    await runtime.query(
      "INSERT INTO content.problem_version(problem_version_id,problem_id,content_version_id,statement) SELECT $1,problem_id,$2,statement FROM content.problem_version WHERE problem_version_id=$3",
      [problemId, draftId, problemVersionId],
    );
    await runtime.query(
      "INSERT INTO content.content_review(content_version_id,review_kind,reviewer_id,decision) VALUES($1,'technical','usr_bbbbbbbbbbbbbbbb','approved')",
      [draftId],
    );
    await expect(
      repository.replaceDraftMapping({
        problemVersionId: problemId,
        learnerId,
        now: context().now,
        mappings: [{ conceptId, rationale: "Learning invariant" }],
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    await repository.replaceDraftMapping({
      problemVersionId: problemId,
      learnerId: author,
      now: context().now,
      mappings: [{ conceptId, rationale: "Learning invariant" }],
    });
    expect(
      (
        await runtime.query("SELECT * FROM content.content_review WHERE content_version_id=$1", [
          draftId,
        ])
      ).rowCount,
    ).toBe(0);
    expect(
      (
        await runtime.query(
          "SELECT rationale,mapped_by FROM learning.problem_concept WHERE problem_version_id=$1",
          [problemId],
        )
      ).rows,
    ).toEqual([{ rationale: "Learning invariant", mapped_by: author }]);
  });
  it("enforces reviewed keys, publication duties and availability", async () => {
    await expect(
      runtime.query(
        "UPDATE content.review_exercise SET questions='[]' WHERE exercise_id='boundary-transfer-v1'",
      ),
    ).rejects.toMatchObject({ code: "55006" });
    await expect(
      runtime.query(
        'INSERT INTO content.review_exercise(exercise_id,concept_id,kind,title,questions,author_id,technical_reviewer_id,pedagogical_reviewer_id,publisher_id,status) SELECT \'invalid-keys\',concept_id,kind,title,\'[{"id":"x","prompt":"Choose","options":[{"value":"a","label":"A"},{"value":"b","label":"B"}],"answer":"fake"}]\'::jsonb,author_id,technical_reviewer_id,pedagogical_reviewer_id,publisher_id,status FROM content.review_exercise WHERE exercise_id=\'boundary-transfer-v1\'',
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      runtime.query(
        "INSERT INTO content.review_exercise(exercise_id,concept_id,kind,title,questions,author_id,technical_reviewer_id,pedagogical_reviewer_id,publisher_id,status) SELECT 'invalid-duties',concept_id,kind,title,questions,author_id,author_id,pedagogical_reviewer_id,publisher_id,status FROM content.review_exercise WHERE exercise_id='boundary-transfer-v1'",
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await runtime.query("UPDATE content.review_exercise SET status='retired'");
    const queue = await reviews.listReviews({ learnerId, now: future });
    expect(queue.find((r) => r.status === "due")!.exercise).toBeNull();
    const next = queue.find((r) => r.status === "due")!;
    await expect(
      reviews.answerReview({
        learnerId,
        reviewId: next.reviewId,
        exerciseId: "boundary-transfer-v1",
        answers,
        confidence: null,
        now: must(parseInstant("2026-12-01T00:00:00Z")),
        observationId: ids.generate("event"),
        eventId: ids.generate("event"),
      }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect((await getLearnerHome(context(), progress)).action.kind).not.toBe("review");
  });
});
