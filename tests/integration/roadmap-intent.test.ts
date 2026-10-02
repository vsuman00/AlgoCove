import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  bootstrapDatabase,
  createPool,
  migrate,
  PostgresRoadmapIntentRepository,
  withTransaction,
} from "@algocove/db";
import {
  createActor,
  createFixedClock,
  createRequestContext,
  type IdGenerator,
  saveOwnedRoadmapIntent,
  getOwnedPlanningContext,
} from "@algocove/application";
import {
  formatId,
  parseInstant,
  type Result,
  type LearnerId,
  type RoadmapIntentVersion,
} from "@algocove/domain";
function must<T>(result: Result<T, unknown>): T {
  if (!result.ok) throw Error("fixture");
  return result.value;
}
const suffix = `${process.pid}_${Date.now()}`,
  databaseName = `algocove_plan_${suffix}`,
  migrationRole = `algocove_plan_mig_${suffix}`,
  runtimeRole = `algocove_plan_run_${suffix}`;
const baseUrl = new URL(
  process.env.DATABASE_TEST_OPERATOR_URL ??
    process.env.DATABASE_ADMIN_URL ??
    "postgres://postgres:postgres@127.0.0.1:54329/postgres",
);
baseUrl.pathname = "/postgres";
const target = new URL(baseUrl);
target.pathname = `/${databaseName}`;
const migrationUrl = new URL(target);
migrationUrl.username = migrationRole;
migrationUrl.password = randomUUID();
const runtimeUrl = new URL(target);
runtimeUrl.username = runtimeRole;
runtimeUrl.password = randomUUID();
const operator = createPool({
  connectionString: baseUrl.toString(),
  applicationName: "planning-test-operator",
  maxConnections: 2,
  statementTimeoutMs: 5000,
});
const runtime = createPool({
  connectionString: runtimeUrl.toString(),
  applicationName: "planning-test-runtime",
  maxConnections: 4,
  statementTimeoutMs: 5000,
});
const repository = new PostgresRoadmapIntentRepository(runtime);
const learnerId = must(formatId("learner", "aaaaaaaaaaaaaaaa")),
  otherId = must(formatId("learner", "bbbbbbbbbbbbbbbb")),
  collectionId = must(formatId("collection", "aaaaaaaaaaaaaaaa"));
