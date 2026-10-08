import { loadLocalEnvFile } from "../../packages/db/src/cli/cli-support.ts";
import { randomBytes } from "node:crypto";
import { createPool, PostgresOperationalRepository } from "../../packages/db/src/index.ts";
import {
  OPERATIONS,
  calculateSlo,
  evaluateOperationalAlerts,
} from "../../packages/observability/src/telemetry.ts";
async function main(): Promise<void> {
  loadLocalEnvFile();
  const url = process.env.DATABASE_URL;
  if (!url) throw Error("Database runtime configuration required.");
  const pool = createPool({
    connectionString: url,
    applicationName: "algocove-alert-check",
    maxConnections: 1,
    statementTimeoutMs: 2000,
  });
  try {
    const repository = new PostgresOperationalRepository(pool),
      started = performance.now();
    await pool.query("SELECT 1");
    const id = `req_${randomBytes(16).toString("hex")}`;
    await repository.record({
      operation: "database",
      outcome: "success",
      durationMs: Math.round(performance.now() - started),
      requestId: id,
      traceId: id,
      observedAt: new Date().toISOString(),
    });
    const snapshot = await repository.snapshot(),
      now = Date.now();
    const alerts = evaluateOperationalAlerts({
      ...snapshot,
      now,
      workerEnabled: process.env.WORKER_CONTENT_ENABLED === "true",
    });
    process.stdout.write(
      JSON.stringify({
        policy: "local-operational-targets.v1",
        observedAt: new Date(now).toISOString(),
        slo: Object.fromEntries(
          OPERATIONS.map((op) => [op, calculateSlo(snapshot.samples, op, now, 3600000)]),
        ),
        alerts,
        privacy: snapshot.privacy,
        learning: snapshot.learning,
        truncated: snapshot.truncated,
      }) + "\n",
    );
    if (alerts.length || snapshot.truncated) process.exitCode = 2;
  } finally {
    await pool.end();
  }
}
await main().catch(() => {
  process.stderr.write(
    JSON.stringify({
      event: "operations.database_unavailable",
      owner: "platform-operator",
      severity: "page",
      runbook: "ops/runbooks/service-degradation.md",
      action: "Keep private admission blocked; recover the database and verify readiness.",
    }) + "\n",
  );
  process.exitCode = 2;
});
