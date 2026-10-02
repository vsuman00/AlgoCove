import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, it, expect } from "vitest";
import {
  bootstrapDatabase,
  createPool,
  migrate,
  PostgresRoadmapRepository,
  PostgresRoadmapIntentRepository,
  PostgresBudgetRepository,
  withTransaction,
  reserveOptional,
  PostgresProgressRepository,
} from "@algocove/db";
import {
  buildOwnedRoadmap,
  commandOwnedRoadmap,
  saveOwnedRoadmapIntent,
  createActor,
  createFixedClock,
  createRequestContext,
  type IdGenerator,
  type PlanCommand,
} from "@algocove/application";
import {
  formatId,
  parseInstant,
  BUDGET_POLICIES,
  type Result,
  type LearnerId,
  type Instant,
} from "@algocove/domain";
function must<T>(r: Result<T, unknown>): T {
  if (!r.ok) throw Error("fixture");
  return r.value;
}
const suffix = `${process.pid}_${Date.now()}`,
  dbName = `algocove_roadmap_${suffix}`,
  mig = `algocove_rm_mig_${suffix}`,
  run = `algocove_rm_run_${suffix}`;
const base = new URL(
  process.env.DATABASE_TEST_OPERATOR_URL ?? "postgres://postgres:postgres@127.0.0.1:54329/postgres",
);
base.pathname = "/postgres";
const target = new URL(base);
target.pathname = `/${dbName}`;
const migration = new URL(target);
migration.username = mig;
migration.password = randomUUID();
const runtimeUrl = new URL(target);
runtimeUrl.username = run;
runtimeUrl.password = randomUUID();
const operator = createPool({
    connectionString: base.toString(),
    applicationName: "roadmap-operator",
    maxConnections: 2,
    statementTimeoutMs: 5000,
  }),
  runtime = createPool({
    connectionString: runtimeUrl.toString(),
    applicationName: "roadmap-runtime",
    maxConnections: 6,
    statementTimeoutMs: 5000,
  });
const repository = new PostgresRoadmapRepository(runtime),
  intents = new PostgresRoadmapIntentRepository(runtime),
  budgets = new PostgresBudgetRepository(runtime);
let entropy = 2000,
  owner: LearnerId,
  now: Instant;
const ids: IdGenerator = {
  generate(kind) {
    return must(formatId(kind, String(entropy++).padStart(16, "0")));
  },
};
const context = (learner = owner, time = now) =>
  createRequestContext({
    actor: createActor({ userId: learner, sessionId: ids.generate("session"), roles: ["learner"] }),
    clock: createFixedClock(time),
    ids,
    serviceName: "roadmap-integration",
  });
const prefs = {
  goal: "Learn reviewed pilot",
  targetRole: "Engineer",
  horizonMonths: 1,
  startDay: "2026-10-02",
  timezone: "UTC",
  dailyCapacityMinutes: 90,
  studyWeekdays: [1, 2, 3, 4, 5],
  preferredLanguages: ["python"],
  collectionIds: [],
};
const build = (key = randomUUID(), token: string | null = null) =>
  buildOwnedRoadmap(context(), repository, {
    scope: "reviewed_pilot",
    expectedToken: token,
    idempotencyKey: key,
  });