let entropy = 1000;
const ids: IdGenerator = {
  generate(kind) {
    return must(formatId(kind, String(entropy++).padStart(16, "0")));
  },
};
function context(owner: LearnerId = learnerId, time = "2026-10-02T10:00:00Z") {
  return createRequestContext({
    actor: createActor({
      userId: owner,
      sessionId: must(formatId("session", "aaaaaaaaaaaaaaaa")),
      roles: ["learner"],
    }),
    clock: createFixedClock(must(parseInstant(time))),
    ids,
    serviceName: "roadmap-intent-integration",
  });
}
const preferences = {
  goal: "Learn patterns",
  targetRole: "Engineer",
  horizonMonths: 1,
  startDay: "2026-10-02",
  timezone: "Asia/Kolkata",
  dailyCapacityMinutes: 45,
  studyWeekdays: [1, 3, 5],
  preferredLanguages: ["python"],
  collectionIds: [collectionId],
};
const create = {
  planId: null,
  expectedVersion: null,
  preferences,
  idempotencyKey: "planning-save-first",
};
let first: RoadmapIntentVersion;
describe("private persisted roadmap inputs", () => {
  beforeAll(async () => {
    operator.on("error", () => undefined);
    runtime.on("error", () => undefined);
    await operator.query(`CREATE DATABASE "${databaseName}"`);
    await bootstrapDatabase({
      operatorConnectionString: target.toString(),
      migrationRole: { name: migrationRole, password: migrationUrl.password },
      runtimeRole: { name: runtimeRole, password: runtimeUrl.password },
      logger: { info: () => undefined },
    });
    await migrate({ connectionString: migrationUrl.toString(), logger: { info: () => undefined } });
    await runtime.query("INSERT INTO platform.learner(learner_id) VALUES($1),($2)", [
      learnerId,
      otherId,
    ]);
    await runtime.query(
      "INSERT INTO content.external_collection(collection_id,slug,title) VALUES($1,'pattern-practice','Pattern practice')",
      [collectionId],
    );
  });
  afterAll(async () => {
    await runtime.end();
    await operator.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await operator.query(`DROP ROLE IF EXISTS "${migrationRole}"`);
    await operator.query(`DROP ROLE IF EXISTS "${runtimeRole}"`);
    await operator.end();
  });
  it("starts empty and commits concurrent identical saves once with immutable receipts and outbox", async () => {
    expect(await getOwnedPlanningContext(context(), repository)).toMatchObject({
      intent: null,
      profile: null,
      collections: [{ collectionId, title: "Pattern practice" }],
    });
    const results = await Promise.all([
      saveOwnedRoadmapIntent(context(), repository, create),
      saveOwnedRoadmapIntent(context(), repository, create),
    ]);
    expect(results.map((r) => r.disposition).sort()).toEqual(["committed", "replayed"]);
    expect(results[0]!.intent).toEqual(results[1]!.intent);
    first = results[0]!.intent;
    expect(first).toMatchObject({ version: 1, preferences: { endDay: "2026-11-02" } });
    for (const table of [
      "planning.roadmap_intent",
      "planning.roadmap_intent_version",
      "planning.intent_command",
      "planning.intent_collection",
    ])
      expect((await runtime.query(`SELECT * FROM ${table}`)).rowCount).toBe(1);
    expect(
      (
        await runtime.query(
          "SELECT * FROM platform.outbox_event WHERE topic='planning.intent.saved'",
        )
      ).rowCount,
    ).toBe(1);
  });
  it("rejects changed facts on replay, unsupported collections and another owner’s plan", async () => {
    await expect(
      saveOwnedRoadmapIntent(context(), repository, {
        ...create,
        preferences: { ...preferences, goal: "Different" },
      }),
    ).rejects.toMatchObject({ code: "version_conflict" });
    expect((await getOwnedPlanningContext(context(otherId), repository)).intent).toBeNull();
    await expect(
      saveOwnedRoadmapIntent(context(otherId), repository, {
        ...create,
        planId: first.planId,
        expectedVersion: 1,
        idempotencyKey: "planning-other-update",
      }),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      saveOwnedRoadmapIntent(context(otherId), repository, {
        ...create,
        preferences: { ...preferences, collectionIds: ["col_bbbbbbbbbbbbbbbb"] },
        idempotencyKey: "planning-missing-collection",
      }),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect((await getOwnedPlanningContext(context(otherId), repository)).intent).toBeNull();
  });
  it("serializes competing edits and preserves the original revision and old command receipt", async () => {
    const edit = { ...create, planId: first.planId, expectedVersion: 1 };
    const results = await Promise.allSettled([
      saveOwnedRoadmapIntent(context(), repository, {
        ...edit,
        preferences: { ...preferences, goal: "Trees" },
        idempotencyKey: "planning-edit-trees",
      }),
      saveOwnedRoadmapIntent(context(), repository, {
        ...edit,
        preferences: { ...preferences, goal: "Graphs" },
        idempotencyKey: "planning-edit-graphs",
      }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({
      reason: { code: "version_conflict" },
    });
    expect((await getOwnedPlanningContext(context(), repository)).intent?.version).toBe(2);
    const replay = await saveOwnedRoadmapIntent(context(), repository, create);
    expect(replay).toEqual({ intent: first, disposition: "replayed" });
    expect((await getOwnedPlanningContext(context(), repository)).intent?.version).toBe(2);
    expect(
      (
        await runtime.query(
          "SELECT preferences FROM planning.roadmap_intent_version WHERE plan_id=$1 AND version=1",
          [first.planId],
        )
      ).rows[0]!.preferences,
    ).toEqual(first.preferences);
  });
  it("replays a saved command across midnight without allowing a new backdated save", async () => {
    const nextDay = context(learnerId, "2026-10-03T10:00:00Z");
    expect(await saveOwnedRoadmapIntent(nextDay, repository, create)).toEqual({
      intent: first,
      disposition: "replayed",
    });
    await expect(
      saveOwnedRoadmapIntent(nextDay, repository, {
        ...create,
        planId: first.planId,
        expectedVersion: 2,
        idempotencyKey: "planning-new-backdated",
      }),
    ).rejects.toMatchObject({ code: "invalid_request" });
  });
  it("rolls back preference, pointer, collection and command writes if outbox persistence fails", async () => {
    const event = (
      await runtime.query(
        "SELECT event_id FROM platform.outbox_event WHERE topic='planning.intent.saved' LIMIT 1",
      )
    ).rows[0]!.event_id;
    const before = (await getOwnedPlanningContext(context(), repository)).intent!;
    await expect(
      repository.save({
        learnerId,
        planId: first.planId,
        newPlanId: ids.generate("roadmapPlan"),
        expectedVersion: 2,
        preferences: { ...before.preferences, goal: "Rollback should not appear" },
        now: context().now,
        eventId: event,
        idempotencyKey: "planning-outbox-rollback",
      }),
    ).rejects.toMatchObject({ code: "23505" });
    expect((await getOwnedPlanningContext(context(), repository)).intent).toEqual(before);
    expect(
      (
        await runtime.query(
          "SELECT * FROM planning.intent_command WHERE idempotency_key='planning-outbox-rollback'",
        )
      ).rowCount,
    ).toBe(0);
    expect(
      (
        await runtime.query("SELECT * FROM planning.roadmap_intent_version WHERE plan_id=$1", [
          first.planId,
        ])
      ).rowCount,
    ).toBe(2);
  });
  it("guards immutable history, identity, pointer integrity and cross-owner foreign keys", async () => {
    for (const query of [
      "UPDATE planning.roadmap_intent_version SET preferences=preferences",
      "DELETE FROM planning.roadmap_intent_version",
      "UPDATE planning.intent_collection SET collection_id=collection_id",
      "UPDATE planning.intent_command SET digest=digest",
      "UPDATE planning.roadmap_intent SET current_version=1",
    ])
      await expect(runtime.query(query)).rejects.toMatchObject({ code: "55006" });
    await expect(
      withTransaction(runtime, async (tx) => {
        await tx.query("UPDATE planning.roadmap_intent SET current_version=3 WHERE plan_id=$1", [
          first.planId,
        ]);
      }),
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      runtime.query(
        "INSERT INTO planning.intent_command(learner_id,idempotency_key,digest,plan_id,version) VALUES($1,'cross-owner-key',$2,$3,1)",
        [otherId, "sha256:" + "a".repeat(64), first.planId],
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });
  it("allows learner privacy cascades without allowing direct history deletion", async () => {
    await runtime.query("DELETE FROM platform.learner WHERE learner_id=$1", [learnerId]);
    for (const table of [
      "planning.roadmap_intent",
      "planning.roadmap_intent_version",
      "planning.intent_collection",
      "planning.intent_command",
    ])
      expect((await runtime.query(`SELECT * FROM ${table}`)).rowCount).toBe(0);
  });
});
