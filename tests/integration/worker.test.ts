import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createActor,
  createRequestContext,
  startPracticeSession,
  startPracticeAttempt,
  revealAuthoredHint,
  type IdGenerator,
  type RequestContext,
} from "@algocove/application";
import { parseInstant, formatId, parseId } from "@algocove/domain";
import {
  createPool,
  bootstrapDatabase,
  bootstrapWorkerRole,
  migrate,
  PostgresOutboxRelayRepository,
  PostgresWorkerOperationsRepository,
  PostgresWorkerEffectsRepository,
  PostgresPracticeRepository,
  PostgresHintRepository,
  withTransaction,
  type ClaimedOutboxEvent,
  type OutboxRelayRepository,
} from "@algocove/db";
import { createWorkerJobHandlers } from "../../apps/worker/src/job-handlers.ts";
import { WorkerJobRelay } from "../../apps/worker/src/job-relay.ts";

const suffix = `${process.pid}_${Date.now()}`,
  database = `algocove_worker_${suffix}`;
const operatorUrl = new URL(
  process.env.DATABASE_TEST_OPERATOR_URL ??
    process.env.DATABASE_ADMIN_URL ??
    "postgres://postgres:postgres@127.0.0.1:54329/postgres",
);
operatorUrl.pathname = "/postgres";
const target = new URL(operatorUrl);
target.pathname = `/${database}`;
const migrationRole = `worker_mig_${suffix}`,
  runtimeRole = `worker_run_${suffix}`;
const scopedRole = `worker_scoped_${suffix}`,
  scopedUrl = new URL(target);
scopedUrl.username = scopedRole;
scopedUrl.password = randomUUID();
const migrationUrl = new URL(target);
migrationUrl.username = migrationRole;
migrationUrl.password = randomUUID();
const runtimeUrl = new URL(target);
runtimeUrl.username = runtimeRole;
runtimeUrl.password = randomUUID();
const pool = (url: URL, name: string) =>
  createPool({
    connectionString: url.toString(),
    applicationName: name,
    maxConnections: 4,
    statementTimeoutMs: 5000,
  });
const admin = pool(operatorUrl, "worker-test-operator"),
  runtime = pool(runtimeUrl, "worker-test-runtime");
const scoped = pool(scopedUrl, "worker-test-scoped");
const outbox = new PostgresOutboxRelayRepository(runtime),
  effects = new PostgresWorkerEffectsRepository(runtime),
  operations = new PostgresWorkerOperationsRepository(runtime);
const parsed = parseInstant("2026-10-06T10:00:00.000Z");
if (!parsed.ok) throw Error();
let now = parsed.value;
const clock = { now: () => now };
let entropy = 5000;
const ids: IdGenerator = {
  generate(kind) {
    const value = formatId(kind, String(entropy++).padStart(16, "0"));
    if (!value.ok) throw Error("Invalid fixture ID");
    return value.value;
  },
};
const actorId = "usr_0000000000000001",
  learnerId = "usr_0000000000000002";
