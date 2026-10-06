import { randomUUID } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { resolve } from "node:path";
import { chromium, expect as browserExpect } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  consumePracticeAssessment,
  evaluateOwnedExternalReadiness,
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
  PostgresExternalReadinessRepository,
  PostgresExternalCompanionRepository,
  PostgresReadinessContentRepository,
} from "@algocove/db";
import {
  formatId,
  MASTERY_POLICY_V1,
  parseId,
  parseInstant,
  READINESS_CATEGORIES,
  CONTAINER_EXTERNAL_QUESTIONS,
  evaluateExternalReadiness,
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
    await expect(progress.recordExternal(command)).rejects.toMatchObject({
      code: "invalid_request",
    });
    await runtime.query(
      "INSERT INTO practice.external_practice_event(event_id,learner_id,reference_id,kind,idempotency_key,occurred_at,attempt_id) VALUES($1,$2,$3,'handoff_requested','phase6-gated-fixture',$4,$5)",
      [ids.generate("event"), learnerId, ref, context().now, first.observation.attemptId],
    );
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
  it("loads a consistent owner-scoped external readiness snapshot and fences changed work", async () => {
    const repo = new PostgresExternalReadinessRepository(runtime);
    const prepSession = await startPracticeSession(context(), practice, "learn");
    const attempt = await startPracticeAttempt(context(), practice, {
      sessionId: prepSession.sessionId,
      problemVersionId,
      manifestId: must(formatId("languageManifest", "aaaaaaaaaaaaaaaa")),
      language: "python",
    });
    expect(
      await repo.loadOwnedReadiness(
        attempt.attemptId,
        must(formatId("learner", "9999999999999999")),
      ),
    ).toBeNull();
    const unconfigured = await repo.loadOwnedReadiness(attempt.attemptId, learnerId);
    expect(unconfigured?.rubric).toBeNull();
    const requirements = READINESS_CATEGORIES.map((category) => ({
      category,
      checkIds: [category],
    }));
    const policy = `INSERT INTO content.external_readiness_rubric(rubric_id,version,problem_version_id,mode,requirements,maximum_assistance_tier,author_id,technical_reviewer_id,pedagogical_reviewer_id,publisher_id,status)
      VALUES('integration.external',1,$1,'learn',$2::jsonb,4,'usr_aaaaaaaaaaaaaaaa','usr_bbbbbbbbbbbbbbbb','usr_cccccccccccccccc','usr_ffffffffffffffff','published')`;
    await expect(
      runtime.query(policy, [
        problemVersionId,
        JSON.stringify(requirements.map((r) => ({ ...r, checkIds: [] }))),
      ]),
    ).rejects.toMatchObject({ code: "23514" });
    await runtime.query(policy, [problemVersionId, JSON.stringify(requirements)]);
    await expect(
      runtime.query(
        "UPDATE content.external_readiness_rubric SET maximum_assistance_tier=6 WHERE rubric_id='integration.external'",
      ),
    ).rejects.toMatchObject({ code: "55006" });
    const fields = Object.fromEntries(
      [
        "inputs",
        "state",
        "initialization",
        "invariant",
        "loop",
        "termination",
        "output",
        "complexity",
      ].map((f) => [f, "fixture"]),
    );
    const source = "readiness fixture source";
    await runtime.query(
      `INSERT INTO practice.draft(draft_id,attempt_id,learner_id,problem_version_id,manifest_id,language,kind,current_text,updated_at,expires_at)
      VALUES($1,$2,$3,$4,$5,'python','source',$6,now(),now()+interval '1 day')`,
      [
        ids.generate("draft"),
        attempt.attemptId,
        learnerId,
        problemVersionId,
        attempt.manifestId,
        source,
      ],
    );
    await runtime.query(
      `INSERT INTO practice.pseudocode_artifact(pseudocode_id,attempt_id,learner_id,problem_version_id,manifest_id,language,current_fields,current_revision,saved_revision,updated_at)
      VALUES($1,$2,$3,$4,$5,'python',$6::jsonb,1,1,now())`,
      [
        ids.generate("pseudocode"),
        attempt.attemptId,
        learnerId,
        problemVersionId,
        attempt.manifestId,
        JSON.stringify(fields),
      ],
    );
    await runtime.query(
      `INSERT INTO practice.pseudocode_revision(pseudocode_id,learner_id,attempt_id,problem_version_id,manifest_id,language,revision,fields,saved_at)
      SELECT pseudocode_id,learner_id,attempt_id,problem_version_id,manifest_id,language,1,current_fields,now() FROM practice.pseudocode_artifact WHERE attempt_id=$1`,
      [attempt.attemptId],
    );
    for (const category of READINESS_CATEGORIES)
      await runtime.query(
        `INSERT INTO practice.external_readiness_evidence(evidence_id,learner_id,attempt_id,problem_version_id,manifest_id,mode,source_checksum,reasoning_revision,rubric_id,rubric_version,category,check_id,provenance,correct,observed_at)
      VALUES($1,$2,$3,$4,$5,'learn',$6,1,'integration.external',1,$7,$7,$8,true,now())`,
        [
          ids.generate("event"),
          learnerId,
          attempt.attemptId,
          problemVersionId,
          attempt.manifestId,
          sha256Digest(source),
          category,
          category === "execution" ? "server_observed_test" : "structured_check",
        ],
      );
    const snapshot = await repo.loadOwnedReadiness(attempt.attemptId, learnerId);
    expect(snapshot?.binding.sourceChecksum).toBe(sha256Digest(source));
    expect(evaluateExternalReadiness(snapshot!).status).toBe("ready");
    await expect(
      runtime.query(
        "UPDATE practice.external_readiness_evidence SET correct=false WHERE attempt_id=$1",
        [attempt.attemptId],
      ),
    ).rejects.toMatchObject({ code: "55006" });
    await runtime.query("UPDATE practice.draft SET current_text='changed' WHERE attempt_id=$1", [
      attempt.attemptId,
    ]);
    expect(
      evaluateExternalReadiness((await repo.loadOwnedReadiness(attempt.attemptId, learnerId))!)
        .status,
    ).toBe("not_ready");
    await runtime.query("UPDATE practice.draft SET current_text=$2 WHERE attempt_id=$1", [
      attempt.attemptId,
      source,
    ]);
    await runtime.query(
      "UPDATE practice.pseudocode_artifact SET current_revision=2 WHERE attempt_id=$1",
      [attempt.attemptId],
    );
    expect(
      (await repo.loadOwnedReadiness(attempt.attemptId, learnerId))?.binding.reasoningRevision,
    ).toBe(0);
    await runtime.query(
      "UPDATE content.external_readiness_rubric SET status='retired' WHERE rubric_id='integration.external'",
    );
    expect((await repo.loadOwnedReadiness(attempt.attemptId, learnerId))?.rubric).toBeNull();
  });
  it("completes reviewed preparation, trusted execution, gated handoff and reversible self-report without mastery credit", async () => {
    const content = new PostgresReadinessContentRepository(runtime),
      companion = new PostgresExternalCompanionRepository(runtime);
    function staff(
      userId: string,
      role: "author" | "technical_reviewer" | "pedagogical_reviewer" | "publisher",
    ) {
      const base = context();
      return {
        ...base,
        actor: createActor({
          userId,
          sessionId: must(formatId("session", "aaaaaaaaaaaaaaaa")),
          roles: [role],
        }),
      };
    }
    const author = staff("usr_aaaaaaaaaaaaaaaa", "author"),
      technical = staff("usr_bbbbbbbbbbbbbbbb", "technical_reviewer"),
      pedagogical = staff("usr_cccccccccccccccc", "pedagogical_reviewer"),
      publisher = staff("usr_ffffffffffffffff", "publisher");
    await expect(content.list(context())).rejects.toMatchObject({ code: "forbidden" });
    await content.command(author, {
      action: "create_reference",
      provider: "top_interview_150",
      externalKey: "container-independent",
      title: "Independent two-pointer practice",
      canonicalUrl: "https://leetcode.com/problems/container-with-most-water/",
      attribution: "LeetCode",
    });
    const ref = (
      await runtime.query<{ external_reference_id: string }>(
        "SELECT external_reference_id FROM content.external_reference WHERE external_key='container-independent'",
      )
    ).rows[0]!.external_reference_id;
    await expect(
      content.command(staff(author.actor.userId, "technical_reviewer"), {
        action: "review_reference",
        referenceId: ref,
        status: "reviewed",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    await content.command(technical, {
      action: "review_reference",
      referenceId: ref,
      status: "reviewed",
    });
    const identity = { rubricId: "companion.real-flow", version: 1 };
    await content.command(author, {
      ...identity,
      action: "create",
      problemVersionId,
      mode: "learn",
      maximumAssistanceTier: 4,
      referenceId: ref,
      relation: "same_pattern",
      rationale: "Original internal preparation followed by an independent provider solve.",
      questions: CONTAINER_EXTERNAL_QUESTIONS,
    });
    await expect(
      content.command(publisher, { ...identity, action: "publish" }),
    ).rejects.toMatchObject({ code: "23514" });
    await content.command(technical, { ...identity, action: "technical_review" });
    await content.command(pedagogical, { ...identity, action: "pedagogical_review" });
    await content.command(publisher, { ...identity, action: "publish" });
    const attempt = (
      await runtime.query<{ attempt_id: string; manifest_id: string }>(
        "SELECT attempt_id,manifest_id FROM practice.attempt WHERE learner_id=$1 AND mode='learn' AND status='active'",
        [learnerId],
      )
    ).rows[0]!;
    const attemptId = must(parseId("attempt", attempt.attempt_id));
    const source = "readiness fixture source";
    await runtime.query("UPDATE practice.draft SET current_text=$2 WHERE attempt_id=$1", [
      attemptId,
      source,
    ]);
    await runtime.query(
      "UPDATE practice.pseudocode_artifact SET saved_revision=current_revision WHERE attempt_id=$1",
      [attemptId],
    );
    await runtime.query(
      `INSERT INTO practice.pseudocode_revision(pseudocode_id,learner_id,attempt_id,problem_version_id,manifest_id,language,revision,fields,saved_at) SELECT pseudocode_id,learner_id,attempt_id,problem_version_id,manifest_id,language,current_revision,current_fields,now() FROM practice.pseudocode_artifact WHERE attempt_id=$1 ON CONFLICT DO NOTHING`,
      [attemptId],
    );
    const publicView = await companion.view(attemptId, learnerId);
    expect(publicView.questions).toHaveLength(5);
    expect(JSON.stringify(publicView.questions)).not.toContain('"answer":');
    expect(publicView.reference?.url).toBeNull();
    const selections = Object.fromEntries(
      CONTAINER_EXTERNAL_QUESTIONS.map((q) => [q.id, q.answer]),
    );
    const grade = () =>
      companion.grade({
        attemptId,
        learnerId,
        answers: selections,
        now: context().now,
        nextId: () => ids.generate("event"),
      });
    expect((await grade()).decision.status).toBe("not_ready");
    const assessedAt = must(parseInstant("2026-11-01T10:00:00.000Z"));
    const assessmentContext = { ...context(), now: assessedAt };
    const requested = await requestPracticeCodeRun(assessmentContext, practice, relay, {
      attemptId,
      mode: "submit",
      source,
      sourceChecksum: sha256Digest(source),
      sourceLength: Buffer.byteLength(source),
    });
    const receipt = await ingestTrustedPracticeResult(assessmentContext, practice, {
      result: {
        resultId: `result-${requested.run.runId}`,
        runId: requested.run.runId,
        attemptId,
        problemVersionId,
        manifestId: requested.run.manifestId,
        language: "python",
        sourceChecksum: requested.run.sourceChecksum,
        terminalCategory: "pass",
        classification: "success",
        descriptorDigest: sha256Digest("descriptor"),
        replayId: requested.run.runId,
        leaseEpoch: 1,
        completedAt: assessedAt,
      },
    });
    expect((await grade()).decision.status).toBe("ready");
    const bypass = await evaluateOwnedExternalReadiness(
      context(),
      new PostgresExternalReadinessRepository(runtime),
      { attemptId, bypassRequested: true },
    );
    expect(bypass.status).toBe("not_ready");
    expect(bypass.bypassAvailable).toBe(false);
    expect(bypass.reasons).toContainEqual({
      code: "bypass_disabled",
      message: "Complete internal preparation before external practice.",
    });
    // Restore available review content using a new test-only published revision;
    // earlier withdrawal tests intentionally retired the original exercises.
    await runtime.query(
      `INSERT INTO content.review_exercise(exercise_id,concept_id,kind,problem_version_id,title,questions,author_id,technical_reviewer_id,pedagogical_reviewer_id,publisher_id,status)
       SELECT 'companion-reasoning-v1',concept_id,kind,problem_version_id,'Companion delayed reasoning',questions,author_id,technical_reviewer_id,pedagogical_reviewer_id,publisher_id,'published'
       FROM content.review_exercise WHERE exercise_id='container-reasoning-v1'`,
    );
    if (!receipt.observation) throw Error("Companion assessment observation missing");
    const sourceEvent = await runtime.query<{ event_id: string }>(
      "SELECT event_id FROM platform.outbox_event WHERE topic='practice.assessment.observed' AND payload->>'observationId'=$1",
      [receipt.observation.observationId],
    );
    await consumePracticeAssessment(
      { now: assessedAt, ids },
      ports,
      must(parseId("event", sourceEvent.rows[0]?.event_id)),
    );
    const reviewAt = must(parseInstant("2026-11-15T10:00:00.000Z"));
    const scheduled = (await reviews.listReviews({ learnerId, now: reviewAt })).find(
      (item) => item.originObservationId === receipt.observation!.observationId,
    );
    expect(scheduled).toMatchObject({
      status: "due",
      timing: "overdue",
      exercise: { exerciseId: "companion-reasoning-v1" },
    });
    expect(JSON.stringify(scheduled)).not.toContain('"answer":');
    expect(
      (
        await runtime.query(
          "SELECT origin_attempt_id FROM mastery.review_item WHERE review_id=$1",
          [scheduled?.reviewId],
        )
      ).rows[0]?.origin_attempt_id,
    ).toBe(attemptId);

    const command = {
      attemptId,
      learnerId,
      action: "open" as const,
      idempotencyKey: "companion-open-once",
      now: context().now,
      eventId: ids.generate("event"),
    };
    expect((await companion.command(command)).url).toBe(
      "https://leetcode.com/problems/container-with-most-water",
    );
    await companion.command({ ...command, eventId: ids.generate("event") });
    expect(
      (
        await runtime.query(
          "SELECT 1 FROM practice.external_practice_event WHERE idempotency_key='companion-open-once'",
        )
      ).rowCount,
    ).toBe(1);
    await expect(
      companion.command({ ...command, action: "completed", eventId: ids.generate("event") }),
    ).rejects.toMatchObject({ code: "version_conflict" });
    const before = await progress.getProgress({ learnerId, now: context().now });
    await companion.command({
      ...command,
      action: "completed",
      idempotencyKey: "companion-completion",
      now: context().now,
      eventId: ids.generate("event"),
    });
    const report = await progress.getProgress({ learnerId, now: context().now });
    expect(report.externalPractice.completed).toBe(before.externalPractice.completed + 1);
    expect(report.mastery).toEqual(before.mastery);
    expect(report.activities).toEqual(before.activities);
    expect(report.reviewHealth).toEqual(before.reviewHealth);
    await companion.command({
      ...command,
      idempotencyKey: "companion-reopen",
      now: context().now,
      eventId: ids.generate("event"),
    });
    expect(
      (await progress.getProgress({ learnerId, now: context().now })).externalPractice.completed,
    ).toBe(report.externalPractice.completed);
    await content.command(technical, {
      action: "review_reference",
      referenceId: ref,
      status: "blocked",
    });
    await expect(
      companion.command({
        ...command,
        idempotencyKey: "companion-blocked",
        eventId: ids.generate("event"),
      }),
    ).rejects.toMatchObject({ code: "invalid_request" });
    await companion.command({
      ...command,
      action: "corrected",
      idempotencyKey: "companion-correction",
      now: context().now,
      eventId: ids.generate("event"),
    });
    expect((await companion.view(attemptId, learnerId)).journal).toBe("corrected");
    expect(
      (await reviews.listReviews({ learnerId, now: reviewAt })).find(
        (item) => item.reviewId === scheduled?.reviewId,
      ),
    ).toEqual(scheduled);
    // Render the same assessment-derived queue after external confirmation and
    // correction. Only HTTP/auth transport is a seam; queue data comes from SQL.
    const server = spawn(
      process.execPath,
      [
        resolve("apps/web/node_modules/next/dist/bin/next"),
        "dev",
        "--hostname",
        "127.0.0.1",
        "--port",
        "3198",
      ],
      {
        cwd: resolve("apps/web"),
        stdio: "pipe",
        env: {
          ...process.env,
          ALGOCOVE_TEST_DIST_DIR: ".next/integration-phase6",
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
          CLERK_SECRET_KEY: "",
        },
      },
    );
    server.stdout.on("data", () => undefined);
    server.stderr.on("data", () => undefined);
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    try {
      browser = await chromium.launch();
      let available = false;
      for (let n = 0; n < 60 && !available; n++) {
        available = await fetch("http://127.0.0.1:3198/api/health")
          .then((r) => r.ok)
          .catch(() => false);
        if (!available) await new Promise((r) => setTimeout(r, 100));
      }
      expect(available).toBe(true);
      const page = await browser.newPage();
      await page.route("**/api/auth/session", (r) =>
        r.fulfill({
          json: {
            authenticated: true,
            user: { id: learnerId, roles: ["learner"] },
          },
        }),
      );
      await page.route("**/api/review", async (r) =>
        r.fulfill({
          json: {
            reviews: await reviews.listReviews({ learnerId, now: reviewAt }),
            asOf: reviewAt,
            policyVersion: 1,
          },
        }),
      );
      await page.goto("http://127.0.0.1:3198/review");
      await browserExpect(
        page.getByRole("heading", { name: "Companion delayed reasoning" }),
      ).toBeVisible();
      const card = page
        .locator("article")
        .filter({ has: page.getByRole("heading", { name: "Companion delayed reasoning" }) });
      await browserExpect(card.getByText("Overdue · catch up when ready")).toBeVisible();
      await browserExpect(
        card.getByText("Which expression measures a container's area?"),
      ).toBeVisible();
    } finally {
      await browser?.close();
      server.kill("SIGTERM");
      await new Promise<void>((done) => {
        if (server.exitCode !== null) done();
        else server.once("exit", () => done());
      });
    }
    await content.command(technical, {
      action: "review_reference",
      referenceId: ref,
      status: "reviewed",
    });
    await runtime.query("UPDATE practice.draft SET current_text='edited' WHERE attempt_id=$1", [
      attemptId,
    ]);
    await expect(
      companion.command({
        ...command,
        idempotencyKey: "companion-stale",
        eventId: ids.generate("event"),
      }),
    ).rejects.toMatchObject({ code: "invalid_request" });
    await expect(
      companion.command({
        ...command,
        learnerId: must(formatId("learner", "9999999999999999")),
        eventId: ids.generate("event"),
      }),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      progress.recordExternal({
        learnerId,
        referenceId: must(parseId("externalReference", ref)),
        kind: "handoff_requested",
        idempotencyKey: "legacy-bypass-blocked",
        eventId: ids.generate("event"),
        now: context().now,
      }),
    ).rejects.toMatchObject({ code: "invalid_request" });
  });
});
