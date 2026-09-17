import { SecretString } from "./secret.ts";
import { rawConfigSchema, type Environment, type LogLevel } from "./schema.ts";

export { SecretString, redactSecrets, resetSecretRegistry } from "./secret.ts";
export { rawConfigSchema } from "./schema.ts";
export type { Environment, LogLevel, RawConfig } from "./schema.ts";

/**
 * Validated application configuration.
 *
 * Only this shape is passed around the codebase. Raw environment access is
 * confined to `loadConfig`, so a missing or invalid value cannot be discovered
 * at the first request in production.
 */
export type Config = {
  readonly environment: Environment;
  readonly serviceName: string;
  readonly logLevel: LogLevel;
  readonly appOrigin: string;
  readonly web: {
    readonly port: number;
  };
  readonly database: {
    /** Migration/role-bootstrap connection. Absent in production by design. */
    readonly adminUrl: SecretString | null;
    /** Runtime connection for the application. */
    readonly runtimeUrl: SecretString | null;
    readonly poolMax: number;
    readonly statementTimeoutMs: number;
  };
  readonly features: {
    readonly tutor: boolean;
    readonly execution: boolean;
  };
  readonly clerk: {
    readonly publishableKey: SecretString | null;
    readonly secretKey: SecretString | null;
  };
};

export type ConfigIssue = {
  readonly key: string;
  readonly message: string;
};

/** Raised when the environment cannot produce a usable configuration. */
export class ConfigError extends Error {
  readonly issues: readonly ConfigIssue[];

  constructor(issues: readonly ConfigIssue[]) {
    const summary = issues.map((issue) => `${issue.key} ${issue.message}`).join("; ");
    super(`Invalid configuration: ${summary}`);
    this.name = "ConfigError";
    this.issues = issues;
  }
}

export type EnvironmentSource = Readonly<Record<string, string | boolean | undefined>>;

type ZodLikeError = {
  readonly issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[];
};

function collectZodIssues(error: ZodLikeError): ConfigIssue[] {
  return error.issues.map((issue) => ({
    key: issue.path.length > 0 ? issue.path.map(String).join(".") : "environment",
    message: issue.message,
  }));
}

/**
 * Cross-field rules that a per-key schema cannot express.
 *
 * These are the rules whose violation would silently weaken a trust boundary, so
 * they are fatal rather than warnings.
 */
