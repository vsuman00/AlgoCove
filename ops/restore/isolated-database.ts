import { randomUUID } from "node:crypto";
import { setTimeout as pause } from "node:timers/promises";
import { bootstrapDatabase, createPool, migrate } from "../../packages/db/src/index.ts";
import type { Pool } from "pg";
export type IsolatedDatabase = {
  databaseName: string;
  migrationRole: string;
  runtimeRole: string;
  operatorUrl: string;
  databaseUrl: string;
  migrationUrl: string;
  runtimeUrl: string;
  runtime: Pool;
  inspection: Pool;
  owner: Pool;
  cleanup: () => Promise<void>;
};

/** Creates only uniquely named synthetic drill/test resources; never uses the application DB. */
export async function createIsolatedDatabase(
  operatorConnection: string,
): Promise<IsolatedDatabase> {
  const suffix = `${process.pid}_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const databaseName = `algocove_drill_${suffix}`;
  const migrationRole = `ac_drill_mig_${suffix}`;
  const runtimeRole = `ac_drill_run_${suffix}`;
  const operatorUrl = new URL(operatorConnection);
  operatorUrl.pathname = "/postgres";
  const target = new URL(operatorUrl);
  target.pathname = `/${databaseName}`;
  const migrationUrl = new URL(target);
  migrationUrl.username = migrationRole;
  migrationUrl.password = randomUUID();
  const runtimeUrl = new URL(target);
  runtimeUrl.username = runtimeRole;
  runtimeUrl.password = randomUUID();
  const poolFor = (connectionString: string) =>
    createPool({
      connectionString,
      applicationName: "phase11-isolated",
      maxConnections: 3,
      statementTimeoutMs: 10000,
    });
  const operator = poolFor(operatorUrl.toString());
  const runtime = poolFor(runtimeUrl.toString());
  const inspection = poolFor(target.toString());
  const owner = poolFor(migrationUrl.toString());
  const cleanup = async () => {
    await Promise.all([runtime.end(), inspection.end(), owner.end()]);
    try {
      // Pool.end() can resolve before PostgreSQL observes every socket closing.
      // Wait for that acknowledgement; FORCE can emit a late FATAL on an ending
      // client, which becomes an unhandled error and can expose driver internals.
      for (let retry = 0; retry < 50; retry++) {
        const connections = await operator.query<{ count: string }>(
          "SELECT count(*)::text AS count FROM pg_stat_activity WHERE datname=$1",
          [databaseName],
        );
        if (connections.rows[0]?.count === "0") break;
        if (retry === 49) throw new Error("Isolated database still has active connections");
        await pause(100);
      }
      await operator.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      await operator.query(`DROP ROLE IF EXISTS "${runtimeRole}"`);
      await operator.query(`DROP ROLE IF EXISTS "${migrationRole}"`);
    } finally {
      await operator.end();
    }
  };
  try {
    await operator.query(`CREATE DATABASE "${databaseName}"`);
    await bootstrapDatabase({
      operatorConnectionString: target.toString(),
      migrationRole: { name: migrationRole, password: migrationUrl.password },
      runtimeRole: { name: runtimeRole, password: runtimeUrl.password },
    });
    await migrate({ connectionString: migrationUrl.toString() });
    return {
      databaseName,
      migrationRole,
      runtimeRole,
      operatorUrl: operatorUrl.toString(),
      databaseUrl: target.toString(),
      migrationUrl: migrationUrl.toString(),
      runtimeUrl: runtimeUrl.toString(),
      runtime,
      inspection,
      owner,
      cleanup,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
