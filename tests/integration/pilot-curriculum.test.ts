import type * as RequestContextModule from "../../apps/web/src/auth/request-context";
import { pilotPublicView } from "@algocove/content/pilot";
import { readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createActor,
  createFixedClock,
  createRequestContext,
  listPublishedProblems,
  resolvePublishedProblem,
  type RequestContext,
} from "@algocove/application";
import {
  bootstrapDatabase,
  createPool,
  migrate,
  PostgresPracticeRepository,
  PostgresDraftRepository,
  PostgresPseudocodeRepository,
  PostgresHintRepository,
  PostgresReadinessContentRepository,
  PostgresExternalCompanionRepository,
  PostgresPilotRepository,
  PostgresLearningCatalogRepository,
  PostgresLearningReleaseRepository,
  PostgresDestinationRepository,
  PostgresLearningCollectionRepository,
  PostgresPrivacyRepository,
  withTransaction,
} from "@algocove/db";
import { pilotIdentity, formatId, parseInstant, type Role, type Result } from "@algocove/domain";
const fixture = vi.hoisted(() => ({ pool: null as ReturnType<typeof createPool> | null }));
vi.mock("../../apps/web/src/practice/runtime", () => ({
  getPracticeRuntime: () =>
    fixture.pool
      ? {
          pool: fixture.pool,
          practice: new PostgresPracticeRepository(fixture.pool),
          drafts: new PostgresDraftRepository(fixture.pool),
          pseudocode: new PostgresPseudocodeRepository(fixture.pool),
          hints: new PostgresHintRepository(fixture.pool),
          executionRelay: null,
        }
      : null,
}));
vi.mock("../../apps/web/src/auth/request-context", async (original) => ({
  ...(await original<typeof RequestContextModule>()),
  authenticatedWebRequestContext: async () => ctx(5),
}));
const { commandContent, readContent } = await import("../../apps/web/src/content/operations");
function must<T>(value: Result<T, unknown>): T {
  if (!value.ok) throw Error("Invalid integration fixture");
  return value.value;
}
const suffix = `${process.pid}_${Date.now()}`;
const databaseName = `algocove_pilot_${suffix}`;
const migrationRole = `algocove_pilot_mig_${suffix}`;
const runtimeRole = `algocove_pilot_run_${suffix}`;
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
    clock: createFixedClock(must(parseInstant("2026-10-06T10:00:00.000Z"))),
    ids: { generate: (kind) => must(formatId(kind, randomBytes(20).toString("hex"))) },
    serviceName: "content-integration",
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
  for (const actor of actors) {
    await pool.query("INSERT INTO platform.learner(learner_id) VALUES($1)", [actor.userId]);
    for (const role of actor.roles)
      await pool.query("INSERT INTO platform.role_grant(learner_id,role) VALUES($1,$2)", [
        actor.userId,
        role,
      ]);
  }
});
afterAll(async () => {
  fixture.pool = null;
  await pool.end();
  await operator.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await operator.query(`DROP ROLE IF EXISTS "${migrationRole}"`);
  await operator.query(`DROP ROLE IF EXISTS "${runtimeRole}"`);
  await operator.end();
});

const patterns = ["arrays-hashing", "two-pointers", "sliding-window", "stack"];
const bundles = patterns.map((p) =>
  JSON.parse(readFileSync(`content/patterns/${p}/bundle.json`, "utf8")),
);
const call = (_i: number, fn: (repo: PostgresPilotRepository) => Promise<unknown>) =>
  withTransaction(pool, (tx) => fn(new PostgresPilotRepository(tx)));
