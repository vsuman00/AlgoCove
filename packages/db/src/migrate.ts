import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";
import { BOOKKEEPING_TABLE_DDL } from "./bootstrap.ts";
import { createPool, type DatabaseConnection } from "./connection.ts";
import { withTransaction, type Transaction } from "./transaction.ts";

export { BOOKKEEPING_TABLE_DDL as BOOKKEEPING_DDL } from "./bootstrap.ts";

/**
 * Migration runner.
 *
 * Design decisions:
 *
 * - Migration files are ordered SQL applied exactly once, verified by checksum.
 *   An edited or deleted migration is a hard failure, not a silent re-run.
 * - A PostgreSQL advisory lock serializes the runner, so two deployments racing
 *   each other cannot apply the same migration twice.
 * - The runner never mutates application data; later phases adopt
 *   expand/migrate/contract when a change spans a release.
 * - Migration bookkeeping lives in `platform.schema_migration`, created by the
 *   runner with `IF NOT EXISTS` because the migration role owns the schema.
 */

export const MIGRATIONS_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../migrations",
);

const MIGRATION_FILE_PATTERN = /^(\d{4})_([a-z0-9_]+)\.sql$/;
const ADVISORY_LOCK_KEY = 8_246_113_507_221_001;

export type Migration = {
  readonly id: string;
  readonly name: string;
  readonly filename: string;
  readonly sql: string;
  readonly checksum: string;
};

export type AppliedMigration = {
  readonly id: string;
  readonly name: string;
  readonly checksum: string;
  readonly appliedAt: string;
};

export type MigrationErrorKind =
  "invalid_filename" | "duplicate_id" | "checksum_mismatch" | "missing_applied_migration";

export class MigrationError extends Error {
  readonly kind: MigrationErrorKind;
  readonly filename: string;

  constructor(kind: MigrationErrorKind, filename: string, message: string) {
    super(message);
    this.name = "MigrationError";
    this.kind = kind;
    this.filename = filename;
  }
}

export type MigrationLogger = {
  readonly info: (message: string) => void;
};

export const silentMigrationLogger: MigrationLogger = { info: () => undefined };

export function checksumOf(sql: string): string {
  return `sha256:${createHash("sha256").update(sql, "utf8").digest("hex")}`;
}

/** Load and validate migration files from a directory, in apply order. */
export async function loadMigrations(
  directory: string = MIGRATIONS_DIRECTORY,
): Promise<Migration[]> {
  const entries = await readdir(directory);
  const sqlFiles = entries.filter((entry) => entry.endsWith(".sql")).sort();

  const migrations: Migration[] = [];
  const seenIds = new Map<string, string>();

  for (const filename of sqlFiles) {
    const match = MIGRATION_FILE_PATTERN.exec(filename);
    const id = match?.[1];
    if (match === null || id === undefined) {
      throw new MigrationError(
        "invalid_filename",
        filename,
        `Migration filename must match NNNN_lower_snake_case.sql, received "${filename}".`,
      );
    }
    const previous = seenIds.get(id);
    if (previous !== undefined) {
      throw new MigrationError(
        "duplicate_id",
        filename,
        `Migration id ${id} is used by both "${previous}" and "${filename}".`,
      );
    }
    seenIds.set(id, filename);

    const sql = await readFile(path.join(directory, filename), "utf8");
    migrations.push({ id, name: filename, filename, sql, checksum: checksumOf(sql) });
  }

  return migrations;
}

export type MigrateResult = {
  readonly applied: readonly string[];
  readonly skipped: readonly string[];
  readonly appliedCount: number;
};
/**
 * Apply pending migrations.
 *
 * Returns the applied and already-present migration names so callers (the CLI and
 * the integration harness) can report exactly what happened.
 */
