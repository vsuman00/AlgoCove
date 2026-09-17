import { assertNever } from "@algocove/domain";

/**
 * Stable application error contract.
 *
 * Every failure that reaches a client is expressed as an `AppError` with a
 * stable machine-readable code and a fixed HTTP status. The contract is
 * fail-closed about disclosure:
 *
 * - `internal` errors never carry a message, details, or a cause to the client;
 * - error envelopes never include stack traces, SQL, provider bodies, or secrets;
 * - the trace identifier is the only correlation channel exposed.
 */

export const ERROR_CATEGORIES = {
  validation: "validation",
  authorization: "authorization",
  notFound: "not_found",
  conflict: "conflict",
  rateLimited: "rate_limited",
  budgetExhausted: "budget_exhausted",
  dependencyUnavailable: "dependency_unavailable",
  internal: "internal",
} as const;

export type ErrorCategory = (typeof ERROR_CATEGORIES)[keyof typeof ERROR_CATEGORIES];

/** HTTP status assigned to each category. Stable by category, never per call site. */
export const CATEGORY_STATUS: Readonly<Record<ErrorCategory, number>> = {
  [ERROR_CATEGORIES.validation]: 400,
  [ERROR_CATEGORIES.authorization]: 403,
  [ERROR_CATEGORIES.notFound]: 404,
  [ERROR_CATEGORIES.conflict]: 409,
  [ERROR_CATEGORIES.rateLimited]: 429,
  [ERROR_CATEGORIES.budgetExhausted]: 429,
  [ERROR_CATEGORIES.dependencyUnavailable]: 503,
  [ERROR_CATEGORIES.internal]: 500,
};

/**
 * Categories whose message and details are safe to disclose. Everything else is
 * replaced by a generic message, so an internal failure cannot leak by accident.
 */
const DISCLOSABLE_CATEGORIES: ReadonlySet<ErrorCategory> = new Set<ErrorCategory>([
  ERROR_CATEGORIES.validation,
  ERROR_CATEGORIES.authorization,
  ERROR_CATEGORIES.notFound,
  ERROR_CATEGORIES.conflict,
  ERROR_CATEGORIES.rateLimited,
  ERROR_CATEGORIES.budgetExhausted,
  ERROR_CATEGORIES.dependencyUnavailable,
]);

const MAX_MESSAGE_LENGTH = 300;
const MAX_DETAILS = 20;
const DETAIL_KEY_PATTERN = /^[a-z][a-z0-9_-]{0,39}$/;
const SECRET_SHAPED_PATTERN =
  /(password|passwd|secret|token|api[_-]?key|authorization|cookie|session[_-]?id|private[_-]?key|postgres(?:ql)?:\/\/)/i;

export type ErrorDetails = Readonly<Record<string, string | number | boolean>>;

export type AppErrorOptions = {
  readonly category: ErrorCategory;
  readonly message: string;
  readonly details?: ErrorDetails;
  /** Retry guidance for transient failures; advisory only. */
  readonly retryable?: boolean;
};

export class AppError extends Error {
  readonly code: string;
  readonly category: ErrorCategory;
  readonly status: number;
  readonly details: ErrorDetails | undefined;
  readonly retryable: boolean;

  constructor(code: string, options: AppErrorOptions) {
    super(options.message);
    this.name = "AppError";
    this.code = code;
    this.category = options.category;
    this.status = CATEGORY_STATUS[options.category];
    this.details = options.details;
    this.retryable = options.retryable ?? false;
  }
}

/** Error envelope returned to callers. Deliberately flat and small. */
export type ErrorEnvelope = {
  readonly error: {
    readonly code: string;
    readonly category: ErrorCategory;
    readonly message: string;
    readonly traceId: string;
    readonly retryable: boolean;
    readonly details?: ErrorDetails;
  };
};