async function standard(
  i: number,
  id: string,
  command: string,
  extra: Record<string, unknown> = {},
) {
  const r = (await readContent(ctx(i), id)).records[0]!;
  return commandContent(ctx(i), {
    command,
    versionId: id,
    expectedRevision: r.revision,
    idempotencyKey: randomUUID(),
    ...extra,
  });
}
describe("four governed pilot journeys", () => {
  it("denies learner access and author self-review; imports only private drafts atomically", async () => {
    await expect(call(5, (r) => r.list(ctx(5)))).rejects.toMatchObject({ status: 403 });
    for (const b of bundles) {
      const first = (await call(0, (r) => r.import(ctx(0), b))) as {
        versionId: string;
        checksum: string;
      };
      expect(await call(0, (r) => r.import(ctx(0), b))).toMatchObject({ replay: true });
      const id = pilotIdentity(b.slug)!;
      expect(
        await new PostgresPracticeRepository(pool).getPublishedProblem(id.problemVersionId),
      ).toBeNull();
      await expect(
        call(0, (r) =>
          r.review(ctx(0), {
            ...first,
            kind: "technical",
            decision: "approved",
            notes: "Self review",
          }),
        ),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        standard(0, first.versionId, "manifest", { fixtures: [], starters: {} }),
      ).rejects.toMatchObject({ status: 409 });
    }
  });
  it("imports outbound mappings as unreviewed draft policies without copying external payloads", async () => {
    const collection = JSON.parse(readFileSync("content/collections/pilot-transfer.json", "utf8"));
    await call(0, (r) => r.importCollection(ctx(0), collection));
    const references = await pool.query(
      "SELECT provider,url_status FROM content.external_reference",
    );
    expect(references.rows).toHaveLength(4);
    expect(
      references.rows.every((r) => r.provider === "leetcode" && r.url_status === "unreviewed"),
    ).toBe(true);
    expect(
      (await pool.query("SELECT status FROM content.external_readiness_rubric")).rows.every(
        (r) => r.status === "draft",
      ),
    ).toBe(true);
    expect(await listPublishedProblems(new PostgresLearningCatalogRepository(pool))).toEqual({
      items: [],
      nextAfter: null,
    });
  });
  it("requires all six checksum-bound reviews, publishes safe metadata and immutable six-language contracts", async () => {
    for (const b of bundles) {
      const id = pilotIdentity(b.slug)!;
      const record = (
        (await call(1, (r) => r.list(ctx(1)))) as { versionId: string; checksum: string }[]
      ).find((r) => r.versionId === id.contentVersionId)!;
      await standard(1, id.contentVersionId, "review", {
        kind: "technical",
        decision: "approved",
        notes: "Synthetic integration review; not human publication evidence",
      });
      await standard(2, id.contentVersionId, "review", {
        kind: "pedagogical",
        decision: "approved",
        notes: "Synthetic integration review",
      });
      await standard(3, id.contentVersionId, "validate");
      await expect(standard(4, id.contentVersionId, "publish")).rejects.toBeDefined();
      expect(
        (
          await pool.query(
            "SELECT status FROM content.problem_language_manifest WHERE problem_version_id=$1",
            [id.problemVersionId],
          )
        ).rows.every((r) => r.status === "draft"),
      ).toBe(true);
      for (const kind of [
        "technical",
        "pedagogical",
        "accessibility",
        "rights",
        "trace",
        "conformance",
      ] as const) {
        const actor = ["pedagogical", "accessibility"].includes(kind) ? 2 : 1;
        await expect(
          call(actor, (r) =>
            r.review(ctx(actor), {
              ...record,
              checksum: `sha256:${"0".repeat(64)}`,
              kind,
              decision: "approved",
              notes: "Stale",
            }),
          ),
        ).rejects.toMatchObject({ status: 409 });
        await call(actor, (r) =>
          r.review(ctx(actor), {
            ...record,
            kind,
            decision: "approved",
            notes: "Synthetic automated fixture only",
          }),
        );
      }
      await standard(4, id.contentVersionId, "publish");
      const learnerView = await new PostgresPracticeRepository(pool).getPublishedProblem(
        id.problemVersionId,
      );
      expect(learnerView?.title).toBe(b.title);
      const json = JSON.stringify(learnerView);
      for (const privateKey of [
        "correctOption",
        "expectedReasoning",
        "solution",
        "fixtures",
        "trace",
        "hints",
      ])
        expect(json).not.toContain(`"${privateKey}"`);
      expect(
        (
          await pool.query(
            "SELECT status FROM content.problem_language_manifest WHERE problem_version_id=$1",
            [id.problemVersionId],
          )
        ).rows.every((r) => r.status === "published"),
      ).toBe(true);
      expect(
        (
          await pool.query("SELECT status FROM content.review_exercise WHERE concept_id=$1", [
            id.conceptId,
          ])
        ).rows,
      ).toEqual([{ status: "published" }, { status: "published" }]);
      await expect(
        pool.query("UPDATE content.pilot_bundle SET slug=slug WHERE content_version_id=$1", [
          id.contentVersionId,
        ]),
      ).rejects.toMatchObject({ code: "55006" });
      await expect(
        pool.query(
          "INSERT INTO content.pilot_review(content_version_id,kind,checksum,reviewer_id,decision,notes,reviewed_at) VALUES($1,'rights',$2,$3,'approved','late',now())",
          [id.contentVersionId, record.checksum, actors[4]!.userId],
        ),
      ).rejects.toMatchObject({ code: "55006" });
    }
    expect(
      (
        await pool.query(
          "SELECT status FROM learning.curriculum_graph_version WHERE curriculum_version_id='cur_5555555555555555'",
        )
      ).rows[0]?.status,
    ).toBe("published");
  });
  it("resolves SQL-only routes and aliases with exact pins and excludes withdrawn or incomplete releases", async () => {
    const repo = new PostgresLearningCatalogRepository(pool);
    const first = await listPublishedProblems(repo, { limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.nextAfter).toBe(first.items[1]!.slug);
    const rest = await listPublishedProblems(repo, { after: first.nextAfter!, limit: 2 });
    expect(rest.items).toHaveLength(2);
    expect(rest.nextAfter).toBeNull();
    expect(await listPublishedProblems(repo, { search: "no matching title" })).toEqual({
      items: [],
      nextAfter: null,
    });
    expect(
      (await listPublishedProblems(repo, { pattern: "stack", language: "c" })).items.map(
        (r) => r.slug,
      ),
    ).toEqual(["signal-cancellation"]);
    const rollback = new Error("catalog fixture rollback");
    await expect(
      withTransaction(pool, async (tx) => {
        // Isolated synthetic persistence fixture; not curriculum or publication evidence.
        const source = pilotIdentity("matching-readings")!;
        await tx.query(
          "INSERT INTO content.content_item(content_id,content_kind) VALUES('con_6666666666666666','problem')",
        );
        await tx.query(
          "INSERT INTO content.problem(problem_id,content_id) VALUES('pro_6666666666666666','con_6666666666666666')",
        );
        await tx.query(
          `INSERT INTO content.content_version(content_version_id,content_id,title,checksum,provenance_kind,rights_holder,license,author_id,status,payload_status,published_at)
        SELECT 'cnt_6666666666666666','con_6666666666666666','Distinct SQL catalog fixture',checksum,provenance_kind,rights_holder,license,author_id,'draft','available',NULL FROM content.content_version WHERE content_version_id=$1`,
          [source.contentVersionId],
        );
        await tx.query(
          "INSERT INTO content.problem_version(problem_version_id,problem_id,content_version_id,statement) VALUES('prb_6666666666666666','pro_6666666666666666','cnt_6666666666666666','A distinct test-only statement.')",
        );
        await tx.query(
          "INSERT INTO content.problem_route(slug,problem_id,is_canonical) VALUES('distinct-sql-fixture','pro_6666666666666666',true),('old-fixture-alias','pro_6666666666666666',false)",
        );
        await tx.query(
          `INSERT INTO content.problem_language_manifest(manifest_id,problem_version_id,language,starter_template,entry_signature,adapter_id,limits_profile,status)
        SELECT 'man_'||repeat('6',15)||row_number() OVER(ORDER BY language),'prb_6666666666666666',language,starter_template,entry_signature,adapter_id,limits_profile,'published' FROM content.problem_language_manifest WHERE problem_version_id=$1 AND language<>'c'`,
          [source.problemVersionId],
        );
        const catalog = new PostgresLearningCatalogRepository(tx);
        await tx.query("SAVEPOINT incomplete_version");
        await tx.query(
          "UPDATE content.content_version SET status='published',published_at=now() WHERE content_version_id='cnt_6666666666666666'",
        );
        await expect(resolvePublishedProblem(catalog, "old-fixture-alias")).rejects.toMatchObject({
          status: 404,
        });
        await tx.query("ROLLBACK TO SAVEPOINT incomplete_version");
        await tx.query(
          `INSERT INTO content.problem_language_manifest(manifest_id,problem_version_id,language,starter_template,entry_signature,adapter_id,limits_profile,status)
          SELECT 'man_6666666666666666','prb_6666666666666666',language,starter_template,entry_signature,adapter_id,limits_profile,'published' FROM content.problem_language_manifest WHERE problem_version_id=$1 AND language='c'`,
          [source.problemVersionId],
        );
        await tx.query(
          "UPDATE content.content_version SET status='published',published_at=now() WHERE content_version_id='cnt_6666666666666666'",
        );
        const resolved = await resolvePublishedProblem(catalog, "old-fixture-alias");
        expect(resolved).toMatchObject({
          slug: "distinct-sql-fixture",
          problemVersionId: "prb_6666666666666666",
          contentVersionId: "cnt_6666666666666666",
          pattern: null,
        });
        expect((await listPublishedProblems(catalog, { search: "SQL catalog" })).items).toEqual([
          resolved,
        ]);
        expect(JSON.stringify(resolved)).not.toMatch(
          /statement|author|solution|trace|fixtures|answer/,
        );
        await tx.query(
          "UPDATE content.content_version SET status='retired',retired_at=now(),retirement_reason='rights_withdrawn',payload_status='tombstoned' WHERE content_version_id='cnt_6666666666666666'",
        );
        expect(await catalog.resolveProblem("distinct-sql-fixture")).toBeNull();
        expect(
          (
            await tx.query(
              "SELECT problem_version_id FROM content.problem_version WHERE problem_id='pro_6666666666666666'",
            )
          ).rows[0]?.problem_version_id,
        ).toBe("prb_6666666666666666");
        throw rollback;
      }),
    ).rejects.toBe(rollback);
    expect(await repo.resolveProblem("distinct-sql-fixture")).toBeNull();
  });

  it("preflights a distinct typed release, binds reviews to edits and withdraws every public projection", async () => {
    const created = (await commandContent(ctx(0), {
      command: "create",
      idempotencyKey: randomUUID(),
      title: "Synthetic distinct release",
      statement: "Test-only count unmatched markers.",
      rightsHolder: "AlgoCove",
      license: "algocove-original-v1",
    })) as { content: { contentVersionId: string; problemVersionId: string } };
    const id = created.content.contentVersionId;
    const problem = (await readContent(ctx(0), id)).records[0]!.content.problemVersionId;
    const source = pilotIdentity("signal-cancellation")!;
    await pool.query(
      "INSERT INTO learning.problem_concept(problem_version_id,concept_id,rationale,mapped_by) SELECT $1,concept_id,'Synthetic reviewed mapping fixture',$2 FROM learning.problem_concept WHERE problem_version_id=$3",
      [problem, actors[1]!.userId, source.problemVersionId],
    );
    const { pilotReleasePacket } = await import("@algocove/content/learning-release");
    const { validatePilotBundle } = await import("@algocove/content/pilot");
    const { pilotWalkthrough } = await import("@algocove/visualizer");
    const bundle = validatePilotBundle(bundles[3]);
    const packet = { ...pilotReleasePacket(bundle), slug: "synthetic-distinct-release" };
    const walkthrough = pilotWalkthrough({
      schemaVersion: 2,
      provenance: "authored_reference",
      pattern: bundle.pattern,
      ...bundle.trace,
    });
    const write = () =>
      withTransaction(pool, (tx) =>
        new PostgresLearningReleaseRepository(tx).set(ctx(0), {
          versionId: id,
          expectedChecksum: null,
          packet,
          walkthrough,
        }),
      );
    const saved = await write();
    expect(await write()).toEqual(saved);
    const preflight = () =>
      withTransaction(pool, (tx) =>
        new PostgresLearningReleaseRepository(tx).preflight(ctx(1), id),
      );
    expect((await preflight()).issues).toContain("incompatible_language_or_asset_pins");
    await pool.query(
      `INSERT INTO content.problem_language_manifest(manifest_id,problem_version_id,language,starter_template,entry_signature,adapter_id,limits_profile,status)
      SELECT 'man_'||substr(md5($1||language),1,20),$1,language,starter_template,entry_signature,adapter_id,limits_profile,'draft' FROM content.problem_language_manifest WHERE problem_version_id=$2`,
      [problem, source.problemVersionId],
    );
    await pool.query(
      "INSERT INTO content.problem_manifest_fixture(problem_version_id,fixture_id) SELECT $1,fixture_id FROM content.problem_manifest_fixture WHERE problem_version_id=$2",
      [problem, source.problemVersionId],
    );
    expect((await preflight()).issues).toEqual([]);
    expect((await preflight()).manifest?.assets.map((a) => a.role)).toContain("pseudocode");
    expect((await preflight()).manifest?.languages).toHaveLength(6);
    const revision = (await readContent(ctx(1), id)).records[0]!.revision;
    const edited = { ...packet, brief: { ...packet.brief, input: "Test-only amended input" } };
    const next = await withTransaction(pool, (tx) =>
      new PostgresLearningReleaseRepository(tx).set(ctx(0), {
        versionId: id,
        expectedChecksum: saved.checksum,
        packet: edited,
        walkthrough,
      }),
    );
    expect(next.checksum).not.toBe(saved.checksum);
    await expect(
      commandContent(ctx(1), {
        command: "review",
        versionId: id,
        expectedRevision: revision,
        idempotencyKey: randomUUID(),
        kind: "technical",
        decision: "approved",
        notes: "Stale fixture",
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      withTransaction(pool, (tx) =>
        new PostgresLearningReleaseRepository(tx).set(ctx(5), {
          versionId: id,
          expectedChecksum: next.checksum,
          packet,
          walkthrough,
        }),
      ),
    ).rejects.toMatchObject({ status: 403 });
    await standard(1, id, "review", {
      kind: "technical",
      decision: "approved",
      notes: "Synthetic independent technical fixture",
    });
    await standard(2, id, "review", {
      kind: "pedagogical",
      decision: "approved",
      notes: "Synthetic independent pedagogical fixture",
    });
    await standard(3, id, "validate");
    await standard(4, id, "publish");
    const view = await withTransaction(pool, (tx) =>
      new PostgresLearningReleaseRepository(tx).publicView(problem),
    );
    expect(view?.brief.input).toBe(edited.brief.input);
    expect(JSON.stringify(view)).not.toMatch(/"answer"|"hints"|"transfer"/);
    const catalog = new PostgresLearningCatalogRepository(pool);
    expect((await catalog.resolveProblem(packet.slug))?.pattern).toBe("stack");
    await standard(4, id, "retire", { reason: "rights_withdrawn" });
    expect(await catalog.resolveProblem(packet.slug)).toBeNull();
    expect(
      await withTransaction(pool, (tx) =>
        new PostgresLearningReleaseRepository(tx).publicView(problem),
      ),
    ).toBeNull();
  });
  it("reconciles ambiguous source links independently without changing membership or legacy identity", async () => {
    const rollback = Error("destination fixture rollback");
    await expect(
      withTransaction(pool, async (tx) => {
        const source = pilotIdentity("matching-readings")!;
        await tx.query(
          `INSERT INTO content.external_reference(external_reference_id,provider,external_key,title,canonical_url,attribution,url_status,reviewed_by,reviewed_at,author_id)
        VALUES('ref_7777777777777777','blind','synthetic-source','Synthetic source','https://blind75.com/','Synthetic attribution','reviewed',$1,now(),$2),
        ('ref_8888888888888888','top_interview_150','synthetic-solve','Synthetic solve','https://leetcode.com/problems/two-sum/','Synthetic attribution','reviewed',$1,now(),$2)`,
          [actors[1]!.userId, actors[0]!.userId],
        );
        const repo = new PostgresDestinationRepository(tx);
        expect(
          (await repo.pending(ctx(1))).some((r) => r.referenceId === "ref_7777777777777777"),
        ).toBe(true);
        await expect(
          repo.reconcile(ctx(0), {
            referenceId: "ref_7777777777777777",
            expectedVersion: 1,
            solveUrl: "https://leetcode.com/problems/two-sum/",
            notes: "fixture",
          }),
        ).rejects.toMatchObject({ status: 403 });
        const reconciled = await repo.reconcile(ctx(1), {
          referenceId: "ref_7777777777777777",
          expectedVersion: 1,
          solveUrl: "https://leetcode.com/problems/two-sum/",
          notes: "Synthetic manual destination decision",
        });
        const rows = (
          await tx.query(
            "SELECT external_reference_id,destination_id,platform FROM content.reviewed_practice_destination WHERE external_reference_id=ANY($1::text[])",
            [["ref_7777777777777777", "ref_8888888888888888"]],
          )
        ).rows;
        expect(rows).toHaveLength(2);
        expect(new Set(rows.map((r) => r.destination_id))).toEqual(
          new Set([reconciled.destinationId]),
        );
        expect(rows.every((r) => r.platform === "leetcode")).toBe(true);
        expect(
          (
            await tx.query(
              "SELECT provider,canonical_url,version FROM content.external_reference WHERE external_reference_id='ref_7777777777777777'",
            )
          ).rows[0],
        ).toMatchObject({
          provider: "blind",
          canonical_url: "https://blind75.com/",
          version: 2,
        });
        await tx.query(
          "INSERT INTO content.external_collection(collection_id,slug,title) VALUES('col_7777777777777777','canonical-fixture','Canonical fixture')",
        );
        await tx.query(
          "INSERT INTO content.external_collection_membership(collection_id,external_reference_id,ordinal) VALUES('col_7777777777777777','ref_7777777777777777',1),('col_7777777777777777','ref_8888888888888888',2)",
        );
        const collections = new PostgresLearningCollectionRepository(tx);
        expect((await collections.get("col_7777777777777777")).items.map((r) => r.ordinal)).toEqual(
          [1, 2],
        );
        expect(
          (await collections.list({ after: null, search: "Canonical fixture", limit: 20 })).items[0]
            ?.total,
        ).toBe(1);
        await tx.query(
          "INSERT INTO practice.external_practice_event(event_id,learner_id,reference_id,kind,idempotency_key,occurred_at) VALUES($1,$2,'ref_7777777777777777','completed','canonical-fixture-completion',now())",
          [ctx(5).ids.generate("event"), actors[5]!.userId],
        );
        const progress = await collections.progress(actors[5]!.userId, "col_7777777777777777");
        expect(progress).toHaveLength(1);
        expect(progress[0]?.selfReport).toBe("completed");
        expect(
          (await collections.progress(actors[0]!.userId, "col_7777777777777777"))[0]?.selfReport,
        ).toBe("unreported");
        expect(source.problemVersionId).toBeTruthy();
        throw rollback;
      }),
    ).rejects.toBe(rollback);
  });
  it("exports only auditable publications with checksums stable after JSONB ordering", async () => {
    const exported = await withTransaction(pool, (tx) =>
      new PostgresPilotRepository(tx).exportPublished(ctx(4)),
    );
    const { loadPublishedPilotCatalog } =
      await import("../../services/execution-host/src/pilot-problem.ts");
    expect(loadPublishedPilotCatalog(exported).size).toBe(4);
    await expect(
      withTransaction(pool, (tx) => new PostgresPilotRepository(tx).exportPublished(ctx(5))),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("starts owned journeys for every bundle/language and charges trace exposure before delivery", async () => {
    const workspace = await import("../../apps/web/app/api/practice/workspace/route");
    const trace = await import("../../apps/web/app/api/practice/trace/route");
    for (const b of bundles)
      for (const language of ["python", "javascript", "typescript", "java", "cpp", "c"]) {
        const response = await workspace.POST(
          new Request("http://localhost/api/practice/workspace", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ problemId: b.slug, language }),
          }),
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.starterTemplate).toBe(b.languages[language].starter);
        expect(body.problem.pilot).toEqual(pilotPublicView(b));
        expect(body.firstHintId).toBe(`hint-pilot-${b.pattern}-1`);
        const pin = (
          await pool.query(
            "SELECT content_version_id,source_checksum FROM practice.attempt_release_pin WHERE attempt_id=$1",
            [body.attempt.attemptId],
          )
        ).rows[0];
        expect(pin?.content_version_id).toBe(pilotIdentity(b.slug)!.contentVersionId);
        expect(pin?.source_checksum).toMatch(/^sha256:/);
        const resumed = await workspace.POST(
          new Request("http://localhost/api/practice/workspace", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              problemId: b.slug,
              language,
              attemptId: body.attempt.attemptId,
            }),
          }),
        );
        expect(resumed.status).toBe(200);
        expect((await resumed.json()).attempt.attemptId).toBe(body.attempt.attemptId);

        const shown = await trace.POST(
          new Request("http://localhost/api/practice/trace", {
            method: "POST",
            body: JSON.stringify({ attemptId: body.attempt.attemptId }),
          }),
        );
        expect(shown.status).toBe(200);
        expect((await shown.json()).trace.pattern).toBe(b.pattern);
        const count = await pool.query(
          "SELECT tier FROM practice.hint_exposure WHERE learner_id=$1 AND problem_version_id=$2",
          [actors[5]!.userId, pilotIdentity(b.slug)!.problemVersionId],
        );
        expect(count.rows.some((r) => r.tier === 4)).toBe(true);
        const contract = await import("../../apps/web/src/practice/pilot-reasoning");
        const revision = {
          ...body.pseudocode,
          problemVersionId: pilotIdentity(b.slug)!.problemVersionId,
          pseudocodeId: body.pseudocode.pseudocodeId,
          revision: 1,
          fields: { structuredAnswers: { pattern: b.review.correctOption } },
        };
        expect(
          (await contract.reasoningContract(pool, revision)).structuredChecks.every(
            (c) => c.passed,
          ),
        ).toBe(true);
        expect(
          (
            await contract.reasoningContract(pool, {
              ...revision,
              fields: { structuredAnswers: { pattern: "incorrect" } },
            })
          ).structuredChecks.every((c) => !c.passed),
        ).toBe(true);
      }
  });
  it("deduplicates overlapping collections and publishes governed external mappings while execution remains gated", async () => {
    const { loadPlanningCatalog } = await import("../../packages/db/src/planning-catalog.ts");
    const { parseRoadmapPreferences } = await import("@algocove/domain");
    await pool.query(
      "INSERT INTO content.external_collection(collection_id,slug,title) VALUES('col_6666666666666666','pilot-overlap-fixture','Synthetic overlap fixture')",
    );
    await pool.query(
      "INSERT INTO content.external_collection_membership(collection_id,external_reference_id) SELECT 'col_6666666666666666',external_reference_id FROM content.external_collection_membership WHERE collection_id='col_5555555555555555'",
    );
    const preferences = parseRoadmapPreferences(
      {
        goal: "Learn reviewed pilot",
        targetRole: "Engineer",
        horizonMonths: 1,
        startDay: "2026-10-06",
        timezone: "UTC",
        dailyCapacityMinutes: 90,
        studyWeekdays: [1, 2, 3, 4, 5],
        preferredLanguages: ["python"],
        collectionIds: ["col_5555555555555555", "col_6666666666666666"],
      },
      ctx(5).now,
    );
    const catalog = () =>
      withTransaction(pool, (tx) =>
        loadPlanningCatalog(tx, actors[5]!.userId, preferences, ctx(5).now),
      );
    expect((await catalog()).units.filter((u) => u.kind === "internal_problem")).toHaveLength(4);
    expect(new Set((await catalog()).units.map((u) => u.key)).size).toBe(8);
    expect(
      (await catalog()).collections.every((c) => c.unavailable === 4 && c.supported === 0),
    ).toBe(true);
    const policies = new PostgresReadinessContentRepository(pool);
    for (const b of bundles) {
      const ids = pilotIdentity(b.slug)!;
      await policies.command(ctx(1), {
        action: "review_reference",
        referenceId: `ref_${ids.key.repeat(16)}`,
        status: "reviewed",
      });
      for (const [i, action] of [
        [1, "technical_review"],
        [2, "pedagogical_review"],
        [4, "publish"],
      ] as const)
        await policies.command(ctx(i), {
          action,
          rubricId: `pilot.${b.pattern}.external.v1`,
          version: 1,
        });
      const attempt = (
        await pool.query(
          "SELECT attempt_id FROM practice.attempt WHERE learner_id=$1 AND problem_version_id=$2 ORDER BY started_at DESC LIMIT 1",
          [actors[5]!.userId, ids.problemVersionId],
        )
      ).rows[0];
      const view = await new PostgresExternalCompanionRepository(pool).view(
        attempt.attempt_id,
        actors[5]!.userId,
      );
      expect(view.reference?.relation).toBe(
        ["two-pointers", "stack"].includes(b.pattern) ? "transfer" : "same_pattern",
      );
      expect(view.decision.status).toBe("not_ready");
      expect(view.reference?.url).toBeNull();
      expect(JSON.stringify(view.questions)).not.toContain('"answer"');
    }
    expect(
      (await catalog()).collections.every(
        (c) => c.supported === 4 && c.externalOnly === 0 && c.unavailable === 0,
      ),
    ).toBe(true);
    expect((await catalog()).units.filter((u) => u.kind === "internal_problem")).toHaveLength(4);
    expect((await catalog()).fullCoverage).toBe(false);
  });
});