export async function migrate(options: {
  readonly connectionString: string;
  readonly applicationName?: string;
  readonly migrationsDirectory?: string;
  readonly logger?: MigrationLogger;
  readonly pool?: Pool;
}): Promise<MigrateResult> {
  const logger = options.logger ?? silentMigrationLogger;
  const migrations = await loadMigrations(options.migrationsDirectory);
  const connection: DatabaseConnection = {
    connectionString: options.connectionString,
    applicationName: options.applicationName ?? "algocove-migrate",
    maxConnections: 1,
    statementTimeoutMs: 30_000,
  };
  const pool = options.pool ?? createPool(connection);
  const applied: string[] = [];
  const skipped: string[] = [];

  try {
    await withTransaction(pool, async (transaction) => {
      // Serialize runners before reading bookkeeping state.
      await transaction.query("SELECT pg_advisory_xact_lock($1)", [ADVISORY_LOCK_KEY]);
      await transaction.query(BOOKKEEPING_TABLE_DDL);

      const existing = await readAppliedMigrations(transaction);
      verifyExisting(existing, migrations, logger);

      for (const migration of migrations) {
        if (existing.has(migration.id)) {
          skipped.push(migration.filename);
          logger.info(`skip   ${migration.filename}`);
          continue;
        }
        const startedAt = Date.now();
        await transaction.query(migration.sql);
        const durationMs = Date.now() - startedAt;
        await transaction.query(
          `INSERT INTO platform.schema_migration (migration_id, name, checksum, duration_ms)
           VALUES ($1, $2, $3, $4)`,
          [migration.id, migration.name, migration.checksum, durationMs],
        );
        applied.push(migration.filename);
        logger.info(`apply  ${migration.filename} (${durationMs}ms)`);
      }
    });
  } finally {
    if (options.pool === undefined) {
      await pool.end();
    }
  }

  return { applied, skipped, appliedCount: applied.length };
}

/** Read the applied-migration watermarks, newest last. */
export async function readMigrationState(
  connection: DatabaseConnection,
  pool?: Pool,
): Promise<readonly AppliedMigration[]> {
  const owned = pool ?? createPool({ ...connection, maxConnections: 1 });
  try {
    const result = await owned.query<{
      migration_id: string;
      name: string;
      checksum: string;
      applied_at: Date;
    }>(
      `SELECT migration_id, name, checksum, applied_at
         FROM platform.schema_migration
        ORDER BY migration_id`,
    );
    return result.rows.map((row) => ({
      id: row.migration_id,
      name: row.name,
      checksum: row.checksum,
      appliedAt: row.applied_at.toISOString(),
    }));
  } finally {
    if (pool === undefined) {
      await owned.end();
    }
  }
}

async function readAppliedMigrations(
  transaction: Transaction,
): Promise<Map<string, AppliedMigration>> {
  const result = await transaction.query<{
    migration_id: string;
    name: string;
    checksum: string;
    applied_at: Date;
  }>("SELECT migration_id, name, checksum, applied_at FROM platform.schema_migration");
  return new Map(
    result.rows.map((row) => [
      row.migration_id,
      {
        id: row.migration_id,
        name: row.name,
        checksum: row.checksum,
        appliedAt: row.applied_at.toISOString(),
      },
    ]),
  );
}

/**
 * Fail when a previously applied migration changed or disappeared.
 *
 * This is what makes "repeatable in test setup" trustworthy: the same file can be
 * applied many times, but editing history is rejected.
 */
function verifyExisting(
  existing: ReadonlyMap<string, AppliedMigration>,
  migrations: readonly Migration[],
  logger: MigrationLogger,
): void {
  const available = new Map(migrations.map((migration) => [migration.id, migration]));
  for (const [id, applied] of existing) {
    const migration = available.get(id);
    if (migration === undefined) {
      throw new MigrationError(
        "missing_applied_migration",
        applied.name,
        `Applied migration ${applied.name} is missing from the migrations directory.`,
      );
    }
    if (migration.checksum !== applied.checksum) {
      throw new MigrationError(
        "checksum_mismatch",
        migration.filename,
        `Migration ${migration.filename} changed after it was applied; add a new migration instead of editing history.`,
      );
    }
    logger.info(`verify ${migration.filename}`);
  }
}
