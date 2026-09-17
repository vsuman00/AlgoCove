/**
 * `pnpm db:roles`
 *
 * Creates (or refreshes) the migration and runtime roles, installs pgvector, and
 * grants the runtime role CRUD-only access to the platform schema.
 *
 * Runs as the operator connection. It never prints passwords, and it refuses to
 * use the built-in local defaults when NODE_ENV=production, so a local convenience
 * cannot silently become a hosted configuration.
 *
 * Exit codes: 0 success, 1 configuration problem, 2 failure.
 */
import { bootstrapDatabase, BootstrapError } from "../bootstrap.ts";
import { isProduction, loadLocalEnvFile, optionalEnv, requireEnv } from "./cli-support.ts";

loadLocalEnvFile();

const DEFAULT_MIGRATION_ROLE = "algocove_admin";
const DEFAULT_RUNTIME_ROLE = "algocove_app";

function resolveCredentials(): {
  operatorConnectionString: string;
  migrationRole: { name: string; password: string };
  runtimeRole: { name: string; password: string };
} {
  const operatorConnectionString = requireEnv("DATABASE_ADMIN_URL");
  const production = isProduction();

  const migrationName = optionalEnv("ALGOCOVE_MIGRATION_ROLE", DEFAULT_MIGRATION_ROLE);
  const runtimeName = optionalEnv("ALGOCOVE_RUNTIME_ROLE", DEFAULT_RUNTIME_ROLE);
  const migrationPassword = optionalEnv("ALGOCOVE_MIGRATION_PASSWORD", DEFAULT_MIGRATION_ROLE);
  const runtimePassword = optionalEnv("ALGOCOVE_RUNTIME_PASSWORD", DEFAULT_RUNTIME_ROLE);

  if (production) {
    const missing: string[] = [];
    if (process.env["ALGOCOVE_MIGRATION_PASSWORD"] === undefined) {
      missing.push("ALGOCOVE_MIGRATION_PASSWORD");
    }
    if (process.env["ALGOCOVE_RUNTIME_PASSWORD"] === undefined) {
      missing.push("ALGOCOVE_RUNTIME_PASSWORD");
    }
    if (missing.length > 0) {
      throw new Error(
        `Refusing to apply built-in local passwords in production. Set ${missing.join(", ")}.`,
      );
    }
  }

  return {
    operatorConnectionString,
    migrationRole: { name: migrationName, password: migrationPassword },
    runtimeRole: { name: runtimeName, password: runtimePassword },
  };
}

try {
  const credentials = resolveCredentials();
  const result = await bootstrapDatabase({
    ...credentials,
    logger: { info: (message) => console.log(message) },
  });
  console.log(
    `Roles ready in ${result.databaseName}: created [${result.createdRoles.join(", ") || "none"}], refreshed [${result.passwordRoles.join(", ") || "none"}], pgvector ${result.extensionCreated ? "installed" : "already present"}.`,
  );
} catch (error) {
  if (error instanceof BootstrapError) {
    console.error(`Role bootstrap failed (${error.kind}): ${error.message}`);
  } else {
    console.error(
      `Role bootstrap failed: ${error instanceof Error ? error.message : "unknown bootstrap error"}`,
    );
  }
  process.exit(error instanceof BootstrapError && error.kind === "privilege" ? 2 : 1);
}