// Runs after the curriculum journeys and exercises actual populated history.
describe("Phase 11 populated pilot privacy purge", () => {
  it("removes all owned pilot attempts, drafts, pins, observations and journal state while preserving published content", async () => {
    const repo = new PostgresPrivacyRepository(pool);
    const admin = createPool({
      connectionString: target.toString(),
      applicationName: "pilot-privacy-owner",
      maxConnections: 1,
      statementTimeoutMs: 10000,
    });
    try {
      await admin.query(
        "UPDATE practice.draft_revision SET saved_at=clock_timestamp()-interval '8 days',expires_at=clock_timestamp()-interval '1 day' WHERE learner_id=$1",
        [actors[5]!.userId],
      );
      await admin.query(
        "UPDATE practice.draft SET updated_at=clock_timestamp()-interval '8 days',expires_at=clock_timestamp()-interval '1 day' WHERE learner_id=$1",
        [actors[5]!.userId],
      );
      await admin.query(
        "INSERT INTO platform.privacy_hold(learner_id,reason_code,placed_at,expires_at) VALUES($1,'security',clock_timestamp(),clock_timestamp()+interval '1 hour')",
        [actors[5]!.userId],
      );
      await admin.query("SELECT platform.apply_privacy_retention(100)");
      expect(
        (await admin.query("SELECT 1 FROM practice.draft WHERE learner_id=$1", [actors[5]!.userId]))
          .rowCount,
      ).toBeGreaterThan(0);
      await admin.query("DELETE FROM platform.privacy_hold WHERE learner_id=$1", [
        actors[5]!.userId,
      ]);
      const retention = (
        await admin.query("SELECT platform.apply_privacy_retention(100) AS result")
      ).rows[0].result;
      expect(retention.expiredDrafts).toBeGreaterThan(0);
      expect(
        (await admin.query("SELECT 1 FROM practice.draft WHERE learner_id=$1", [actors[5]!.userId]))
          .rowCount,
      ).toBe(0);
      const receipt = await repo.requestDeletion(ctx(5));
      const token = "populated-pilot-privacy-lease";
      await admin.query("SELECT platform.claim_privacy_deletion($1)", [token]);
      // Existing runs in this fixture never leave PostgreSQL; the separate privacy
      // integration case verifies interruption and the cancellation adapter boundary.
      await admin.query(
        "UPDATE platform.privacy_cancellation SET confirmed_at=clock_timestamp() WHERE request_id=$1",
        [receipt.requestId],
      );
      expect(
        (
          await admin.query("SELECT platform.complete_privacy_deletion($1,$2) AS result", [
            receipt.requestId,
            token,
          ])
        ).rows[0].result.activePrivateReferences,
      ).toBe(0);
      expect(
        (
          await pool.query("SELECT count(*)::int AS n FROM practice.attempt WHERE learner_id=$1", [
            actors[5]!.userId,
          ])
        ).rows[0].n,
      ).toBe(0);
      expect(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM content.content_version WHERE status='published'",
          )
        ).rows[0].n,
      ).toBeGreaterThanOrEqual(4);
    } finally {
      await admin.end();
    }
  });
});
