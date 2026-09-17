/**
 * `pnpm db:migrate`
 *
 * Applies ordered, checksum-verified SQL migrations as the schema-owning
 * migration role. Refuses to run without an explicit admin connection so the
 * application runtime role can never be used to change the schema.
 *
 * Exit codes: 0 success, 1 configuration problem, 2 migration failure.
 */
import { migrate } from "../migrate.ts";
import { loadLocalEnvFile, requireEnv } from "./cli-support.ts";

loadLocalEnvFile();

const adminUrl = (() => {
  try {
    return requireEnv("DATABASE_ADMIN_URL");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
})();

try {
  const result = await migrate({
    connectionString: adminUrl,
    logger: { info: (message) => console.log(message) },
  });
  console.log(
    result.appliedCount === 0
      ? "Database schema is up to date."
      : `Applied ${result.appliedCount} migration(s).`,
  );
} catch (error) {
  console.error(
    `Migration failed: ${error instanceof Error ? error.message : "unknown migration error"}`,
  );
  process.exit(2);
}