async function accept() {
  const candidate = await build();
  expect(candidate.status).toBe("valid");
  return commandOwnedRoadmap(context(), repository, {
    action: "accept",
    candidateId: candidate.candidateId,
    expectedToken: null,
    idempotencyKey: randomUUID(),
  });
}
async function command(action: PlanCommand["action"], extra: Partial<PlanCommand> = {}) {
  const state = (await repository.view(owner, now)).state;
  return commandOwnedRoadmap(context(), repository, {
    action,
    expectedToken: state?.token ?? null,
    idempotencyKey: randomUUID(),
    ...extra,
  });
}
describe("Phase 7 roadmap persistence and optional-operation budgets", () => {
  beforeAll(async () => {
    operator.on("error", () => undefined);
    runtime.on("error", () => undefined);
    await operator.query(`CREATE DATABASE "${dbName}"`);
    await bootstrapDatabase({
      operatorConnectionString: target.toString(),
      migrationRole: { name: mig, password: migration.password },
      runtimeRole: { name: run, password: runtimeUrl.password },
      logger: { info: () => undefined },
    });
    await migrate({ connectionString: migration.toString(), logger: { info: () => undefined } });
    execFileSync(process.execPath, ["packages/db/src/cli/seed-practice.ts"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_ADMIN_URL: target.toString() },
      stdio: "pipe",
    });
  });
  beforeEach(async () => {
    owner = ids.generate("learner");
    now = must(parseInstant("2026-10-02T10:00:00Z"));
    await runtime.query("INSERT INTO platform.learner(learner_id) VALUES($1)", [owner]);
    await saveOwnedRoadmapIntent(context(), intents, {
      planId: null,
      expectedVersion: null,
      preferences: prefs,
      idempotencyKey: randomUUID(),
    });
  });
  afterAll(async () => {
    await runtime.end();
    await operator.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await operator.query(`DROP ROLE IF EXISTS "${mig}"`);
    await operator.query(`DROP ROLE IF EXISTS "${run}"`);
    await operator.end();
  });
  it("persists AI-off previews, retries once, rejects changed command facts, and isolates owners", async () => {
    const key = randomUUID();
    const pair = await Promise.all([build(key), build(key)]);
    expect(pair[0]).toEqual(pair[1]);
    expect((await repository.view(owner, now)).candidates).toHaveLength(1);
    await expect(
      buildOwnedRoadmap(context(), repository, {
        scope: "full_dsa",
        expectedToken: null,
        idempotencyKey: key,
      }),
    ).rejects.toMatchObject({ code: "version_conflict" });
    const other = ids.generate("learner");
    await runtime.query("INSERT INTO platform.learner(learner_id) VALUES($1)", [other]);
    expect(await repository.view(other, now)).toMatchObject({
      state: null,
      candidates: [],
      history: [],
      journal: [],
    });
    await expect(
      commandOwnedRoadmap(context(other), repository, {
        action: "accept",
        candidateId: pair[0]!.candidateId,
        expectedToken: null,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
  it("atomically activates one competing candidate and replays the original acceptance receipt", async () => {
    const a = await build(),
      b = await build(),
      key = randomUUID();
    const c = {
      action: "accept" as const,
      candidateId: a.candidateId,
      expectedToken: null,
      idempotencyKey: key,
    };
    const results = await Promise.allSettled([
      commandOwnedRoadmap(context(), repository, c),
      commandOwnedRoadmap(context(), repository, {
        ...c,
        candidateId: b.candidateId,
        idempotencyKey: randomUUID(),
      }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const state = (await repository.view(owner, now)).state!;
    expect(
      (await runtime.query("SELECT * FROM planning.plan_state WHERE learner_id=$1", [owner]))
        .rowCount,
    ).toBe(1);
    if (state.versionId === a.candidateId) {
      const first = (results[0] as PromiseFulfilledResult<unknown>).value;
      await command("pause");
      expect(await commandOwnedRoadmap(context(), repository, c)).toEqual(first);
      expect((await repository.view(owner, now)).state?.status).toBe("paused");
    }
  });
  it("checks lifecycle tokens, keeps pause/resume deadline fixed and blocks premature completion", async () => {
    let v = await accept();
    const old = v.state!.token;
    await expect(command("complete")).rejects.toMatchObject({ code: "invalid_request" });
    v = await command("pause");
    await expect(
      commandOwnedRoadmap(context(), repository, {
        action: "resume",
        expectedToken: old,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "version_conflict" });
    await expect(
      command("missed", {
        occurrenceId: v.state!.schedule.items.find((i) => i.kind === "lesson")!.occurrenceId,
      }),
    ).rejects.toMatchObject({ code: "invalid_request" });
    v = await command("resume");
    expect(v.state!.schedule.preferences.endDay).toBe("2026-11-02");
    await command("archive");
    await expect(command("resume")).rejects.toMatchObject({ code: "invalid_request" });
  });
  it("replans missed sessions with a diff, preserves completed work and historical check-ins across timezone/goal changes", async () => {
    let v = await accept();
    const lesson = v.state!.schedule.items.find((i) => i.kind === "lesson")!,
      problem = v.state!.schedule.items.find((i) => i.kind === "internal_problem")!;
    await command("done", { occurrenceId: lesson.occurrenceId });
    v = await command("missed", { occurrenceId: problem.occurrenceId });
    const original = structuredClone(v.history[0]);
    now = must(parseInstant("2026-10-05T10:00:00Z"));
    const intent = (await intents.getContext(owner)).intent!;
    await saveOwnedRoadmapIntent(context(), intents, {
      planId: intent.planId,
      expectedVersion: intent.version,
      preferences: {
        ...prefs,
        startDay: "2026-10-05",
        timezone: "Asia/Kolkata",
        goal: "Changed explicit pilot goal",
      },
      idempotencyKey: randomUUID(),
    });
    const preview = await build(randomUUID(), v.state!.token);
    expect(preview.status).toBe("valid");
    const fixed = preview.schedule!.items.find((i) => i.occurrenceId === lesson.occurrenceId)!;
    expect(fixed).toEqual({ ...lesson, frozen: true });
    v = await command("accept", { candidateId: preview.candidateId });
    expect(v.history[0]).toEqual(original);
    expect(v.history).toHaveLength(2);
    expect(v.journal.filter((e) => e.kind === "done")).toHaveLength(1);
    expect(v.journal.filter((e) => e.kind === "missed")).toHaveLength(1);
    expect(v.journal.some((e) => e.kind === "superseded")).toBe(true);
    const priorDone = v.journal.find((e) => e.kind === "done")!;
    v = await command("reverse", {
      occurrenceId: priorDone.occurrenceId!,
      reversesId: priorDone.eventId,
    });
    expect(v.journal.find((e) => e.kind === "reversed")?.versionId).toBe(priorDone.versionId);
    expect(v.state!.versionId).not.toBe(priorDone.versionId);
  });
  it("appends corrections, preserves receipts, and completes without creating mastery evidence", async () => {
    let v = await accept();
    for (const item of v.state!.schedule.items.filter((i) => i.required))
      v = await command("done", { occurrenceId: item.occurrenceId });
    const outcome = v.journal.find((e) => e.kind === "done")!;
    v = await command("reverse", {
      occurrenceId: outcome.occurrenceId!,
      reversesId: outcome.eventId,
    });
    expect(v.journal.some((e) => e.kind === "reversed")).toBe(true);
    await expect(
      command("reverse", { occurrenceId: outcome.occurrenceId!, reversesId: outcome.eventId }),
    ).rejects.toMatchObject({ code: "invalid_request" });
    await command("done", { occurrenceId: outcome.occurrenceId! });
    v = await command("complete");
    expect(v.state?.status).toBe("completed");
    expect(
      (await runtime.query("SELECT * FROM mastery.evidence WHERE learner_id=$1", [owner])).rowCount,
    ).toBe(0);
  });

  it("pins completed language history while scheduling deliberate practice in a newly selected language", async () => {
    let v = await accept();
    for (const item of v.state!.schedule.items.filter((i) => i.required))
      v = await command("done", { occurrenceId: item.occurrenceId });
    const original = v.state!.schedule.items.find((i) => i.kind === "internal_problem")!;
    expect(original.language).toBe("python");
    const intent = (await intents.getContext(owner)).intent!;
    await saveOwnedRoadmapIntent(context(), intents, {
      planId: intent.planId,
      expectedVersion: 1,
      preferences: { ...prefs, preferredLanguages: ["java"] },
      idempotencyKey: randomUUID(),
    });
    const preview = await build(randomUUID(), v.state!.token);
    expect(preview.status).toBe("valid");
    expect(preview.schedule!.items.find((i) => i.occurrenceId === original.occurrenceId)).toEqual({
      ...original,
      frozen: true,
    });
    const languagePractice = preview.schedule!.items.find((i) =>
      i.reasonCodes.includes("language_changed_practice"),
    )!;
    expect(languagePractice.language).toBe("java");
    expect(languagePractice.href).toContain("language=java");
    expect(languagePractice.occurrenceId).not.toBe(original.occurrenceId);
    v = await command("accept", { candidateId: preview.candidateId });
    expect(v.history).toHaveLength(2);
  });
  it("rejects stale preference versions and expired candidates", async () => {
    const preview = await build();
    const intent = (await intents.getContext(owner)).intent!;
    await saveOwnedRoadmapIntent(context(), intents, {
      planId: intent.planId,
      expectedVersion: 1,
      preferences: { ...prefs, goal: "Updated" },
      idempotencyKey: randomUUID(),
    });
    await expect(command("accept", { candidateId: preview.candidateId })).rejects.toMatchObject({
      code: "version_conflict",
    });
    const fresh = await build();
    now = must(parseInstant("2026-10-04T10:00:00Z"));
    expect((await repository.view(owner, now)).candidates[0]?.status).toBe("expired");
    await expect(command("accept", { candidateId: fresh.candidateId })).rejects.toMatchObject({
      code: "invalid_request",
    });
  });
  it("guards immutable schedules, journal ownership and kind-specific targets; privacy cascades remove only owned state", async () => {
    const v = await accept();
    for (const table of ["accepted_version", "plan_item", "plan_journal", "plan_command"])
      await expect(
        runtime.query(`UPDATE planning.${table} SET learner_id=learner_id WHERE learner_id=$1`, [
          owner,
        ]),
      ).rejects.toMatchObject({ code: "55006" });
    await expect(
      runtime.query(
        "INSERT INTO planning.plan_item(version_id,learner_id,occurrence_id,kind,body) VALUES($1,$2,'invalid','internal_problem','{}')",
        [v.state!.versionId, owner],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      runtime.query("UPDATE planning.plan_state SET status='completed' WHERE learner_id=$1", [
        owner,
      ]),
    ).rejects.toMatchObject({ code: "55006" });
    await runtime.query("DELETE FROM platform.learner WHERE learner_id=$1", [owner]);
    expect((await repository.view(owner, now)).history).toEqual([]);
  });

  it("rolls back activation, items, journal and candidate status when outbox insertion fails", async () => {
    const candidate = await build(),
      event = (
        await runtime.query(
          "SELECT event_id FROM platform.outbox_event WHERE aggregate_id=$1 LIMIT 1",
          [(await intents.getContext(owner)).intent!.planId],
        )
      ).rows[0]!.event_id;
    await expect(
      repository.command({
        learnerId: owner,
        now,
        eventId: event,
        command: {
          action: "accept",
          candidateId: candidate.candidateId,
          expectedToken: null,
          idempotencyKey: randomUUID(),
        },
      }),
    ).rejects.toMatchObject({ code: "23505" });
    const view = await repository.view(owner, now);
    expect(view.state).toBeNull();
    expect(view.history).toEqual([]);
    expect(view.journal).toEqual([]);
    expect(view.candidates[0]?.status).toBe("valid");
  });
  it("caps concurrent atomic reservations, replays without charging twice and denies changed facts", async () => {
    const input = { learnerId: owner, operation: "code_execution" as const, now, digest: "one" };
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => budgets.reserve({ ...input, key: `code-${i}` })),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(3);
    expect(await budgets.reserve({ ...input, key: "code-0" })).toEqual({
      allowed: true,
      replayed: true,
    });
    await expect(
      budgets.reserve({ ...input, key: "code-0", digest: "other" }),
    ).rejects.toMatchObject({ code: "version_conflict" });
    await budgets.finish({ ...input, key: "code-0", outcome: "success" });
    expect(await budgets.reserve({ ...input, key: "new" })).toMatchObject({ allowed: true });
  });
  it("enforces exhaustion/rate caps, sheds optional work without blocking intent writes, and rolls back reservations", async () => {
    const policy = {
      ...BUDGET_POLICIES.plan_proposal,
      concurrent: 20,
      minuteRequests: 2,
      dailyRequests: 3,
    };
    const reserve = (key: string, time = now) =>
      withTransaction(runtime, (tx) =>
        reserveOptional(
          tx,
          { learnerId: owner, operation: "plan_proposal", key, digest: key, now: time },
          policy,
        ),
      );
    expect(await reserve("one")).toMatchObject({ allowed: true });
    expect(await reserve("two")).toMatchObject({ allowed: true });
    expect(await reserve("three")).toMatchObject({ allowed: false, reason: "rate_limit" });
    const later = must(parseInstant("2026-10-02T10:02:00Z"));
    expect(await reserve("three", later)).toMatchObject({ allowed: true });
    expect(await reserve("four", later)).toMatchObject({ allowed: false, reason: "daily_cap" });
    const intent = (await intents.getContext(owner)).intent!;
    expect(
      (
        await saveOwnedRoadmapIntent(context(), intents, {
          planId: intent.planId,
          expectedVersion: 1,
          preferences: prefs,
          idempotencyKey: randomUUID(),
        })
      ).intent.version,
    ).toBe(2);
    await expect(
      withTransaction(runtime, async (tx) => {
        await reserveOptional(tx, {
          learnerId: owner,
          operation: "code_execution",
          key: "rollback",
          digest: "one",
          now,
        });
        throw Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(
      (
        await runtime.query(
          "SELECT * FROM platform.optional_reservation WHERE learner_id=$1 AND reservation_key='rollback'",
          [owner],
        )
      ).rowCount,
    ).toBe(0);
  });
  it("opens breakers only on infrastructure failure, finishes once, admits one cooldown probe and resets administratively", async () => {
    for (let i = 0; i < 3; i++) {
      await budgets.reserve({
        learnerId: owner,
        operation: "code_execution",
        key: `f-${i}`,
        digest: "f",
        now,
      });
      await budgets.finish({
        learnerId: owner,
        operation: "code_execution",
        key: `f-${i}`,
        now,
        outcome: "failure",
      });
      await budgets.finish({
        learnerId: owner,
        operation: "code_execution",
        key: `f-${i}`,
        now,
        outcome: "failure",
      });
    }
    expect(
      await budgets.reserve({
        learnerId: owner,
        operation: "code_execution",
        key: "denied",
        digest: "f",
        now,
      }),
    ).toMatchObject({ allowed: false, reason: "circuit_open" });
    const after = must(parseInstant("2026-10-02T10:02:00Z"));
    expect(
      await budgets.reserve({
        learnerId: owner,
        operation: "code_execution",
        key: "probe",
        digest: "f",
        now: after,
      }),
    ).toMatchObject({ allowed: true });
    expect(
      await budgets.reserve({
        learnerId: owner,
        operation: "code_execution",
        key: "probe-2",
        digest: "f",
        now: after,
      }),
    ).toMatchObject({ allowed: false, reason: "circuit_open" });
    await budgets.finish({
      learnerId: owner,
      operation: "code_execution",
      key: "probe",
      now: after,
      outcome: "success",
    });
    expect(
      await budgets.reserve({
        learnerId: owner,
        operation: "code_execution",
        key: "recovered",
        digest: "f",
        now: after,
      }),
    ).toMatchObject({ allowed: true });
    await expect(budgets.reset(context(), owner, "code_execution")).rejects.toMatchObject({
      code: "forbidden",
    });
    const operatorContext = createRequestContext({
      actor: createActor({
        userId: owner,
        sessionId: ids.generate("session"),
        roles: ["operator"],
      }),
      clock: createFixedClock(now),
      ids,
      serviceName: "operator-reset",
    });
    const budgetEvidence = await budgets.evaluationSnapshot(operatorContext, owner);
    expect(budgetEvidence[0]).toMatchObject({
      operation: "code_execution",
      infrastructureFailures: 3,
      pending: 1,
      policyVersion: 1,
    });
    await expect(budgets.evaluationSnapshot(context(), owner)).rejects.toMatchObject({
      code: "forbidden",
    });
    await budgets.reset(operatorContext, owner, "code_execution");
    expect(
      (await runtime.query("SELECT * FROM platform.operation_breaker WHERE learner_id=$1", [owner]))
        .rowCount,
    ).toBe(0);
  });
  it("read models retain historical adherence without treating learner reports as mastery", async () => {
    await accept();
    const progress = new PostgresProgressRepository(runtime);
    const initial = await progress.getProgress({ learnerId: owner, now });
    expect(initial.mastery).toEqual([]);
    expect(initial.planAdherence).toMatchObject({
      status: "accepted_plan",
      completedOnTime: 0,
      totalDue: 2,
    });
    expect((await progress.getHome({ learnerId: owner, now })).plannedAction?.kind).toBe("planned");
    const state = (await repository.view(owner, now)).state!;
    await command("done", {
      occurrenceId: state.schedule.items.find((i) => i.kind === "lesson")!.occurrenceId,
    });
    expect(
      (await progress.getProgress({ learnerId: owner, now })).planAdherence.completedOnTime,
    ).toBe(1);
    await command("pause");
    expect((await progress.getHome({ learnerId: owner, now })).plannedAction).toBeUndefined();
  });
});
