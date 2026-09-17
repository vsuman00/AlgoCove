import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

/**
 * PostgreSQL connection management.
 *
 * The package speaks explicit SQL: no ORM and no generated database types reach
 * application contracts. Two connection profiles exist by design:
 *
 * - the **admin** profile (migration/schema owner) is used by operator commands
 *   such as `pnpm db:migrate` and `pnpm db:roles`;
 * - the **runtime** profile carries the non-owner application role, which cannot
 *   run DDL or bypass schema ownership.
 *
 * Contract ownership stays in this package so callers cannot construct a
 * connection that silently uses the wrong profile.
 */

export type DatabaseConnection = {
  readonly connectionString: string;
  readonly applicationName: string;
  readonly maxConnections: number;
  readonly statementTimeoutMs: number;
};

export type DatabaseProfile = "runtime" | "admin";

/** Minimal query surface used by callers and by the integration harness. */
export type Queryable = {
  query<TRow extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<TRow>>;
};

/**
 * Create a connection pool with the timeouts the architecture requires: a short
 * statement timeout, no unbounded idle transactions, and a stable
 * `application_name` for database-side diagnostics.
 */
export function createPool(connection: DatabaseConnection): Pool {
  const pool = new Pool({
    connectionString: connection.connectionString,
    application_name: connection.applicationName,
    max: connection.maxConnections,
    statement_timeout: connection.statementTimeoutMs,
    idle_in_transaction_session_timeout: connection.statementTimeoutMs * 4,
    query_timeout: connection.statementTimeoutMs,
    allowExitOnIdle: false,
  });
  return pool;
}

/** Runtime-or-admin helper for scripts that need a single client. */
export async function connect(connection: DatabaseConnection): Promise<PoolClient> {
  const pool = createPool({ ...connection, maxConnections: 1 });
  return pool.connect();
}

export type ProbeResult =
  | { readonly ok: true; readonly serverTime: string; readonly appliedMigrations: number }
  | {
      readonly ok: false;
      readonly reason: "unreachable" | "schema_missing";
      readonly detail: string;
    };

/**
 * Probe database readiness.
 *
 * Readiness is separate from liveness: it requires the platform schema to exist
 * and the runtime role to be able to call the health function. Failure reasons
 * are stable categories, never raw driver messages, so they are safe to expose.
 */
export async function probeDatabase(connection: DatabaseConnection): Promise<ProbeResult> {
  const pool = createPool({ ...connection, maxConnections: 1 });
  try {
    const result = await pool.query<{
      server_time: Date;
      applied_migrations: number;
    }>("SELECT * FROM platform.healthcheck()");
    const row = result.rows[0];
    if (row === undefined) {
      return { ok: false, reason: "schema_missing", detail: "healthcheck returned no row" };
    }
    return {
      ok: true,
      serverTime: row.server_time.toISOString(),
      appliedMigrations: row.applied_migrations,
    };
  } catch (error) {
    return { ok: false, reason: "unreachable", detail: describeDatabaseError(error) };
  } finally {
    await pool.end();
  }
}

/**
 * Convert a driver error into a stable category string.
 *
 * Driver messages can contain connection strings and SQL, so they are never
 * returned to a caller or written to telemetry; only the SQLSTATE is preserved.
 */
export function describeDatabaseError(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const candidate = error as { code?: unknown; name?: unknown };
    if (typeof candidate.code === "string") {
      return `sqlstate:${candidate.code}`;
    }
    if (typeof candidate.name === "string" && candidate.name.startsWith("Database")) {
      return "database_unavailable";
    }
  }
  return "unknown";
}

/** PostgreSQL SQLSTATE codes used by application error classification. */
export const SQLSTATE = {
  uniqueViolation: "23505",
  foreignKeyViolation: "23503",
  checkViolation: "23514",
  serializationFailure: "40001",
  deadlockDetected: "40P01",
  insufficientPrivilege: "42501",
  undefinedTable: "42P01",
  undefinedFunction: "42883",
  queryCanceled: "57014",
  adminShutdown: "57P01",
} as const;

export function sqlStateOf(error: unknown): string | null {
  if (typeof error === "object" && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") {
      return code;
    }
  }
  return null;
}

export function isUniqueViolation(error: unknown): boolean {
  return sqlStateOf(error) === SQLSTATE.uniqueViolation;
}

export function isSerializationFailure(error: unknown): boolean {
  const state = sqlStateOf(error);
  return state === SQLSTATE.serializationFailure || state === SQLSTATE.deadlockDetected;
}

export function isInsufficientPrivilege(error: unknown): boolean {
  return sqlStateOf(error) === SQLSTATE.insufficientPrivilege;
}

export function isConnectionFailure(error: unknown): boolean {
  const state = sqlStateOf(error);
  return state === SQLSTATE.adminShutdown || state === null;
}