function truncate(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit - 1)}\u2026` : value;
}

/**
 * Filter detail entries so a developer cannot accidentally return a secret or an
 * unbounded blob through the public error contract.
 */
export function sanitizeDetails(details: ErrorDetails | undefined): ErrorDetails | undefined {
  if (details === undefined) {
    return undefined;
  }
  const entries = Object.entries(details)
    .filter(([key, value]) => {
      if (!DETAIL_KEY_PATTERN.test(key) || SECRET_SHAPED_PATTERN.test(key)) {
        return false;
      }
      return typeof value !== "string" || !SECRET_SHAPED_PATTERN.test(value);
    })
    .slice(0, MAX_DETAILS)
    .map(
      ([key, value]) =>
        [key, typeof value === "string" ? truncate(value, MAX_MESSAGE_LENGTH) : value] as const,
    );
  return entries.length === 0 ? undefined : Object.fromEntries(entries);
}

/**
 * Serialize any thrown value into the public error contract.
 *
 * Unknown values are always reported as a non-disclosing internal error: the
 * caller learns that the request failed, and the trace identifier is the only
 * route to more detail.
 */
export function toErrorEnvelope(cause: unknown, traceId: string): ErrorEnvelope {
  if (cause instanceof AppError) {
    const disclosable = DISCLOSABLE_CATEGORIES.has(cause.category);
    const details = disclosable ? sanitizeDetails(cause.details) : undefined;
    return {
      error: {
        code: disclosable ? cause.code : ERRORS.internalError,
        category: cause.category,
        message: disclosable ? truncate(cause.message, MAX_MESSAGE_LENGTH) : "Unexpected failure.",
        traceId,
        retryable: cause.retryable,
        ...(details === undefined ? {} : { details }),
      },
    };
  }
  return {
    error: {
      code: ERRORS.internalError,
      category: ERROR_CATEGORIES.internal,
      message: "Unexpected failure.",
      traceId,
      retryable: false,
    },
  };
}
/** HTTP status for any thrown value, without leaking category details. */
export function toHttpStatus(cause: unknown): number {
  if (cause instanceof AppError) {
    return cause.status;
  }
  return CATEGORY_STATUS[ERROR_CATEGORIES.internal];
}

/** Narrow an unknown thrown value to a stable category, for telemetry only. */
export function categorize(cause: unknown): ErrorCategory {
  return cause instanceof AppError ? cause.category : ERROR_CATEGORIES.internal;
}

/** Describe a category exhaustively; keeps new categories deliberate. */
export function describeCategory(category: ErrorCategory): string {
  switch (category) {
    case ERROR_CATEGORIES.validation:
      return "The request was rejected because it did not satisfy the contract.";
    case ERROR_CATEGORIES.authorization:
      return "The actor is not permitted to perform this operation.";
    case ERROR_CATEGORIES.notFound:
      return "The requested resource is not available to this actor.";
    case ERROR_CATEGORIES.conflict:
      return "The operation conflicts with the current state.";
    case ERROR_CATEGORIES.rateLimited:
      return "Too many requests; retry after the indicated delay.";
    case ERROR_CATEGORIES.budgetExhausted:
      return "The configured budget for this operation is exhausted.";
    case ERROR_CATEGORIES.dependencyUnavailable:
      return "A required dependency is temporarily unavailable.";
    case ERROR_CATEGORIES.internal:
      return "An unexpected internal failure occurred.";
    default:
      return assertNever(category, "describeCategory");
  }
}

// ---------------------------------------------------------------------------
// Stable codes and constructors used from Phase 1 onward
// ---------------------------------------------------------------------------

export const ERRORS = {
  invalidRequest: "invalid_request",
  unauthenticated: "unauthenticated",
  forbidden: "forbidden",
  notFound: "not_found",
  versionConflict: "version_conflict",
  rateLimited: "rate_limited",
  budgetExhausted: "budget_exhausted",
  dependencyUnavailable: "dependency_unavailable",
  internalError: "internal_error",
} as const;

export type ErrorCode = (typeof ERRORS)[keyof typeof ERRORS];

export function validationError(message: string, details?: ErrorDetails): AppError {
  return new AppError(ERRORS.invalidRequest, {
    category: ERROR_CATEGORIES.validation,
    message,
    ...(details === undefined ? {} : { details }),
  });
}

export function authenticationRequired(message = "Authentication is required."): AppError {
  return new AppError(ERRORS.unauthenticated, {
    category: ERROR_CATEGORIES.authorization,
    message,
  });
}

export function authorizationError(message: string): AppError {
  return new AppError(ERRORS.forbidden, { category: ERROR_CATEGORIES.authorization, message });
}

export function notFoundError(message: string): AppError {
  return new AppError(ERRORS.notFound, { category: ERROR_CATEGORIES.notFound, message });
}

export function conflictError(message: string, details?: ErrorDetails): AppError {
  return new AppError(ERRORS.versionConflict, {
    category: ERROR_CATEGORIES.conflict,
    message,
    ...(details === undefined ? {} : { details }),
  });
}

export function dependencyUnavailableError(message: string): AppError {
  return new AppError(ERRORS.dependencyUnavailable, {
    category: ERROR_CATEGORIES.dependencyUnavailable,
    message,
    retryable: true,
  });
}

export function internalErrorEnvelope(traceId: string): ErrorEnvelope {
  return toErrorEnvelope(
    new AppError(ERRORS.internalError, {
      category: ERROR_CATEGORIES.internal,
      message: `Internal failure (${traceId}).`,
    }),
    traceId,
  );
}
