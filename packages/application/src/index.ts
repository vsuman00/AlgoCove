/**
 * Public surface of the application package.
 *
 * The package exposes use cases, owned ports, and the shared request/error
 * contracts. It depends on the domain package only: concrete adapters (web,
 * database, providers) implement the ports and are wired in the composition
 * root, which the architecture tests enforce.
 */
export {
  AppError,
  CATEGORY_STATUS,
  categorize,
  conflictError,
  dependencyUnavailableError,
  describeCategory,
  ERROR_CATEGORIES,
  ERRORS,
  authenticationRequired,
  authorizationError,
  internalErrorEnvelope,
  notFoundError,
  sanitizeDetails,
  toErrorEnvelope,
  toHttpStatus,
  validationError,
} from "./errors.ts";

export type {
  AppErrorOptions,
  ErrorCategory,
  ErrorCode,
  ErrorDetails,
  ErrorEnvelope,
} from "./errors.ts";

export {
  createActor,
  createFixedClock,
  createRequestContext,
  createSequenceIdGenerator,
  createSystemClock,
  hasRole,
  requireOwnership,
  requireRole,
} from "./request-context.ts";

export type {
  Actor,
  Clock,
  CreateRequestContextInput,
  IdGenerator,
  RequestContext,
} from "./request-context.ts";

export { getLearnerProfile, saveLearnerProfile } from "./profile-use-cases.ts";

export type { LearnerProfileRepository } from "./profile-use-cases.ts";

export {
  requireContentSeparation,
  requireOwnerOrPermission,
  requirePermission,
} from "./authorize.ts";

export { createAuditEvent } from "./audit.ts";
export type { AuditEvent, AuditEventInput, AuditEventRepository } from "./audit.ts";

export { createOutboxEvent } from "./outbox.ts";
export type { OutboxEvent, OutboxEventInput, OutboxEventRepository } from "./outbox.ts";

export { executeIdempotently } from "./idempotency.ts";
export type {
  IdempotencyClaimInput,
  IdempotencyClaimResult,
  IdempotencyRepository,
  IdempotencyResponse,
  IdempotentResult,
} from "./idempotency.ts";

export { redactPayload } from "./platform-safety.ts";
export type { SafePayload } from "./platform-safety.ts";
