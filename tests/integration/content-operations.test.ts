import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createActor,
  createFixedClock,
  createRequestContext,
  type RequestContext,
} from "@algocove/application";
import { bootstrapDatabase, createPool, migrate, PostgresPracticeRepository } from "@algocove/db";
import {
  formatId,
  parseInstant,
  PROBLEM_LANGUAGES,
  type Role,
  type Result,
} from "@algocove/domain";
const fixture = vi.hoisted(() => ({ pool: null as ReturnType<typeof createPool> | null }));
vi.mock("../../apps/web/src/practice/runtime", () => ({
  getPracticeRuntime: () => (fixture.pool ? { pool: fixture.pool } : null),
}));
const { commandContent, readContent } = await import("../../apps/web/src/content/operations");
function must<T>(value: Result<T, unknown>): T {
  if (!value.ok) throw Error("Invalid integration fixture");
  return value.value;
}
const suffix = `${process.pid}_${Date.now()}`;
const databaseName = `algocove_content_${suffix}`;
const migrationRole = `algocove_content_mig_${suffix}`;
const runtimeRole = `algocove_content_run_${suffix}`;
const base = new URL(
  process.env.DATABASE_TEST_OPERATOR_URL ?? "postgres://postgres:postgres@127.0.0.1:54329/postgres",
);
base.pathname = "/postgres";
const target = new URL(base);
target.pathname = `/${databaseName}`;
const migrationUrl = new URL(target);
migrationUrl.username = migrationRole;
migrationUrl.password = randomUUID();
const runtimeUrl = new URL(target);
runtimeUrl.username = runtimeRole;
runtimeUrl.password = randomUUID();
const operator = createPool({
  connectionString: base.toString(),
  applicationName: "content-test-operator",
  maxConnections: 2,
  statementTimeoutMs: 5000,
});
const pool = createPool({
  connectionString: runtimeUrl.toString(),
  applicationName: "content-test-runtime",
  maxConnections: 4,
  statementTimeoutMs: 5000,
});
const actors = [
  "author",
  "technical_reviewer",
  "pedagogical_reviewer",
  "evaluator",
  "publisher",
  "learner",
].map((role) =>
  createActor({
    userId: must(formatId("learner", randomBytes(20).toString("hex"))),
    sessionId: must(formatId("session", randomBytes(20).toString("hex"))),
    roles: [role as Role],
  }),
);
function ctx(index: number): RequestContext {
  return createRequestContext({
    actor: actors[index]!,
    clock: createFixedClock(must(parseInstant("2026-10-03T10:00:00.000Z"))),
    ids: { generate: (kind) => must(formatId(kind, randomBytes(20).toString("hex"))) },
    serviceName: "content-integration",
  });
}
async function draft() {
  const response = await commandContent(ctx(0), {
    command: "create",
    idempotencyKey: randomUUID(),
    title: "Original bounded array",
    statement: "Find the checked area for the authored array.",
    rightsHolder: "AlgoCove",
    license: "original-v1",
  });
  const id = (response.content as { contentVersionId: string }).contentVersionId;
  return (await readContent(ctx(0), id)).records[0]!;
}
async function send(
  index: number,
  id: string,
  command: string,
  extra: Record<string, unknown> = {},
) {
  const record = (await readContent(ctx(index), id)).records[0]!;
  return commandContent(ctx(index), {
    command,
    versionId: id,
    expectedRevision: record.revision,
    idempotencyKey: randomUUID(),
    ...extra,
  });
}
beforeAll(async () => {
  await operator.query(`CREATE DATABASE "${databaseName}"`);
  await bootstrapDatabase({
    operatorConnectionString: target.toString(),
    migrationRole: { name: migrationRole, password: migrationUrl.password },
    runtimeRole: { name: runtimeRole, password: runtimeUrl.password },
  });
  await migrate({
    connectionString: migrationUrl.toString(),
    applicationName: "content-test-migrate",
    logger: { info: () => undefined },
  });
  fixture.pool = pool;
  for (const actor of actors)
    await pool.query("INSERT INTO platform.learner(learner_id) VALUES($1)", [actor.userId]);
});
afterAll(async () => {
  fixture.pool = null;
  await pool.end();
  await operator.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await operator.query(`DROP ROLE IF EXISTS "${migrationRole}"`);
  await operator.query(`DROP ROLE IF EXISTS "${runtimeRole}"`);
  await operator.end();
});
describe("persisted governed content operations", () => {
  it("rejects learner access and forged command roles", async () => {
    await expect(readContent(ctx(5))).rejects.toMatchObject({ status: 403 });
    await expect(
      commandContent(ctx(5), {
        command: "create",
        roles: ["author"],
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("commits draft, audit, outbox and replay receipt once without storing payloads in receipts", async () => {
    const input = {
      command: "create",
      idempotencyKey: randomUUID(),
      title: "Replay draft",
      statement: "Private authored statement",
      rightsHolder: "AlgoCove",
      license: "original-v1",
    };
    const first = await commandContent(ctx(0), input),
      second = await commandContent(ctx(0), input);
    expect(second).toEqual(first);
    expect(JSON.stringify(first)).not.toContain(input.statement);
    const id = (first.content as { contentVersionId: string }).contentVersionId;
    const count = await pool.query(
      "SELECT (SELECT count(*) FROM platform.audit_event WHERE resource_id=$1)::int audits,(SELECT count(*) FROM platform.outbox_event WHERE aggregate_id=$1)::int outbox",
      [id],
    );
    expect(count.rows[0]).toEqual({ audits: 1, outbox: 1 });
    await expect(commandContent(ctx(0), { ...input, title: "Changed" })).rejects.toMatchObject({
      status: 409,
    });
  });
  it("enforces author/reviewer and role boundaries without mutating the draft", async () => {
    const record = await draft(),
      id = record.content.contentVersionId;
    await expect(
      send(0, id, "review", { kind: "technical", decision: "approved", notes: null }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(send(1, id, "publish")).rejects.toMatchObject({ status: 400 });
    expect((await readContent(ctx(0), id)).records[0]?.content.reviews).toEqual([]);
  });
  it("serializes competing reviews and rejects stale revisions", async () => {
    const record = await draft(),
      body = {
        command: "review",
        versionId: record.content.contentVersionId,
        expectedRevision: record.revision,
        notes: null,
        decision: "approved",
      };
    const results = await Promise.allSettled([
      commandContent(ctx(1), { ...body, kind: "technical", idempotencyKey: randomUUID() }),
      commandContent(ctx(2), { ...body, kind: "pedagogical", idempotencyKey: randomUUID() }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toMatchObject([
      { reason: { status: 409 } },
    ]);
  });
  it("records a failed validation and blocks publication with missing languages", async () => {
    const record = await draft(),
      id = record.content.contentVersionId;
    await send(3, id, "validate");
    expect((await readContent(ctx(0), id)).records[0]?.content.validation.status).toBe("failed");
    await expect(send(4, id, "publish")).rejects.toMatchObject({ status: 400 });
  });
  it("rejects malformed or incomplete contracts without erasing a recorded review", async () => {
    const record = await draft(),
      id = record.content.contentVersionId;
    await send(1, id, "review", { kind: "technical", decision: "approved", notes: null });
    for (const contracts of [
      { fixtures: [], starters: {} },
      { fixtures: [{ fixtureId: "bad id", semanticKey: "invalid" }], starters: {} },
      {
        fixtures: [{ fixtureId: "bounded", semanticKey: "original check" }],
        starters: { python: "only one language" },
      },
    ])
      await expect(send(0, id, "manifest", contracts)).rejects.toMatchObject({ status: 400 });
    const current = (await readContent(ctx(0), id)).records[0]!;
    expect(current.content.reviews).toHaveLength(1);
    expect(current.manifest.languages).toHaveLength(0);
  });
  it("publishes reviewed complete metadata then retires atomically and hides withdrawn payloads", async () => {
    const record = await draft(),
      id = record.content.contentVersionId;
    const fixtureId = `content-${randomBytes(6).toString("hex")}`;
    const contracts = {
      fixtures: [{ fixtureId, semanticKey: "authored_semantic_check" }],
      starters: Object.fromEntries(
        PROBLEM_LANGUAGES.map((language) => [language, "authored starter"]),
      ),
    };
    await send(0, id, "manifest", contracts);
    await send(1, id, "review", { kind: "technical", decision: "approved", notes: "Reviewed" });
    await send(2, id, "review", { kind: "pedagogical", decision: "approved", notes: null });
    await send(3, id, "validate");
    const approved = (await readContent(ctx(0), id)).records[0]!;
    await expect(send(1, id, "manifest", contracts)).rejects.toMatchObject({ status: 403 });
    await send(0, id, "manifest", {
      ...contracts,
      starters: { ...contracts.starters, python: "revised starter" },
    });
    const edited = (await readContent(ctx(0), id)).records[0]!;
    expect(edited.content.reviews).toEqual([]);
    expect(edited.content.validation.status).toBe("pending");
    expect(edited.revision).not.toBe(approved.revision);
    await expect(
      commandContent(ctx(1), {
        command: "review",
        versionId: id,
        expectedRevision: approved.revision,
        idempotencyKey: randomUUID(),
        kind: "technical",
        decision: "approved",
        notes: null,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await send(1, id, "review", { kind: "technical", decision: "approved", notes: null });
    await send(2, id, "review", { kind: "pedagogical", decision: "approved", notes: null });
    await send(3, id, "validate");
    await send(4, id, "publish");
    expect((await readContent(ctx(4), id)).records[0]?.content.status).toBe("published");
    const publicPractice = new PostgresPracticeRepository(pool);
    expect(await publicPractice.getPublishedProblem(record.content.problemVersionId)).toEqual({
      title: record.content.title,
      statement: record.content.statement,
    });
    await expect(
      pool.query(
        "UPDATE content.content_version SET title='tampered' WHERE content_version_id=$1",
        [id],
      ),
    ).rejects.toMatchObject({ code: "55006" });
    await expect(
      pool.query(
        "UPDATE content.problem_version SET statement='tampered' WHERE content_version_id=$1",
        [id],
      ),
    ).rejects.toMatchObject({ code: "55006" });
    const result = await send(4, id, "retire", { reason: "rights_withdrawn" });
    expect(JSON.stringify(result)).not.toContain(record.content.statement);
    expect(await publicPractice.getPublishedProblem(record.content.problemVersionId)).toBeNull();
    const retired = (await readContent(ctx(4), id)).records[0]!.content;
    expect(retired).toMatchObject({
      status: "retired",
      payloadStatus: "tombstoned",
      statement: null,
    });
    await expect(
      pool.query(
        "UPDATE content.content_version SET status='published',retired_at=NULL,retirement_reason=NULL,payload_status='available' WHERE content_version_id=$1",
        [id],
      ),
    ).rejects.toMatchObject({ code: "55006" });
    await expect(send(4, id, "retire", { reason: "retired" })).rejects.toMatchObject({
      status: 400,
    });
  });
});
