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
export { PostgresOutboxRelayRepository } from "./outbox-relay-repository.ts";
export type { ClaimedOutboxEvent, OutboxRelayRepository } from "./outbox-relay-repository.ts";
export { PostgresPracticeRepository } from "./practice-repository.ts";
export type { PracticeAttemptReset, PracticeAttemptWrite } from "./practice-repository.ts";
export { PostgresDraftRepository } from "./draft-repository.ts";
export { PostgresPseudocodeRepository } from "./pseudocode-repository.ts";
export { PostgresHintRepository } from "./hint-repository.ts";
export { PostgresMasteryRepository, PostgresMasteryConceptSource } from "./mastery-repository.ts";

export { PostgresReviewRepository } from "./review-repository.ts";
export { PostgresProgressRepository } from "./progress-repository.ts";

export * from "./concept-mapping-repository.ts";

export * from "./roadmap-intent-repository.ts";
export * from "./roadmap-repository.ts";
export * from "./budget-repository.ts";

export { PostgresContentRepository } from "./content-repository.ts";
export { PostgresExternalReadinessRepository } from "./external-readiness-repository.ts";

export { PostgresExternalCompanionRepository } from "./external-companion-repository.ts";
export { PostgresReadinessContentRepository } from "./readiness-content-repository.ts";

export { PostgresWorkerOperationsRepository } from "./worker-operations-repository.ts";
export { PostgresWorkerEffectsRepository } from "./worker-effects-repository.ts";
export type { WorkerEffectSummary } from "./worker-effects-repository.ts";

export { bootstrapWorkerRole } from "./bootstrap-worker.ts";
export {
  PostgresContentIndexRepository,
  enqueuePublishedContentDerivation,
} from "./content-index-repository.ts";
export { PostgresRetrievalRepository } from "./retrieval-queries.ts";

export { PostgresTutorRepository } from "./tutor-repository.ts";

export * from "./evaluation-repository.ts";

export * from "./roadmap-generation-repository.ts";
