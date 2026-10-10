import { assertHostedWebEnvironment, ConfigError } from "../../../packages/config/src/index.ts";
import { createPool } from "../../../packages/db/src/connection.ts";
import { inspectHostedDatabase } from "./database.ts";

const configurationOnly = process.argv.slice(2).join(" ") === "--configuration-only";
let pool: ReturnType<typeof createPool> | undefined;
try {
  if (process.argv.length > 2 && !configurationOnly) throw new Error("invalid_arguments");
  if (process.env.DEPLOYMENT_ENVIRONMENT !== "staging") {
    throw new ConfigError([
      { key: "DEPLOYMENT_ENVIRONMENT", message: "must explicitly target staging" },
    ]);
  }
  const config = assertHostedWebEnvironment(process.env)!;
  if (configurationOnly) {
    process.stdout.write(
      JSON.stringify({ status: "configuration_passed", databaseChecked: false }) + "\n",
    );
  } else {
    pool = createPool({
      connectionString: config.database.runtimeUrl!.reveal(),
      applicationName: "algocove-staging-preflight",
      maxConnections: 1,
      statementTimeoutMs: 5000,
    });
    pool.on("error", () => undefined);
    const checks = await inspectHostedDatabase(pool);
    const passed = Object.values(checks).every((value) => value);
    process.stdout.write(
      JSON.stringify({ status: passed ? "preflight_passed" : "preflight_failed", checks }) + "\n",
    );
    if (!passed) process.exitCode = 1;
  }
} catch (error) {
  // Driver errors may include SQL, hostnames or credentials. Emit fixed codes only.
  process.stderr.write(
    JSON.stringify(
      error instanceof ConfigError
        ? {
            status: "preflight_failed",
            reason: "invalid_configuration",
            keys: error.issues.map((issue) => issue.key),
          }
        : { status: "preflight_failed", reason: "database_or_command_unavailable" },
    ) + "\n",
  );
  process.exitCode = 1;
} finally {
  await pool?.end();
}
