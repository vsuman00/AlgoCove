/**
 * Public surface of the database package.
 *
 * Callers receive explicit SQL helpers, the transaction contract, the migration
 * runner, and the operator bootstrap. No ORM types or generated row models are
 * exported, so application contracts stay owned by the domain and application
 * packages.
 */
export {
  connect,
  createPool,
  describeDatabaseError,
  isConnectionFailure,
  isInsufficientPrivilege,
  isSerializationFailure,
  isUniqueViolation,
  probeDatabase,
  SQLSTATE,
  sqlStateOf,
} from "./connection.ts";

export type { DatabaseConnection, DatabaseProfile, ProbeResult, Queryable } from "./connection.ts";

export { withRetryableTransaction, withTransaction } from "./transaction.ts";

export type {
  IsolationLevel,
  Transaction,
  TransactionOptions,
  TransactionRetryOptions,
} from "./transaction.ts";

export {
  bootstrapDatabase,
  BOOKKEEPING_TABLE,
  BOOKKEEPING_TABLE_DDL,
  BootstrapError,
  DATA_SCHEMAS,
  PLATFORM_SCHEMA,
  quoteIdentifier,
  quoteLiteral,
} from "./bootstrap.ts";

export type {
  BootstrapErrorKind,
  BootstrapOptions,
  BootstrapResult,
  BootstrapRole,
} from "./bootstrap.ts";

export {
  checksumOf,
  loadMigrations,
  migrate,
  MIGRATIONS_DIRECTORY,
  MigrationError,
  readMigrationState,
  silentMigrationLogger,
} from "./migrate.ts";

export type {
  AppliedMigration,
  MigrateResult,
  Migration,
  MigrationErrorKind,
  MigrationLogger,
} from "./migrate.ts";

export { PostgresIdentityRepository } from "./identity-repository.ts";
export { PostgresPlatformRepository } from "./platform-repository.ts";
