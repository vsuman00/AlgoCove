import { loadLocalEnvFile } from "../../../packages/db/src/cli/cli-support.ts";
import { createPool } from "@algocove/db";
import { createHttpExecutionRelay } from "../../../apps/web/src/adapters/execution-client.ts";
import { localPrivacyDeletionLedger } from "./jobs/privacy-ledger.ts";
import { processPrivacyDeletion } from "./jobs/privacy.ts";
async function main() {
  loadLocalEnvFile();
  const url = process.env.PRIVACY_WORKER_DATABASE_URL;
  if (!url) throw Error("Dedicated privacy worker connection required.");
  const pool = createPool({
    connectionString: url,
    applicationName: "algocove-privacy-worker",
    maxConnections: 2,
    statementTimeoutMs: 10000,
  });
  const relay =
    process.env.EXECUTION_RELAY_URL && process.env.EXECUTION_RELAY_TOKEN
      ? createHttpExecutionRelay({
          baseUrl: process.env.EXECUTION_RELAY_URL,
          token: process.env.EXECUTION_RELAY_TOKEN,
        })
      : null;
  try {
    await pool.query(
      "INSERT INTO platform.service_heartbeat(service,observed_at) VALUES('privacy-worker',clock_timestamp()) ON CONFLICT(service) DO UPDATE SET observed_at=EXCLUDED.observed_at",
    );
    const result = await processPrivacyDeletion(
      pool,
      relay,
      localPrivacyDeletionLedger(
        process.env.PRIVACY_DELETION_LEDGER ?? ".tmp/privacy-deletion-ledger/events.jsonl",
      ),
    );
    if (process.argv.includes("--retention"))
      await pool.query("SELECT platform.apply_privacy_retention(100)");
    process.stdout.write(JSON.stringify(result) + "\n");
  } finally {
    await pool.end();
  }
}
await main().catch(() => {
  process.stderr.write(JSON.stringify({ event: "privacy.worker_failed", retryable: true }) + "\n");
  process.exitCode = 1;
});
