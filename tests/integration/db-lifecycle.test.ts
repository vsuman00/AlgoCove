import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  bootstrapDatabase,
  createPool,
  migrate,
  probeDatabase,
  readMigrationState,
  withTransaction,
  type DatabaseConnection,
} from "@algocove/db";

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
    operatorPool = createPool(profile(operatorUrl, "algocove-integration-operator", 1));
    await operatorPool.query(`CREATE DATABASE "${databaseName}"`);

    await bootstrapDatabase({
      operatorConnectionString: databaseUrl,
      migrationRole: { name: migrationRole, password: migrationPassword },
      runtimeRole: { name: runtimeRole, password: runtimePassword },
      logger: { info: () => undefined },
    });
    inspectionPool = createPool(profile(databaseUrl, "algocove-integration-inspection"));

    const migrationResult = await migrate({
      connectionString: migrationUrl,
      applicationName: "algocove-integration-migrate",
      logger: { info: () => undefined },
    });
    expect(migrationResult.applied).toEqual(["0001_platform.sql"]);

    runtimePool = createPool(profile(runtimeUrl, "algocove-integration-runtime"));
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
      skipped: ["0001_platform.sql"],
      appliedCount: 0,
    });
    expect(state).toHaveLength(1);
    expect(state[0]).toMatchObject({ id: "0001", name: "0001_platform.sql" });
    expect(state[0]?.checksum).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("lets the runtime role read bounded readiness data", async () => {
    const readiness = await probeDatabase(profile(runtimeUrl, "algocove-integration-probe", 1));

    expect(readiness.ok).toBe(true);
    if (readiness.ok) {
      expect(readiness.appliedMigrations).toBe(1);
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
});
