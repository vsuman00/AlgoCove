import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  consumePracticeAssessment,
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
  PostgresMasteryConceptSource,
  PostgresMasteryRepository,
  PostgresOutboxRelayRepository,
  PostgresPracticeRepository,
} from "@algocove/db";
import {
  formatId,
  MASTERY_POLICY_V1,
  parseId,
  parseInstant,
  parseMasteryEvidence,
  type ProblemLanguage,
  type Result,
} from "@algocove/domain";
import { sha256Digest } from "@algocove/execution-contracts";
import { MasteryOutboxRelay } from "../../apps/worker/src/mastery-relay.ts";

function must<T>(result: Result<T, unknown>): T {
  if (!result.ok) throw new Error("Invalid mastery integration fixture");
  return result.value;
}
const suffix = `${process.pid}_${Date.now()}`;
const databaseName = `algocove_mastery_${suffix}`;
const migrationRole = `algocove_mastery_mig_${suffix}`;
const runtimeRole = `algocove_mastery_run_${suffix}`;
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

describe("PostgreSQL mastery evidence and replay", () => {
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
  let second: Awaited<ReturnType<typeof submit>>;
  it("snapshots assistance, reports pending, and commits concurrent duplicate delivery once", async () => {
    first = await submit("python");
    expect(first.observation).toMatchObject({ assistanceTier: 0, passed: true });
    expect(first.observation.assistanceCapturedAt).not.toBeNull();
    expect(
      await mastery.readView({
        learnerId,
        conceptId,
        policyVersion: 1,
        afterObservationId: first.observation.observationId,
      }),
    ).toMatchObject({ status: "projection_pending", projection: { band: "unassessed" } });
    const results = await Promise.all([
      consumePracticeAssessment({ now: context().now, ids }, ports, first.eventId),
      consumePracticeAssessment({ now: context().now, ids }, ports, first.eventId),
    ]);
    expect(results.map((r) => r.disposition).sort()).toEqual(["committed", "replayed"]);
    expect(results[0]?.projections).toEqual(results[1]?.projections);
    expect((await runtime.query("SELECT * FROM mastery.evidence")).rowCount).toBe(1);
    expect(
      (
        await runtime.query(
          "SELECT * FROM platform.outbox_event WHERE topic='mastery.projection.updated'",
        )
      ).rowCount,
    ).toBe(1);
    const delivery = new MasteryOutboxRelay(new PostgresOutboxRelayRepository(runtime), ports, {
      relayId: "mastery-integration",
      clock: createFixedClock(must(parseInstant("2030-01-01T00:00:00Z"))),
      ids,
    });
    expect(await delivery.pumpOnce()).toMatchObject({ kind: "delivered", eventId: first.eventId });
    expect(await delivery.pumpOnce()).toEqual({ kind: "idle" });
    expect(
      await mastery.readView({
        learnerId,
        conceptId,
        policyVersion: 1,
        afterObservationId: first.observation.observationId,
      }),
    ).toMatchObject({
      status: "ready",
      projection: { band: "independent_completion", evidenceCount: 1 },
    });
    expect(
      await mastery.readView({
        learnerId: must(formatId("learner", "aaaaaaaaaaaaaaaa")),
        conceptId,
        policyVersion: 1,
        afterObservationId: first.observation.observationId,
      }),
    ).toBeNull();
    expect(
      await mastery.readView({
        learnerId,
        conceptId: must(formatId("concept", "bbbbbbbbbbbbbbbb")),
        policyVersion: 1,
      }),
    ).toBeNull();
  });

  it("rebuilds an empty read model and compares policies without rewriting facts", async () => {
    const before = (await mastery.readView({ learnerId, conceptId, policyVersion: 1 }))!;
    const ledgerBefore = (
      await runtime.query("SELECT facts FROM mastery.evidence ORDER BY observation_id")
    ).rows;
    await runtime.query("DELETE FROM mastery.projection WHERE learner_id=$1", [learnerId]);
    expect(await mastery.readView({ learnerId, conceptId, policyVersion: 1 })).toMatchObject({
      status: "projection_pending",
    });
    const rebuilt = await mastery.rebuild({ learnerId, conceptId, policy: MASTERY_POLICY_V1 });
    expect(rebuilt).toEqual(before.projection);
    const alternate = await mastery.rebuild({
      learnerId,
      conceptId,
      policy: { version: 2, requireValidatedExplanation: true },
    });
    expect(alternate).toMatchObject({
      band: "completion_unclassified",
      evidenceWatermark: rebuilt.evidenceWatermark,
    });
    expect(alternate.reasonCodes).toContain("validated_explanation_required");
    expect(
      (await mastery.readView({ learnerId, conceptId, policyVersion: 1 }))?.projection,
    ).toEqual(rebuilt);
    expect(
      (await runtime.query("SELECT facts FROM mastery.evidence ORDER BY observation_id")).rows,
    ).toEqual(ledgerBefore);
    await expect(
      mastery.rebuild({
        learnerId,
        conceptId,
        policy: { version: 2, requireValidatedExplanation: false },
      }),
    ).rejects.toMatchObject({ code: "version_conflict" });
    const cli = execFileSync(
      process.execPath,
      ["apps/worker/src/mastery-cli.ts", "rebuild", learnerId, conceptId],
      { env: { ...process.env, DATABASE_ADMIN_URL: targetUrl.toString() }, encoding: "utf8" },
    );
    expect(JSON.parse(cli)).toEqual(rebuilt);
  });

  it("carries persisted strategy disclosure across languages without changing earlier observations", async () => {
    second = await submit("javascript", true);
    expect(second.observation.assistanceTier).toBe(4);
    expect((await practice.loadAssessment(first.eventId))?.observation.assistanceTier).toBe(0);
    const consumed = await consumePracticeAssessment(
      { now: context().now, ids },
      ports,
      second.eventId,
    );
    expect(consumed.projections[0]).toMatchObject({
      band: "assisted_completion",
      languageProficiency: { python: { observedPasses: 1 }, javascript: { observedPasses: 1 } },
    });
    expect(consumed.projections[0]?.reasonCodes).toContain("strategy_disclosed");
    const third = await submit("python");
    expect(third.observation.assistanceTier).toBe(4);
    // The real CLI consumes the remaining committed events and acknowledges them.
    const output = execFileSync(
      process.execPath,
      ["apps/worker/src/mastery-cli.ts", "consume", "--limit=10"],
      { env: { ...process.env, DATABASE_URL: runtimeUrl.toString() }, encoding: "utf8" },
    );
    expect(output).toContain('"kind":"delivered"');
    expect(output).toContain('"kind":"idle"');
    expect((await runtime.query("SELECT * FROM mastery.evidence")).rowCount).toBe(3);
  });

  it("rolls back evidence and projection if the transactional outbox write fails", async () => {
    const next = await submit("javascript");
    const stored = (await runtime.query("SELECT facts FROM mastery.evidence LIMIT 1")).rows[0]
      ?.facts;
    const evidence = must(
      parseMasteryEvidence({
        ...stored,
        sourceEventId: next.eventId,
        observationId: next.observation.observationId,
        attemptId: next.observation.attemptId,
        language: next.observation.language,
        observedAt: next.observation.observedAt,
        assistanceTier: next.observation.assistanceTier,
      }),
    );
    const before = (await mastery.readView({ learnerId, conceptId, policyVersion: 1 }))!.projection;
    await expect(
      mastery.recordAndProject({
        evidence: [evidence],
        policy: MASTERY_POLICY_V1,
        ingestedAt: context().now,
        updateEventIds: [first.eventId],
      }),
    ).rejects.toMatchObject({ code: "23505" });
    expect(
      (
        await runtime.query("SELECT * FROM mastery.evidence WHERE observation_id=$1", [
          next.observation.observationId,
        ])
      ).rowCount,
    ).toBe(0);
    expect(
      (await mastery.readView({ learnerId, conceptId, policyVersion: 1 }))?.projection,
    ).toEqual(before);
    expect(
      (await consumePracticeAssessment({ now: context().now, ids }, ports, next.eventId))
        .disposition,
    ).toBe("committed");
  });

  it("rejects historical rewrites while allowing source privacy deletion to cascade", async () => {
    for (const query of [
      "UPDATE mastery.evidence SET facts=facts",
      "DELETE FROM mastery.evidence",
      "UPDATE mastery.policy_version SET require_validated_explanation=true WHERE policy_version=1",
      "UPDATE practice.assessment_observation SET passed=passed",
    ])
      await expect(runtime.query(query)).rejects.toMatchObject({ code: "55006" });
    await runtime.query("DELETE FROM practice.assessment_observation WHERE observation_id=$1", [
      second.observation.observationId,
    ]);
    expect(
      (
        await runtime.query("SELECT * FROM mastery.evidence WHERE observation_id=$1", [
          second.observation.observationId,
        ])
      ).rowCount,
    ).toBe(0);
    expect(await mastery.readView({ learnerId, conceptId, policyVersion: 1 })).toMatchObject({
      status: "projection_pending",
    });
    const rebuilt = await mastery.rebuild({ learnerId, conceptId, policy: MASTERY_POLICY_V1 });
    expect(rebuilt.evidenceCount).toBe(3);
  });

  it("retries a lost acknowledgement without duplicate effects and persists terminal dead letters", async () => {
    const outbox = new PostgresOutboxRelayRepository(runtime);
    let loseAcknowledgement = true;
    let relayNow = must(parseInstant("2030-01-01T00:00:00.000Z"));
    const delivery = new MasteryOutboxRelay(
      {
        claimNext: outbox.claimNext.bind(outbox),
        retry: outbox.retry.bind(outbox),
        deadLetter: outbox.deadLetter.bind(outbox),
        acknowledge: async (input) => {
          if (loseAcknowledgement) {
            loseAcknowledgement = false;
            throw new Error("lost acknowledgement");
          }
          await outbox.acknowledge(input);
        },
      },
      ports,
      { relayId: "mastery-lost-ack", clock: { now: () => relayNow }, ids, maxAttempts: 2 },
    );
    const ledger = (
      await runtime.query("SELECT facts FROM mastery.evidence ORDER BY observation_id")
    ).rows;
    const events = (
      await runtime.query(
        "SELECT event_id FROM platform.outbox_event WHERE topic='mastery.projection.updated' ORDER BY event_id",
      )
    ).rows;
    expect(await delivery.pumpOnce()).toMatchObject({ kind: "retried" });
    expect(await delivery.pumpOnce()).toEqual({ kind: "idle" });
    relayNow = must(parseInstant("2030-01-01T00:00:02.000Z"));
    expect(await delivery.pumpOnce()).toMatchObject({ kind: "delivered" });
    expect(
      (await runtime.query("SELECT facts FROM mastery.evidence ORDER BY observation_id")).rows,
    ).toEqual(ledger);
    expect(
      (
        await runtime.query(
          "SELECT event_id FROM platform.outbox_event WHERE topic='mastery.projection.updated' ORDER BY event_id",
        )
      ).rows,
    ).toEqual(events);
    const missingSource = ids.generate("event");
    await runtime.query(
      "INSERT INTO platform.outbox_event(event_id,topic,aggregate_id,payload,occurred_at) VALUES ($1,'practice.assessment.observed',$2,'{}',now())",
      [missingSource, conceptId],
    );
    expect(await delivery.pumpOnce()).toMatchObject({ kind: "retried", eventId: missingSource });
    relayNow = must(parseInstant("2030-01-01T00:00:04.000Z"));
    expect(await delivery.pumpOnce()).toMatchObject({
      kind: "dead_lettered",
      eventId: missingSource,
    });
    expect(
      (
        await runtime.query(
          "SELECT dead_letter_reason,claimed_by FROM platform.outbox_event WHERE event_id=$1",
          [missingSource],
        )
      ).rows[0],
    ).toEqual({ dead_letter_reason: "retry_exhausted", claimed_by: null });
    expect(await delivery.pumpOnce()).toEqual({ kind: "idle" });
  });
});
