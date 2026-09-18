import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  bootstrapDatabase,
  createPool,
  migrate,
  PostgresIdentityRepository,
  PostgresOutboxRelayRepository,
  PostgresPlatformRepository,
  probeDatabase,
  readMigrationState,
  withTransaction,
  type DatabaseConnection,
} from "@algocove/db";
import { createAuditEvent, createOutboxEvent } from "@algocove/application";
import {
  formatId,
  parseContentChecksum,
  parseInstant,
  parseLearnerProfileInput,
} from "@algocove/domain";

const baseOperatorUrl =
  process.env.DATABASE_TEST_OPERATOR_URL ??
  process.env.DATABASE_ADMIN_URL ??
  "postgres://postgres:postgres@127.0.0.1:54329/algocove";
const runSuffix = `${process.pid}_${Date.now()}`;
const databaseName = `algocove_test_${runSuffix}`;
const migrationRole = `algocove_mig_${runSuffix}`;
const runtimeRole = `algocove_run_${runSuffix}`;
const migrationPassword = `migration_${randomUUID()}`;
const runtimePassword = `runtime_${randomUUID()}`;

function connectionForDatabase(connectionString: string, database: string): string {
  const url = new URL(connectionString);
  url.pathname = `/${database}`;
  return url.toString();
}

function profile(
  connectionString: string,
  applicationName: string,
  maxConnections = 2,
): DatabaseConnection {
  return {
    connectionString,
    applicationName,
    maxConnections,
    statementTimeoutMs: 5_000,
  };
}

function testPool(connection: DatabaseConnection): ReturnType<typeof createPool> {
  const pool = createPool(connection);
  // PostgreSQL may report 57P01 asynchronously when the isolated database is
  // dropped during teardown. Query failures still reject at their call site;
  // this handler only prevents an idle-client teardown event from becoming an
  // unhandled Vitest error after all assertions have passed.
  pool.on("error", () => undefined);
  return pool;
}

const operatorUrl = connectionForDatabase(baseOperatorUrl, "postgres");
const databaseUrl = connectionForDatabase(baseOperatorUrl, databaseName);
const migrationUrl = `postgres://${migrationRole}:${encodeURIComponent(migrationPassword)}@${
  new URL(databaseUrl).host
}/${databaseName}`;
const runtimeUrl = `postgres://${runtimeRole}:${encodeURIComponent(runtimePassword)}@${
  new URL(databaseUrl).host
}/${databaseName}`;

let operatorPool: ReturnType<typeof createPool> | undefined;
let inspectionPool: ReturnType<typeof createPool> | undefined;
let runtimePool: ReturnType<typeof createPool> | undefined;

