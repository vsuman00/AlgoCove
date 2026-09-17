import type { Pool } from "pg";
import { createPool, type DatabaseConnection } from "./connection.ts";

/**
 * Database role, schema, and extension bootstrap.
 *
 * Runner: an operator connection with `CREATEROLE` and `CREATE EXTENSION`
 * privileges (the local compose superuser, or a deployment operator role). It is
 * never the connection the application uses.
 *
 * The bootstrap establishes the two-role split the architecture requires:
 *
 * - `migrationRole` owns schema objects and applies migrations;
 * - `runtimeRole` receives CRUD privileges only, so it cannot run DDL, cannot
 *   bypass schema ownership, and cannot write bookkeeping tables.
 *
 * Every statement is built through validated identifier and literal quoting;
 * passwords are never interpolated without escaping and never logged.
 */

const IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]{0,62}$/;

export type BootstrapRole = {
  readonly name: string;
  readonly password: string;
};

export type BootstrapOptions = {
  /** Operator connection: superuser, or a role with CREATEROLE and CREATE EXTENSION. */
  readonly operatorConnectionString: string;
  readonly migrationRole: BootstrapRole;
  readonly runtimeRole: BootstrapRole;
  /** Defaults to the database the operator connection is already using. */
  readonly databaseName?: string;
  readonly logger?: { readonly info: (message: string) => void };
};

export type BootstrapResult = {
  readonly databaseName: string;
  readonly createdRoles: readonly string[];
  readonly passwordRoles: readonly string[];
  readonly extensionCreated: boolean;
  readonly bookkeepingTableReady: boolean;
};

export type BootstrapErrorKind =
  "invalid_identifier" | "invalid_password" | "privilege" | "extension_unavailable";

export class BootstrapError extends Error {
  readonly kind: BootstrapErrorKind;

  constructor(kind: BootstrapErrorKind, message: string) {
    super(message);
    this.name = "BootstrapError";
    this.kind = kind;
  }
}

export function quoteIdentifier(identifier: string): string {
  if (!IDENTIFIER_PATTERN.test(identifier)) {
    throw new BootstrapError(
      "invalid_identifier",
      `Identifier "${identifier}" must match ${IDENTIFIER_PATTERN.source}.`,
    );
  }
  return `"${identifier}"`;
}

export function quoteLiteral(value: string): string {
  // Reject control characters rather than trying to escape them; a password with
  // a NUL byte or a newline is a configuration error, not something to encode.
  if (
    Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 0x1f || codePoint === 0x7f;
    })
  ) {
    throw new BootstrapError(
      "invalid_password",
      "Password contains control characters that cannot be stored safely.",
    );
  }
  return `'${value.replace(/'/g, "''")}'`;
}

export const PLATFORM_SCHEMA = "platform";
export const BOOKKEEPING_TABLE = "schema_migration";

export const BOOKKEEPING_TABLE_DDL = `CREATE TABLE IF NOT EXISTS ${PLATFORM_SCHEMA}.${BOOKKEEPING_TABLE} (
  migration_id text PRIMARY KEY,
  name text NOT NULL,
  checksum text NOT NULL CHECK (checksum LIKE 'sha256:%'),
  applied_at timestamptz NOT NULL DEFAULT now(),
  duration_ms integer NOT NULL CHECK (duration_ms >= 0)
)`;

