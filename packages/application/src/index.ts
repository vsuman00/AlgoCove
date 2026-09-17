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