function collectEnvironmentIssues(raw: {
  readonly NODE_ENV: Environment;
  readonly APP_ORIGIN: string;
  readonly DATABASE_ADMIN_URL?: string | undefined;
  readonly DATABASE_URL?: string | undefined;
  readonly NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string | undefined;
  readonly CLERK_SECRET_KEY?: string | undefined;
}): ConfigIssue[] {
  const issues: ConfigIssue[] = [];

  if (raw.NODE_ENV === "production") {
    if (!raw.APP_ORIGIN.startsWith("https://")) {
      issues.push({ key: "APP_ORIGIN", message: "must use https in production" });
    }
    if (raw.DATABASE_URL === undefined) {
      issues.push({ key: "DATABASE_URL", message: "is required in production" });
    }
    if (raw.DATABASE_ADMIN_URL !== undefined) {
      issues.push({
        key: "DATABASE_ADMIN_URL",
        message:
          "must not be present in the web runtime; migrations run as an operator job, not from the application process",
      });
    }
  }

  if (
    raw.DATABASE_URL !== undefined &&
    raw.DATABASE_ADMIN_URL !== undefined &&
    raw.DATABASE_URL === raw.DATABASE_ADMIN_URL
  ) {
    issues.push({
      key: "DATABASE_ADMIN_URL",
      message:
        "must differ from DATABASE_URL so the runtime role cannot run migrations or bypass schema ownership",
    });
  }

  if (
    (raw.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY === undefined) !==
    (raw.CLERK_SECRET_KEY === undefined)
  ) {
    issues.push({
      key: "CLERK_SECRET_KEY",
      message: "must be provided together with NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    });
  }

  if (raw.NODE_ENV === "production") {
    if (raw.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY === undefined) {
      issues.push({
        key: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
        message: "is required in production",
      });
    }
    if (raw.CLERK_SECRET_KEY === undefined) {
      issues.push({ key: "CLERK_SECRET_KEY", message: "is required in production" });
    }
  }

  return issues;
}

/**
 * Parse configuration from an environment-like source.
 *
 * Throws `ConfigError` listing every problem at once; values are never included
 * in the message.
 */
export function loadConfig(source: EnvironmentSource): Config {
  const parsed = rawConfigSchema.safeParse(source);
  if (!parsed.success) {
    throw new ConfigError(collectZodIssues(parsed.error));
  }

  const raw = parsed.data;
  const issues = collectEnvironmentIssues(raw);
  if (issues.length > 0) {
    throw new ConfigError(issues);
  }

  return {
    environment: raw.NODE_ENV,
    serviceName: raw.SERVICE_NAME,
    logLevel: raw.LOG_LEVEL,
    appOrigin: raw.APP_ORIGIN,
    web: { port: raw.PORT },
    database: {
      adminUrl:
        raw.DATABASE_ADMIN_URL === undefined ? null : new SecretString(raw.DATABASE_ADMIN_URL),
      runtimeUrl: raw.DATABASE_URL === undefined ? null : new SecretString(raw.DATABASE_URL),
      poolMax: raw.DATABASE_POOL_MAX,
      statementTimeoutMs: raw.DATABASE_STATEMENT_TIMEOUT_MS,
    },
    features: {
      tutor: raw.TUTOR_ENABLED,
      execution: raw.EXECUTION_ENABLED,
    },
    clerk: {
      publishableKey:
        raw.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY === undefined
          ? null
          : new SecretString(raw.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
      secretKey: raw.CLERK_SECRET_KEY === undefined ? null : new SecretString(raw.CLERK_SECRET_KEY),
    },
  };
}

/** Parse configuration from `process.env`. */
export function loadConfigFromProcess(environment: EnvironmentSource = process.env): Config {
  return loadConfig(environment);
}
export type ConfigEntry = {
  readonly key: string;
  readonly value: string;
  readonly sensitive: boolean;
};

/**
 * Redaction-safe configuration display for diagnostics and the readiness route.
 * Secret values are never returned, only marked as redacted.
 */
export function describeConfig(config: Config): readonly ConfigEntry[] {
  return [
    { key: "NODE_ENV", value: config.environment, sensitive: false },
    { key: "SERVICE_NAME", value: config.serviceName, sensitive: false },
    { key: "LOG_LEVEL", value: config.logLevel, sensitive: false },
    { key: "APP_ORIGIN", value: config.appOrigin, sensitive: false },
    { key: "PORT", value: String(config.web.port), sensitive: false },
    {
      key: "DATABASE_URL",
      value: config.database.runtimeUrl === null ? "<unset>" : "[redacted]",
      sensitive: config.database.runtimeUrl !== null,
    },
    {
      key: "DATABASE_ADMIN_URL",
      value: config.database.adminUrl === null ? "<unset>" : "[redacted]",
      sensitive: config.database.adminUrl !== null,
    },
    { key: "DATABASE_POOL_MAX", value: String(config.database.poolMax), sensitive: false },
    {
      key: "DATABASE_STATEMENT_TIMEOUT_MS",
      value: String(config.database.statementTimeoutMs),
      sensitive: false,
    },
    { key: "TUTOR_ENABLED", value: String(config.features.tutor), sensitive: false },
    { key: "EXECUTION_ENABLED", value: String(config.features.execution), sensitive: false },
    {
      key: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      value: config.clerk.publishableKey === null ? "<unset>" : "[redacted]",
      sensitive: config.clerk.publishableKey !== null,
    },
    {
      key: "CLERK_SECRET_KEY",
      value: config.clerk.secretKey === null ? "<unset>" : "[redacted]",
      sensitive: config.clerk.secretKey !== null,
    },
  ];
}

/** True when a runtime database connection is configured. */
export function hasRuntimeDatabase(config: Config): boolean {
  return config.database.runtimeUrl !== null;
}