describe("PostgreSQL and pgvector lifecycle", () => {
  beforeAll(async () => {
    operatorPool = testPool(profile(operatorUrl, "algocove-integration-operator", 1));
    await operatorPool.query(`CREATE DATABASE "${databaseName}"`);

    await bootstrapDatabase({
      operatorConnectionString: databaseUrl,
      migrationRole: { name: migrationRole, password: migrationPassword },
      runtimeRole: { name: runtimeRole, password: runtimePassword },
      logger: { info: () => undefined },
    });
    inspectionPool = testPool(profile(databaseUrl, "algocove-integration-inspection"));

    const migrationResult = await migrate({
      connectionString: migrationUrl,
      applicationName: "algocove-integration-migrate",
      logger: { info: () => undefined },
    });
    expect(migrationResult.applied).toEqual([
      "0001_platform.sql",
      "0002_identity.sql",
      "0003_roles.sql",
      "0004_platform_primitives.sql",
      "0005_curriculum.sql",
      "0006_content.sql",
      "0007_language_manifests.sql",
      "0008_external_references.sql",
      "0009_outbox_claims.sql",
      "0010_practice.sql",
      "0011_code_runs.sql",
      "0012_practice_drafts.sql",
      "0013_pseudocode.sql",
      "0014_hints.sql",
      "0015_practice_workspace_uniqueness.sql",
      "0016_code_run_terminal_state.sql",
    ]);

    runtimePool = testPool(profile(runtimeUrl, "algocove-integration-runtime"));
  });

  afterAll(async () => {
    await runtimePool?.end();
    await inspectionPool?.end();
    await operatorPool?.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await operatorPool?.query(`DROP ROLE IF EXISTS "${migrationRole}"`);
    await operatorPool?.query(`DROP ROLE IF EXISTS "${runtimeRole}"`);
    await operatorPool?.end();
  });

  it("installs the vector extension and owns the platform schema with the migration role", async () => {
    const result = await inspectionPool!.query<{
      extension_name: string;
      schema_owner: string;
      table_owner: string;
    }>(
      `SELECT
         (SELECT extname FROM pg_extension WHERE extname = 'vector') AS extension_name,
         (SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname = 'platform') AS schema_owner,
         (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE relname = 'schema_migration') AS table_owner`,
    );

    expect(result.rows[0]).toEqual({
      extension_name: "vector",
      schema_owner: migrationRole,
      table_owner: migrationRole,
    });
  });

  it("applies migrations idempotently and records immutable checksums", async () => {
    const result = await migrate({
      connectionString: migrationUrl,
      applicationName: "algocove-integration-rerun",
      logger: { info: () => undefined },
    });
    const state = await readMigrationState(profile(migrationUrl, "algocove-integration-state"));

    expect(result).toEqual({
      applied: [],
      skipped: [
        "0001_platform.sql",
        "0002_identity.sql",
        "0003_roles.sql",
        "0004_platform_primitives.sql",
        "0005_curriculum.sql",
        "0006_content.sql",
        "0007_language_manifests.sql",
        "0008_external_references.sql",
        "0009_outbox_claims.sql",
        "0010_practice.sql",
        "0011_code_runs.sql",
        "0012_practice_drafts.sql",
        "0013_pseudocode.sql",
        "0014_hints.sql",
        "0015_practice_workspace_uniqueness.sql",
        "0016_code_run_terminal_state.sql",
      ],
      appliedCount: 0,
    });
    expect(state).toHaveLength(16);
    expect(state[0]).toMatchObject({ id: "0001", name: "0001_platform.sql" });
    expect(state[0]?.checksum).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("lets the runtime role read bounded readiness data", async () => {
    const readiness = await probeDatabase(profile(runtimeUrl, "algocove-integration-probe", 1));

    expect(readiness.ok).toBe(true);
    if (readiness.ok) {
      expect(readiness.appliedMigrations).toBe(16);
      expect(readiness.serverTime).toMatch(/Z$/);
    }
  });

  it("prevents the runtime role from changing schema or migration bookkeeping", async () => {
    await expect(
      runtimePool!.query("CREATE TABLE platform.runtime_must_not_create(id integer)"),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      runtimePool!.query(
        "INSERT INTO platform.schema_migration(migration_id, name, checksum, duration_ms) VALUES ('9999', 'forbidden', 'sha256:forbidden', 0)",
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("rolls back failed transactions and leaves the runtime connection usable", async () => {
    await expect(
      withTransaction(runtimePool!, async (transaction) => {
        await transaction.query("SELECT 1");
        throw new Error("intentional rollback");
      }),
    ).rejects.toThrow("intentional rollback");

    const result = await runtimePool!.query<{ ok: boolean }>("SELECT true AS ok");
    expect(result.rows[0]?.ok).toBe(true);
  });

  it("persists Clerk identity, server roles, and an optimistic learner profile", async () => {
    const identity = new PostgresIdentityRepository(runtimePool!);
    const learnerId = await identity.findOrCreateLearner(`clerk:integration-${runSuffix}`);
    expect(await identity.getRoles(learnerId)).toEqual(["learner"]);

    const input = parseLearnerProfileInput({
      goal: "Prepare for an algorithms interview",
      targetRole: "software engineer",
      timezone: "Asia/Kolkata",
      dailyCapacityMinutes: 45,
      horizonDays: 30,
      accessibility: { reducedMotion: true, highContrast: false, screenReader: false },
      preferredLanguages: ["python", "typescript"],
    });
    const instant = parseInstant("2026-09-17T10:00:00.000Z");
    if (!input.ok || !instant.ok) throw new Error("database profile fixture is invalid");
    const created = await identity.create({
      ...input.value,
      learnerId,
      version: 1,
      createdAt: instant.value,
      updatedAt: instant.value,
      updatedBy: learnerId,
    });
    expect(created.version).toBe(1);
    expect((await identity.get(learnerId))?.goal).toBe(input.value.goal);

    const updated = await identity.update({
      learnerId,
      expectedVersion: 1,
      profile: { ...created, goal: "Build durable DSA intuition", version: 2 },
    });
    expect(updated).toMatchObject({ version: 2, goal: "Build durable DSA intuition" });
    await expect(
      identity.update({
        learnerId,
        expectedVersion: 1,
        profile: { ...created, goal: "stale write", version: 2 },
      }),
    ).resolves.toBeNull();
  });

  it("replays idempotent effects and persists immutable audit plus outbox records", async () => {
    const identity = new PostgresIdentityRepository(runtimePool!);
    const learnerId = await identity.findOrCreateLearner(`clerk:platform-${runSuffix}`);
    const platform = new PostgresPlatformRepository(runtimePool!);
    const checksum = parseContentChecksum(`sha256:${"c".repeat(64)}`);
    const instant = parseInstant("2026-09-17T10:00:00.000Z");
    const eventId = formatId("event", "0000000000000000");
    const outboxEventId = formatId("event", "0000000000000001");
    if (!checksum.ok || !instant.ok || !eventId.ok || !outboxEventId.ok)
      throw new Error("platform fixture is invalid");

    const claim = { scope: "integration", key: `effect-${runSuffix}`, requestHash: checksum.value };
    expect(await platform.claim(claim)).toEqual({ kind: "claimed" });
    await platform.complete({ ...claim, response: { status: 200, body: { ok: true } } });
    expect(await platform.claim(claim)).toEqual({
      kind: "replay",
      response: { status: 200, body: { ok: true } },
    });

    await platform.append(
      createAuditEvent({
        eventId: eventId.value,
        actorId: learnerId,
        action: "integration.checked",
        resourceType: "learner",
        resourceId: learnerId,
        occurredAt: instant.value,
        payload: { outcome: "accepted", code: "must not persist" },
      }),
    );
    await platform.enqueue(
      createOutboxEvent({
        eventId: outboxEventId.value,
        topic: "integration.checked",
        aggregateId: learnerId,
        occurredAt: instant.value,
        payload: { outcome: "accepted", prompt: "must not persist" },
      }),
    );

    const counts = await inspectionPool!.query<{ audit_count: string; outbox_count: string }>(
      `SELECT
         (SELECT count(*)::text FROM platform.audit_event WHERE event_id = $1) AS audit_count,
         (SELECT count(*)::text FROM platform.outbox_event WHERE event_id = $2) AS outbox_count`,
      [eventId.value, outboxEventId.value],
    );
    expect(counts.rows[0]).toEqual({ audit_count: "1", outbox_count: "1" });
    const auditPayload = await inspectionPool!.query<{
      payload: { code?: string; outcome?: string };
    }>("SELECT payload FROM platform.audit_event WHERE event_id = $1", [eventId.value]);
    expect(auditPayload.rows[0]?.payload).toEqual({ code: "[redacted]", outcome: "accepted" });
    await expect(
      runtimePool!.query(
        "UPDATE platform.audit_event SET action = 'tampered' WHERE event_id = $1",
        [eventId.value],
      ),
    ).rejects.toMatchObject({ code: "55006" });
  });

  it("deduplicates concurrent claims and rolls back outbox work atomically", async () => {
    const platform = new PostgresPlatformRepository(runtimePool!);
    const checksum = parseContentChecksum(`sha256:${"d".repeat(64)}`);
    const instant = parseInstant("2026-09-17T10:00:00.000Z");
    const eventId = formatId("event", "0000000000000002");
    if (!checksum.ok || !instant.ok || !eventId.ok)
      throw new Error("concurrency fixture is invalid");
    const claim = {
      scope: "integration-concurrent",
      key: `effect-${runSuffix}`,
      requestHash: checksum.value,
    };
    const results = await Promise.all([platform.claim(claim), platform.claim(claim)]);
    expect(results.map((result) => result.kind).sort()).toEqual(["claimed", "in_progress"]);
    await platform.complete({ ...claim, response: { status: 204, body: { ok: true } } });

    const rollbackEvent = createOutboxEvent({
      eventId: eventId.value,
      topic: "integration.rollback",
      aggregateId: "aggregate-integration",
      occurredAt: instant.value,
      payload: { outcome: "should_rollback" },
    });
    await expect(
      withTransaction(runtimePool!, async (transaction) => {
        await new PostgresPlatformRepository(transaction).enqueue(rollbackEvent);
        throw new Error("intentional outbox rollback");
      }),
    ).rejects.toThrow("intentional outbox rollback");
    const rolledBack = await inspectionPool!.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM platform.outbox_event WHERE event_id = $1",
      [eventId.value],
    );
    expect(rolledBack.rows[0]?.count).toBe("0");
  });

  it("claims execution dispatches with a lease and supports retry release", async () => {
    const platform = new PostgresPlatformRepository(runtimePool!);
    const relay = new PostgresOutboxRelayRepository(runtimePool!);
    const checksum = parseContentChecksum(`sha256:${"e".repeat(64)}`);
    const instant = parseInstant("2026-09-17T10:00:00.000Z");
    const eventId = formatId("event", "0000000000000003");
    if (!checksum.ok || !instant.ok || !eventId.ok) throw new Error("relay fixture is invalid");
    await platform.enqueue(
      createOutboxEvent({
        eventId: eventId.value,
        topic: "execution.run.requested",
        aggregateId: "run_aaaaaaaaaaaaaaaa",
        occurredAt: instant.value,
        payload: {
          topic: "execution.run.requested",
          dispatchKey: "dispatch-integration",
          descriptorDigest: checksum.value,
        },
      }),
    );
    // Use the database clock after PostgreSQL has assigned the row's
    // database-default available_at. The relay compares against a database
    // timestamp, so using the same clock avoids a false negative when the
    // application host is slightly behind PostgreSQL.
    const clock = await runtimePool!.query<{ now: string }>(
      "SELECT clock_timestamp()::text AS now",
    );
    const relayNow = clock.rows[0]!.now;
    const retryAt = new Date(Date.parse(relayNow) + 2_000).toISOString();

    const first = await relay.claimNext({
      topic: "execution.run.requested",
      relayId: "relay-integration-a",
      now: relayNow,
      leaseDurationMs: 5_000,
    });
    expect(first).toMatchObject({
      eventId: eventId.value,
      attempts: 1,
      payload: { descriptorDigest: checksum.value },
    });
    await expect(
      relay.claimNext({
        topic: "execution.run.requested",
        relayId: "relay-integration-b",
        now: relayNow,
        leaseDurationMs: 5_000,
      }),
    ).resolves.toBeNull();

    await relay.retry({
      eventId: eventId.value,
      relayId: "relay-integration-a",
      availableAt: retryAt,
    });
    await expect(
      relay.claimNext({
        topic: "execution.run.requested",
        relayId: "relay-integration-b",
        now: relayNow,
        leaseDurationMs: 5_000,
      }),
    ).resolves.toBeNull();
    const retried = await relay.claimNext({
      topic: "execution.run.requested",
      relayId: "relay-integration-b",
      now: retryAt,
      leaseDurationMs: 5_000,
    });
    expect(retried?.attempts).toBe(2);
    await relay.acknowledge({ eventId: eventId.value, relayId: "relay-integration-b" });
  });

  it("pins curriculum graph rows and blocks mutation after publication", async () => {
    const conceptA = "cpt_aaaaaaaaaaaaaaaa";
    const conceptB = "cpt_bbbbbbbbbbbbbbbb";
    const versionId = "cur_cccccccccccccccc";
    await runtimePool!.query(
      `INSERT INTO learning.concept (concept_id, slug, title, summary)
       VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)`,
      [
        conceptA,
        "arrays",
        "Arrays",
        "A collection concept.",
        conceptB,
        "hashing",
        "Hashing",
        "A lookup concept.",
      ],
    );
    await runtimePool!.query(
      `INSERT INTO learning.curriculum_graph_version
        (curriculum_version_id, version_number, status, published_at)
       VALUES ($1, 1, 'draft', NULL)`,
      [versionId],
    );
    await runtimePool!.query(
      `INSERT INTO learning.curriculum_node
        (curriculum_version_id, concept_id, objective, ordinal)
       VALUES ($1, $2, $3, 0), ($1, $4, $5, 1)`,
      [versionId, conceptA, "Explain arrays", conceptB, "Explain hashing"],
    );
    await runtimePool!.query(
      `INSERT INTO learning.curriculum_edge
        (curriculum_version_id, from_concept_id, to_concept_id, edge_kind)
       VALUES ($1, $2, $3, 'required')`,
      [versionId, conceptA, conceptB],
    );
    await runtimePool!.query(
      `UPDATE learning.curriculum_graph_version
          SET status = 'published', published_at = now()
        WHERE curriculum_version_id = $1`,
      [versionId],
    );

    await expect(
      runtimePool!.query(
        "UPDATE learning.curriculum_node SET objective = 'tampered' WHERE curriculum_version_id = $1",
        [versionId],
      ),
    ).rejects.toMatchObject({ code: "55006" });
    const pinned = await inspectionPool!.query<{ status: string; edge_kind: string }>(
      `SELECT version.status, edge.edge_kind
         FROM learning.curriculum_graph_version AS version
         JOIN learning.curriculum_edge AS edge
           ON edge.curriculum_version_id = version.curriculum_version_id
        WHERE version.curriculum_version_id = $1`,
      [versionId],
    );
    expect(pinned.rows[0]).toEqual({ status: "published", edge_kind: "required" });
  });

  it("stores original problem metadata and blocks published payload mutation", async () => {
    const author = "usr_aaaaaaaaaaaaaaaa";
    await runtimePool!.query("INSERT INTO platform.learner (learner_id) VALUES ($1)", [author]);
    await runtimePool!.query(
      `INSERT INTO content.content_item (content_id, content_kind)
       VALUES ('con_aaaaaaaaaaaaaaaa', 'problem')`,
    );
    await runtimePool!.query(
      `INSERT INTO content.problem (problem_id, content_id)
       VALUES ('pro_bbbbbbbbbbbbbbbb', 'con_aaaaaaaaaaaaaaaa')`,
    );
    await runtimePool!.query(
      `INSERT INTO content.content_version
        (content_version_id, content_id, title, checksum, provenance_kind,
         rights_holder, license, source_url, author_id, status, payload_status, published_at)
       VALUES ('cnt_cccccccccccccccc', 'con_aaaaaaaaaaaaaaaa', 'Original pair sum', $1,
               'original', 'AlgoCove', 'algocove-original-v1', NULL, $2,
               'draft', 'available', NULL)`,
      [`sha256:${"a".repeat(64)}`, author],
    );
    await runtimePool!.query(
      `INSERT INTO content.problem_version
        (problem_version_id, problem_id, content_version_id, statement)
       VALUES ('prb_dddddddddddddddd', 'pro_bbbbbbbbbbbbbbbb', 'cnt_cccccccccccccccc', $1)`,
      ["An original problem statement."],
    );
    await runtimePool!.query(
      `UPDATE content.content_version
          SET status = 'published', published_at = now()
        WHERE content_version_id = 'cnt_cccccccccccccccc'`,
    );
    await expect(
      runtimePool!.query(
        "UPDATE content.problem_version SET statement = 'tampered' WHERE content_version_id = 'cnt_cccccccccccccccc'",
      ),
    ).rejects.toMatchObject({ code: "55006" });
    const metadata = await inspectionPool!.query<{ title: string; statement: string }>(
      `SELECT version.title, problem.statement
         FROM content.content_version AS version
         JOIN content.problem_version AS problem
           ON problem.content_version_id = version.content_version_id
        WHERE version.content_version_id = 'cnt_cccccccccccccccc'`,
    );
    expect(metadata.rows[0]).toEqual({
      title: "Original pair sum",
      statement: "An original problem statement.",
    });
  });

  it("installs six distinct language profiles and protects published manifests", async () => {
    const profiles = await inspectionPool!.query<{
      language: string;
      adapter_id: string;
      runtime_family: string;
    }>(
      "SELECT language, adapter_id, runtime_family FROM content.language_profile ORDER BY language",
    );
    expect(profiles.rows).toHaveLength(6);
    expect(profiles.rows.map((row) => row.language)).toEqual([
      "c",
      "cpp",
      "java",
      "javascript",
      "python",
      "typescript",
    ]);
    expect(new Set(profiles.rows.map((row) => row.adapter_id)).size).toBe(6);
    expect(profiles.rows.find((row) => row.language === "c")?.runtime_family).not.toBe(
      profiles.rows.find((row) => row.language === "cpp")?.runtime_family,
    );
    await expect(
      runtimePool!.query(
        `INSERT INTO content.problem_language_manifest
          (manifest_id, problem_version_id, language, starter_template,
           entry_signature, adapter_id, limits_profile, status)
         VALUES ('man_eeeeeeeeeeeeeeee', 'prb_dddddddddddddddd', 'python',
                 'solve(input)', 'solve(input)', 'harness.python',
                 '{"runTimeoutMs":2000}', 'published')`,
      ),
    ).rejects.toMatchObject({ code: "55006" });
  });

  it("deduplicates reviewed external references across collections and rejects lookalike hosts", async () => {
    const reviewer = "usr_aaaaaaaaaaaaaaaa";
    await runtimePool!.query(
      `INSERT INTO content.external_reference
        (external_reference_id, provider, external_key, title, canonical_url,
         attribution, url_status, reviewed_by, reviewed_at)
       VALUES ('ref_aaaaaaaaaaaaaaaa', 'blind', 'two-sum', 'Two Sum',
               'https://blind75.com/problems/two-sum', 'Blind 75',
               'unreviewed', NULL, NULL)`,
    );
    await runtimePool!.query(
      `UPDATE content.external_reference
          SET url_status = 'reviewed', reviewed_by = $1, reviewed_at = now(), version = 2
        WHERE external_reference_id = 'ref_aaaaaaaaaaaaaaaa'`,
      [reviewer],
    );
    await runtimePool!.query(
      `INSERT INTO content.external_collection (collection_id, slug, title)
       VALUES ('col_bbbbbbbbbbbbbbbb', 'blind-75', 'Blind 75'),
              ('col_cccccccccccccccc', 'interview-overlap', 'Interview overlap')`,
    );
    await runtimePool!.query(
      `INSERT INTO content.external_collection_membership
        (collection_id, external_reference_id, ordinal)
       VALUES ('col_bbbbbbbbbbbbbbbb', 'ref_aaaaaaaaaaaaaaaa', 1),
              ('col_cccccccccccccccc', 'ref_aaaaaaaaaaaaaaaa', 4)`,
    );
    await expect(
      runtimePool!.query(
        `INSERT INTO content.external_collection_membership
          (collection_id, external_reference_id, ordinal)
         VALUES ('col_bbbbbbbbbbbbbbbb', 'ref_aaaaaaaaaaaaaaaa', 2)`,
      ),
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      runtimePool!.query(
        `INSERT INTO content.external_reference
          (external_reference_id, provider, external_key, title, canonical_url,
           attribution, url_status)
         VALUES ('ref_dddddddddddddddd', 'blind', 'evil', 'Evil',
                 'https://blind75.com.evil.test/problem', 'Unknown', 'unreviewed')`,
      ),
    ).rejects.toMatchObject({ code: "23514" });
    const memberships = await inspectionPool!.query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM content.external_collection_membership
        WHERE external_reference_id = 'ref_aaaaaaaaaaaaaaaa'`,
    );
    expect(memberships.rows[0]?.count).toBe("2");
  });
});