export async function bootstrapDatabase(options: BootstrapOptions): Promise<BootstrapResult> {
  const logger = options.logger ?? { info: () => undefined };
  const migrationRole = quoteIdentifier(options.migrationRole.name);
  const runtimeRole = quoteIdentifier(options.runtimeRole.name);
  const connection: DatabaseConnection = {
    connectionString: options.operatorConnectionString,
    applicationName: "algocove-bootstrap",
    maxConnections: 1,
    statementTimeoutMs: 30_000,
  };
  const pool = createPool(connection);
  const createdRoles: string[] = [];
  const passwordRoles: string[] = [];

  try {
    const databaseName = options.databaseName ?? (await currentDatabase(pool));
    const existingRoles = await existingRoleNames(pool);

    for (const role of [options.migrationRole, options.runtimeRole]) {
      if (existingRoles.has(role.name)) {
        await pool.query(
          `ALTER ROLE ${quoteIdentifier(role.name)} WITH LOGIN PASSWORD ${quoteLiteral(role.password)}`,
        );
        passwordRoles.push(role.name);
      } else {
        await pool.query(
          `CREATE ROLE ${quoteIdentifier(role.name)} WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD ${quoteLiteral(role.password)}`,
        );
        createdRoles.push(role.name);
      }
    }

    const extensionCreated = await ensureVectorExtension(pool);

    // Schema-level objects are created under `SET ROLE` so the migration role owns
    // them; the operator connection never becomes the long-lived owner.
    await pool.query(`SET ROLE ${migrationRole}`);
    try {
      await pool.query(
        `CREATE SCHEMA IF NOT EXISTS ${PLATFORM_SCHEMA} AUTHORIZATION ${migrationRole}`,
      );
      await pool.query(BOOKKEEPING_TABLE_DDL);
    } finally {
      await pool.query("RESET ROLE");
    }

    await applyPrivileges(pool, { databaseName, migrationRole, runtimeRole });

    logger.info(
      `bootstrap: roles ready (${options.migrationRole.name}, ${options.runtimeRole.name}) in ${databaseName}`,
    );
    return {
      databaseName,
      createdRoles,
      passwordRoles,
      extensionCreated,
      bookkeepingTableReady: true,
    };
  } finally {
    await pool.end();
  }
}
async function currentDatabase(pool: Pool): Promise<string> {
  const result = await pool.query<{ name: string }>("SELECT current_database() AS name");
  const name = result.rows[0]?.name;
  if (typeof name !== "string") {
    throw new BootstrapError("privilege", "Operator connection did not report a database name.");
  }
  return name;
}

async function existingRoleNames(pool: Pool): Promise<Set<string>> {
  const result = await pool.query<{ rolname: string }>("SELECT rolname FROM pg_roles");
  return new Set(result.rows.map((row) => row.rolname));
}

async function ensureVectorExtension(pool: Pool): Promise<boolean> {
  const existing = await pool.query("SELECT 1 FROM pg_extension WHERE extname = 'vector'");
  if (existing.rows.length > 0) {
    return false;
  }
  try {
    await pool.query("CREATE EXTENSION IF NOT EXISTS vector");
    return true;
  } catch (error) {
    const code =
      typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
    if (code === "42501" || code === "0A000") {
      throw new BootstrapError(
        "extension_unavailable",
        "The pgvector extension could not be created with this operator connection; install it as a database operator before running the application.",
      );
    }
    throw error;
  }
}

async function applyPrivileges(
  pool: Pool,
  input: { databaseName: string; migrationRole: string; runtimeRole: string },
): Promise<void> {
  const database = quoteIdentifier(input.databaseName);
  const { migrationRole, runtimeRole } = input;

  await pool.query(`GRANT CONNECT ON DATABASE ${database} TO ${runtimeRole}`);
  await pool.query(`GRANT USAGE ON SCHEMA ${PLATFORM_SCHEMA} TO ${runtimeRole}`);

  // The public schema stays locked down so a compromised runtime role cannot
  // create objects and impersonate platform tables.
  await pool.query("REVOKE CREATE ON SCHEMA public FROM PUBLIC");
  await pool.query(`REVOKE ALL ON SCHEMA public FROM ${runtimeRole}`);

  // Existing objects, plus future objects created by the migration role.
  await pool.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${PLATFORM_SCHEMA} TO ${runtimeRole}`,
  );
  await pool.query(
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ${PLATFORM_SCHEMA} TO ${runtimeRole}`,
  );
  await pool.query(
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${migrationRole} IN SCHEMA ${PLATFORM_SCHEMA}
       GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${runtimeRole}`,
  );
  await pool.query(
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${migrationRole} IN SCHEMA ${PLATFORM_SCHEMA}
       GRANT USAGE, SELECT ON SEQUENCES TO ${runtimeRole}`,
  );

  // Bookkeeping is internal: the runtime role may read the watermark, never write.
  await pool.query(
    `REVOKE INSERT, UPDATE, DELETE ON ${PLATFORM_SCHEMA}.${BOOKKEEPING_TABLE} FROM ${runtimeRole}`,
  );
  await pool.query(`GRANT SELECT ON ${PLATFORM_SCHEMA}.${BOOKKEEPING_TABLE} TO ${runtimeRole}`);
}