function context(learner = false): RequestContext {
  return createRequestContext({
    actor: createActor({
      userId: learner ? learnerId : actorId,
      sessionId: "ses_0000000000000001",
      roles: learner ? ["learner"] : ["operator", "privacy_administrator", "learner"],
    }),
    clock,
    ids,
    serviceName: "worker-test",
  });
}
function advance(ms = 2000): void {
  const value = parseInstant(new Date(Date.parse(now) + ms));
  if (!value.ok) throw Error();
  now = value.value;
}
async function enqueue(
  topic = "evaluation.requested",
  payload: unknown = {
    schemaVersion: 1,
    configurationId: "fixture.config",
    suiteVersion: "fixture.suite",
  },
): Promise<string> {
  const eventId = ids.generate("event");
  await runtime.query(
    "INSERT INTO platform.outbox_event(event_id,topic,aggregate_id,payload,occurred_at,available_at) VALUES($1,$2,'fixture',$3::jsonb,$4,$4)",
    [eventId, topic, JSON.stringify(payload), now],
  );
  return eventId;
}
function relay(repo: OutboxRelayRepository = outbox, fail = false, relayId = "worker-fixture") {
  return new WorkerJobRelay(
    repo,
    createWorkerJobHandlers({
      effects,
      relayId,
      clock,
      enableRetention: true,
      modules: {
        "evaluation.requested": {
          consume: async ({ event }) => {
            if (fail) throw Error("controlled failure");
            await effects.apply(event, relayId, "fixture.evaluation.v1", now, async (tx) => {
              await tx.query(
                "INSERT INTO platform.audit_event(event_id,action,resource_type,resource_id,occurred_at) VALUES($1,'fixture.effect','worker_event',$1,$2)",
                [event.eventId, now],
              );
              return { evaluations: 1 };
            });
          },
        },
      },
    }),
    { relayId, clock, leaseMs: 1000, retryBaseMs: 1, maxAttempts: 2 },
  );
}
async function claimed(
  eventId: string,
  topic = "evaluation.requested",
  relayId = "worker-fixture",
): Promise<ClaimedOutboxEvent> {
  const event = await outbox.claimNext({ topic, relayId, now, leaseDurationMs: 1000 });
  expect(event?.eventId).toBe(eventId);
  return event!;
}

describe("Task 41 PostgreSQL worker durability and operations", () => {
  beforeAll(async () => {
    admin.on("error", () => undefined);
    runtime.on("error", () => undefined);
    scoped.on("error", () => undefined);
    await admin.query(`CREATE DATABASE "${database}"`);
    await bootstrapDatabase({
      operatorConnectionString: target.toString(),
      migrationRole: { name: migrationRole, password: migrationUrl.password },
      runtimeRole: { name: runtimeRole, password: runtimeUrl.password },
      logger: { info: () => undefined },
    });
    await migrate({ connectionString: migrationUrl.toString(), logger: { info: () => undefined } });
    await bootstrapWorkerRole({
      operatorConnectionString: target.toString(),
      name: scopedRole,
      password: scopedUrl.password,
    });
    execFileSync(process.execPath, ["packages/db/src/cli/seed-practice.ts"], {
      env: { ...process.env, DATABASE_ADMIN_URL: target.toString() },
      stdio: "pipe",
    });
    // Seed publication uses database wall time. Keep the simulated worker clock
    // at or after publication even when this suite runs later than its fixed date.
    const seeded = (
      await runtime.query<{ published_at: Date }>(
        "SELECT max(published_at) AS published_at FROM content.content_version",
      )
    ).rows[0]!.published_at;
    const aligned = parseInstant(new Date(Math.max(Date.parse(now), seeded.getTime()) + 1000));
    if (!aligned.ok) throw Error("Invalid fixture clock");
    now = aligned.value;
    await runtime.query("INSERT INTO platform.learner(learner_id) VALUES($1),($2)", [
      actorId,
      learnerId,
    ]);
    await runtime.query(
      "INSERT INTO platform.role_grant(learner_id,role) VALUES($1,'operator'),($1,'privacy_administrator'),($1,'learner'),($2,'learner')",
      [actorId, learnerId],
    );
  });
  afterAll(async () => {
    await runtime.end();
    await scoped.end();
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH(FORCE)`);
    await admin.query(`DROP ROLE IF EXISTS "${migrationRole}"`);
    await admin.query(`DROP ROLE IF EXISTS "${runtimeRole}"`);
    await admin.query(`DROP ROLE IF EXISTS "${scopedRole}"`);
    await admin.end();
  });
  it("enforces active operational roles and excludes raw payloads from inspection", async () => {
    await expect(operations.inspect(context(true))).rejects.toMatchObject({ code: "forbidden" });
    const forged = {
      ...context(),
      actor: createActor({
        userId: learnerId,
        sessionId: "ses_0000000000000001",
        roles: ["operator"],
      }),
    };
    await expect(operations.inspect(forged)).rejects.toMatchObject({ code: "forbidden" });
    const practice = new PostgresPracticeRepository(runtime);
    const problemId = parseId("problemVersion", "prb_dddddddddddddddd");
    const manifestId = parseId("languageManifest", "man_aaaaaaaaaaaaaaaa");
    if (!problemId.ok || !manifestId.ok) throw Error("Invalid published fixture");
    expect(await practice.getPublishedProblem(problemId.value)).not.toBeNull();
    const session = await startPracticeSession(context(), practice, "learn");
    const attempt = await startPracticeAttempt(context(), practice, {
      sessionId: session.sessionId,
      problemVersionId: problemId.value,
      manifestId: manifestId.value,
      language: "python",
    });
    const hint = await revealAuthoredHint(context(), new PostgresHintRepository(runtime), {
      attemptId: attempt.attemptId,
      hintId: "hint-arrays-1",
      requestedTier: 1,
      idempotencyKey: "worker-offline-authored-hint",
    });
    expect(hint.hint.body.length).toBeGreaterThan(0);
    const output = execFileSync(
      process.execPath,
      ["apps/worker/src/main.ts", "inspect", actorId, "10"],
      {
        env: { ...process.env, WORKER_OPERATIONS_DATABASE_URL: runtimeUrl.toString() },
        encoding: "utf8",
      },
    );
    expect(JSON.parse(output)).toHaveProperty("queue");
    expect(output).not.toContain(runtimeUrl.password);
    const report = await operations.inspect(context());
    expect(JSON.stringify(report)).not.toContain("payload");
    await expect(
      operations.enqueue(context(), "evaluation.requested", {
        schemaVersion: 1,
        configurationId: "v1",
        suiteVersion: "v1",
      }),
    ).rejects.toMatchObject({ code: "invalid_request" });
  });
  it("dedicated worker credentials cannot read private source or expand grants", async () => {
    for (const query of [
      "SELECT current_text FROM practice.draft",
      "SELECT text FROM practice.draft_revision",
      "SELECT statement FROM content.problem_version",
      "SELECT role FROM platform.role_grant",
      "CREATE TABLE platform.worker_unauthorized(n integer)",
    ])
      await expect(scoped.query(query)).rejects.toMatchObject({ code: "42501" });
    const id = await operations.enqueue(context(), "platform.reconciliation.requested", {
      schemaVersion: 1,
      scope: "outbox_and_derivations",
      limit: 10,
    });
    const registry = createWorkerJobHandlers({
      effects: new PostgresWorkerEffectsRepository(scoped),
      relayId: "scoped",
      clock,
    });
    expect(
      await new WorkerJobRelay(new PostgresOutboxRelayRepository(scoped), registry, {
        relayId: "scoped",
        clock,
      }).pumpOnce(),
    ).toMatchObject({ kind: "delivered", eventId: id });
    const cliId = await operations.enqueue(context(), "platform.reconciliation.requested", {
      schemaVersion: 1,
      scope: "outbox_and_derivations",
      limit: 10,
    });
    await runtime.query(
      "UPDATE platform.outbox_event SET available_at=now()-interval '1 second' WHERE event_id=$1",
      [cliId],
    );
    const output = execFileSync(process.execPath, ["apps/worker/src/main.ts", "consume", "1"], {
      encoding: "utf8",
      env: {
        ...process.env,
        WORKER_DATABASE_URL: scopedUrl.toString(),
        WORKER_RETENTION_ENABLED: "false",
      },
    });
    expect(JSON.parse(output)).toMatchObject({ kind: "delivered", eventId: cliId });
    expect(output).not.toContain(scopedUrl.password);
  });
  it("commits one effect after crash before acknowledgement and duplicate delivery", async () => {
    const id = await enqueue();
    const repo: OutboxRelayRepository = {
      claimNext: outbox.claimNext.bind(outbox),
      acknowledge: vi.fn().mockRejectedValueOnce(Error("lost ack")),
      retry: outbox.retry.bind(outbox),
      deadLetter: outbox.deadLetter.bind(outbox),
    };
    await expect(relay(repo).pumpOnce()).rejects.toThrow("lost ack");
    expect(
      (await runtime.query("SELECT 1 FROM platform.worker_effect_receipt WHERE event_id=$1", [id]))
        .rowCount,
    ).toBe(1);
    advance();
    expect(await relay().pumpOnce()).toMatchObject({ kind: "delivered", eventId: id, attempts: 2 });
    expect(
      (
        await runtime.query(
          "SELECT 1 FROM platform.audit_event WHERE action='fixture.effect' AND resource_id=$1",
          [id],
        )
      ).rowCount,
    ).toBe(1);
    await expect(
      runtime.query("DELETE FROM platform.worker_effect_receipt WHERE event_id=$1", [id]),
    ).rejects.toMatchObject({ code: "55006" });
  });
  it("rolls effects and receipts back together and bounds database work", async () => {
    const id = await enqueue(),
      event = await claimed(id);
    await expect(
      effects.apply(event, "worker-fixture", "fixture.rollback.v1", now, async (tx) => {
        await tx.query(
          "INSERT INTO platform.audit_event(event_id,action,resource_type,resource_id) VALUES($1,'fixture.rollback','worker_event',$1)",
          [id],
        );
        throw Error("crash before commit");
      }),
    ).rejects.toThrow("crash before commit");
    expect(
      (await runtime.query("SELECT 1 FROM platform.audit_event WHERE resource_id=$1", [id]))
        .rowCount,
    ).toBe(0);
    expect(
      (await runtime.query("SELECT 1 FROM platform.worker_effect_receipt WHERE event_id=$1", [id]))
        .rowCount,
    ).toBe(0);
    await expect(
      withTransaction(runtime, async (tx) => tx.query("SELECT pg_sleep(0.05)"), {
        statementTimeoutMs: 1,
      }),
    ).rejects.toMatchObject({ code: "57014" });
    await outbox.acknowledge({
      eventId: id,
      relayId: "worker-fixture",
      expectedAttempts: event.attempts,
    });
  });
  it("fences stale claims even when the relay identity is reused", async () => {
    const id = await enqueue(),
      old = await claimed(id);
    advance();
    const current = await claimed(id);
    for (const action of [
      () =>
        outbox.acknowledge({
          eventId: id,
          relayId: "worker-fixture",
          expectedAttempts: old.attempts,
        }),
      () =>
        outbox.retry({
          eventId: id,
          relayId: "worker-fixture",
          expectedAttempts: old.attempts,
          availableAt: now,
        }),
      () =>
        outbox.deadLetter({
          eventId: id,
          relayId: "worker-fixture",
          expectedAttempts: old.attempts,
          reason: "retry_exhausted",
        }),
      () =>
        effects.apply(old, "worker-fixture", "fixture.stale.v1", now, async () => ({ stale: 1 })),
      () =>
        effects.apply(
          {
            ...current,
            payload: { schemaVersion: 1, configurationId: "forged", suiteVersion: "v1" },
          },
          "worker-fixture",
          "fixture.forged.v1",
          now,
          async () => ({ forged: 1 }),
        ),
    ])
      await expect(action()).rejects.toThrow();
    await outbox.acknowledge({
      eventId: id,
      relayId: "worker-fixture",
      expectedAttempts: current.attempts,
    });
  });
  it("caps retry, exposes dead letters and safely replays with a fresh budget", async () => {
    const id = await enqueue();
    expect(await relay(outbox, true).pumpOnce()).toMatchObject({ kind: "retried" });
    advance();
    expect(await relay(outbox, true).pumpOnce()).toMatchObject({
      kind: "dead_lettered",
      reason: "retry_exhausted",
    });
    expect(JSON.stringify(await operations.inspect(context()))).toContain(id);
    await expect(
      operations.replay(context(), { eventId: id, expectedAttempts: 1, reason: "repair verified" }),
    ).rejects.toMatchObject({ code: "version_conflict" });
    await operations.replay(context(), {
      eventId: id,
      expectedAttempts: 2,
      reason: "repair verified",
    });
    expect(await relay(outbox, true).pumpOnce()).toMatchObject({ kind: "retried", attempts: 3 });
    advance();
    expect(await relay().pumpOnce()).toMatchObject({ kind: "delivered", eventId: id, attempts: 4 });
    expect(
      (
        await runtime.query(
          "SELECT attempts,replay_attempt_base FROM platform.outbox_event WHERE event_id=$1",
          [id],
        )
      ).rows[0],
    ).toEqual({ attempts: 4, replay_attempt_base: 2 });
    expect(
      (
        await runtime.query(
          "SELECT payload FROM platform.audit_event WHERE action='worker.job.replayed' AND resource_id=$1",
          [id],
        )
      ).rows[0]?.payload,
    ).toMatchObject({ reason: "repair verified", previousAttempts: 2 });
  });
  it("quarantines malformed descriptors and refuses unchanged poison replay", async () => {
    const id = await enqueue("evaluation.requested", {
      schemaVersion: 1,
      configurationId: "v1",
      suiteVersion: "v1",
      source: "private",
    });
    expect(await relay().pumpOnce()).toMatchObject({
      kind: "dead_lettered",
      reason: "invalid_source",
    });
    await expect(
      operations.replay(context(), { eventId: id, expectedAttempts: 1, reason: "repair verified" }),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(JSON.stringify(await operations.inspect(context()))).not.toContain("private");
  });
  it("registers work atomically and reconciles expired claims and incomplete derivations", async () => {
    const contentVersionId = "cnt_aaaaaaaaaaaaaaaa";
    const checksum = (
      await runtime.query<{ checksum: string }>(
        "SELECT checksum FROM content.content_version WHERE content_version_id=$1",
        [contentVersionId],
      )
    ).rows[0]!.checksum;
    const input = {
      contentVersionId,
      sourceChecksum: checksum,
      policyVersion: "fixture.chunk.v1",
      topic: "content.derivation.requested" as const,
    };
    const id = await operations.registerDerivation(context(), input);
    expect(await operations.registerDerivation(context(), input)).toBe(id);
    const derivation = await claimed(id, input.topic);
    await outbox.acknowledge({
      eventId: id,
      relayId: "worker-fixture",
      expectedAttempts: derivation.attempts,
    });
    const pending = await enqueue();
    await claimed(pending);
    advance();
    const eventId = await operations.enqueue(context(), "platform.reconciliation.requested", {
      schemaVersion: 1,
      scope: "outbox_and_derivations",
      limit: 10,
    });
    const registry = createWorkerJobHandlers({ effects, relayId: "maintenance", clock });
    expect(
      await new WorkerJobRelay(outbox, registry, { relayId: "maintenance", clock }).pumpOnce(),
    ).toMatchObject({ kind: "delivered", eventId });
    expect(
      (
        await runtime.query(
          "SELECT summary FROM platform.worker_effect_receipt WHERE event_id=$1",
          [eventId],
        )
      ).rows[0]?.summary,
    ).toMatchObject({ releasedClaims: 1, recoveredDeliveries: 1, incompleteDerivations: 1 });
    expect(
      (
        await runtime.query("SELECT published_at FROM platform.outbox_event WHERE event_id=$1", [
          id,
        ])
      ).rows[0]?.published_at,
    ).toBeNull();
    // An absent derivation consumer leaves required work pending, never ready.
    expect(
      await new WorkerJobRelay(outbox, registry, { relayId: "maintenance", clock }).pumpOnce(),
    ).toEqual({ kind: "idle" });
    await relay().pumpOnce();
    await runtime.query(
      "UPDATE content.content_version SET status='retired',retired_at=$2,retirement_reason='retired' WHERE content_version_id=$1",
      [contentVersionId, now],
    );
    await operations.enqueue(context(), "platform.reconciliation.requested", {
      schemaVersion: 1,
      scope: "outbox_and_derivations",
      limit: 10,
    });
    await new WorkerJobRelay(outbox, registry, { relayId: "maintenance", clock }).pumpOnce();
    expect(
      (
        await runtime.query(
          "SELECT state FROM platform.worker_derivation_expectation WHERE event_id=$1",
          [id],
        )
      ).rows[0]?.state,
    ).toBe("obsolete");
  });
  it("rechecks current content and blocks withdrawn inputs before module effects", async () => {
    const row = (
      await runtime.query<{ event_id: string }>(
        "SELECT event_id FROM platform.worker_derivation_expectation LIMIT 1",
      )
    ).rows[0]!;
    const consume = vi.fn(async () => undefined);
    const registry = createWorkerJobHandlers({
      effects,
      relayId: "withdrawn",
      clock,
      modules: { "content.derivation.requested": { consume } },
    });
    expect(
      await new WorkerJobRelay(outbox, registry, { relayId: "withdrawn", clock }).pumpOnce(),
    ).toMatchObject({ kind: "delivered", eventId: row.event_id });
    expect(consume).not.toHaveBeenCalled();
    expect(
      (
        await runtime.query(
          "SELECT summary FROM platform.worker_effect_receipt WHERE event_id=$1 AND handler_version='content.obsolete.v1'",
          [row.event_id],
        )
      ).rows[0]?.summary,
    ).toEqual({ obsolete: 1 });
  });
  it("retains unexpired learner drafts while expiring only existing TTL data", async () => {
    // Restore via a different published test fixture problem version is unnecessary:
    // attempts below predate operational content withdrawal and remain readable.
    const sessionId = "ses_0000000000000002",
      attemptId = "att_0000000000000002";
    await runtime.query(
      "INSERT INTO practice.learning_session(session_id,learner_id,mode,status,started_at,updated_at) VALUES($1,$2,'learn','active',$3,$3)",
      [sessionId, learnerId, now],
    );
    await runtime.query(
      "INSERT INTO practice.attempt(attempt_id,session_id,learner_id,problem_version_id,manifest_id,language,mode,status,started_at,updated_at) VALUES($1,$2,$3,'prb_dddddddddddddddd','man_aaaaaaaaaaaaaaaa','python','learn','active',$4,$4)",
      [attemptId, sessionId, learnerId, now],
    );
    const before = "2026-10-01T00:00:00Z",
      expired = "2026-10-02T00:00:00Z",
      future = "2026-12-01T00:00:00Z";
    for (const [draftId, kind, expiry] of [
      ["drf_0000000000000001", "source", expired],
      ["drf_0000000000000002", "pseudocode", future],
    ]) {
      await runtime.query(
        "INSERT INTO practice.draft(draft_id,attempt_id,learner_id,problem_version_id,manifest_id,language,kind,current_text,updated_at,expires_at) VALUES($1,$2,$3,'prb_dddddddddddddddd','man_aaaaaaaaaaaaaaaa','python',$4,'private recovery',$5,$6)",
        [draftId, attemptId, learnerId, kind, before, expiry],
      );
    }
    const id = await operations.enqueue(context(), "privacy.retention.requested", {
      schemaVersion: 1,
      scope: "expired_drafts",
      limit: 1,
    });
    const disabled = createWorkerJobHandlers({ effects, relayId: "retention", clock });
    expect(
      await new WorkerJobRelay(outbox, disabled, { relayId: "retention", clock }).pumpOnce(),
    ).toEqual({ kind: "idle" });
    const enabled = createWorkerJobHandlers({
      effects: new PostgresWorkerEffectsRepository(scoped),
      relayId: "retention",
      clock,
      enableRetention: true,
    });
    expect(
      await new WorkerJobRelay(new PostgresOutboxRelayRepository(scoped), enabled, {
        relayId: "retention",
        clock,
      }).pumpOnce(),
    ).toMatchObject({ kind: "delivered", eventId: id });
    expect(
      (await runtime.query("SELECT draft_id FROM practice.draft WHERE learner_id=$1", [learnerId]))
        .rows,
    ).toEqual([{ draft_id: "drf_0000000000000002" }]);
    expect(
      (await runtime.query("SELECT 1 FROM practice.attempt WHERE attempt_id=$1", [attemptId]))
        .rowCount,
    ).toBe(1);
    expect(
      JSON.stringify(
        (
          await runtime.query(
            "SELECT summary FROM platform.worker_effect_receipt WHERE event_id=$1",
            [id],
          )
        ).rows,
      ),
    ).not.toContain("private recovery");
  });
});
