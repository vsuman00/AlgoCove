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
  readonly execution: {
    readonly relayUrl: string | null;
    readonly relayToken: SecretString | null;
    readonly resultCallbackToken: SecretString | null;
    readonly verificationKeysJson: string | null;
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
  readonly EXECUTION_ENABLED: boolean;
  readonly EXECUTION_RELAY_URL?: string | undefined;
  readonly EXECUTION_RELAY_TOKEN?: string | undefined;
  readonly EXECUTION_RESULT_CALLBACK_TOKEN?: string | undefined;
  readonly EXECUTION_VERIFICATION_KEYS_JSON?: string | undefined;
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

  if (raw.NODE_ENV === "production" && raw.EXECUTION_ENABLED) {
    if (raw.EXECUTION_VERIFICATION_KEYS_JSON === undefined)
      issues.push({
        key: "EXECUTION_VERIFICATION_KEYS_JSON",
        message: "is required when execution is enabled in production",
      });
    if (raw.EXECUTION_RELAY_URL === undefined) {
      issues.push({
        key: "EXECUTION_RELAY_URL",
        message: "is required when execution is enabled in production",
      });
    }
    if (raw.EXECUTION_RELAY_TOKEN === undefined) {
      issues.push({
        key: "EXECUTION_RELAY_TOKEN",
        message: "is required when execution is enabled in production",
      });
    }
    if (raw.EXECUTION_RELAY_URL !== undefined && !raw.EXECUTION_RELAY_URL.startsWith("https://")) {
      issues.push({
        key: "EXECUTION_RELAY_URL",
        message: "must use https in production",
      });
    }
    if (raw.EXECUTION_RESULT_CALLBACK_TOKEN === undefined) {
      issues.push({
        key: "EXECUTION_RESULT_CALLBACK_TOKEN",
        message: "is required when execution is enabled in production",
      });
    }
  }

  if ((raw.EXECUTION_RELAY_URL === undefined) !== (raw.EXECUTION_RELAY_TOKEN === undefined)) {
    issues.push({
      key: "EXECUTION_RELAY_TOKEN",
      message: "must be provided together with EXECUTION_RELAY_URL",
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
    execution: {
      verificationKeysJson: raw.EXECUTION_VERIFICATION_KEYS_JSON ?? null,
      relayUrl: raw.EXECUTION_RELAY_URL ?? null,
      relayToken:
        raw.EXECUTION_RELAY_TOKEN === undefined
          ? null
          : new SecretString(raw.EXECUTION_RELAY_TOKEN),
      resultCallbackToken:
        raw.EXECUTION_RESULT_CALLBACK_TOKEN === undefined
          ? null
          : new SecretString(raw.EXECUTION_RESULT_CALLBACK_TOKEN),
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

/** Hosted web admission; local builds remain dependency-free. No values enter errors. */
export function assertHostedWebEnvironment(source: EnvironmentSource): Config | null {
  const deployment = source.DEPLOYMENT_ENVIRONMENT ?? "local";
  if (source.VERCEL === "1" && deployment === "local") {
    throw new ConfigError([
      {
        key: "DEPLOYMENT_ENVIRONMENT",
        message: "must explicitly identify the hosted environment on Vercel",
      },
    ]);
  }
  if (deployment === "local") return null;
  if (deployment !== "staging" && deployment !== "production") {
    throw new ConfigError([
      { key: "DEPLOYMENT_ENVIRONMENT", message: "must be local, staging or production" },
    ]);
  }
  const issues: ConfigIssue[] = [];
  const reject = (key: string, message: string): void => {
    issues.push({ key, message });
  };
  if (source.NODE_ENV !== "production")
    reject("NODE_ENV", "must be production for hosted web runtimes");
  if (source.NODE_TLS_REJECT_UNAUTHORIZED === "0")
    reject("NODE_TLS_REJECT_UNAUTHORIZED", "must not disable hosted TLS verification");
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === "") continue;
    if (/^(?:LOCAL_|ALGOCOVE_TEST_)/.test(key))
      reject(key, "local test settings are forbidden in hosted web runtimes");
    if (
      [
        "DATABASE_ADMIN_URL",
        "DATABASE_OPERATOR_URL",
        "WORKER_DATABASE_URL",
        "WORKER_OPERATIONS_DATABASE_URL",
        "PRIVACY_WORKER_DATABASE_URL",
      ].includes(key)
    ) {
      reject(key, "privileged credentials must not enter the hosted web runtime");
    }
  }
  for (const key of ["TUTOR_ENABLED", "ROADMAP_PROPOSAL_ENABLED"]) {
    const value = source[key];
    if (
      value !== undefined &&
      value !== "" &&
      value !== false &&
      String(value).toLowerCase() !== "false"
    ) {
      reject(key, "live AI requires a separately approved hosted provider promotion");
    }
  }
  if (
    typeof source.TELEMETRY_CORRELATION_KEY !== "string" ||
    source.TELEMETRY_CORRELATION_KEY.length < 32
  ) {
    reject("TELEMETRY_CORRELATION_KEY", "requires at least 32 characters in hosted web runtimes");
  }
  if (issues.length > 0) throw new ConfigError(issues);
  const config = loadConfig(source);
  const loopback = (hostname: string): boolean =>
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.startsWith("127.") ||
    hostname === "[::1]" ||
    hostname === "0.0.0.0";
  const origin = new URL(config.appOrigin);
  if (
    origin.href !== `${origin.origin}/` ||
    origin.username !== "" ||
    origin.password !== "" ||
    loopback(origin.hostname)
  ) {
    reject("APP_ORIGIN", "must be a canonical non-loopback HTTPS origin");
  }
  try {
    const database = new URL(config.database.runtimeUrl!.reveal());
    if (
      database.searchParams.getAll("sslmode").length !== 1 ||
      database.searchParams.get("sslmode") !== "verify-full" ||
      ["host", "port", "user", "password", "database"].some((key) =>
        database.searchParams.has(key),
      ) ||
      loopback(database.hostname) ||
      database.username === "" ||
      database.pathname.length < 2
    ) {
      reject(
        "DATABASE_URL",
        "requires a remote named database and verified TLS (sslmode=verify-full)",
      );
    }
  } catch {
    reject("DATABASE_URL", "must be a valid PostgreSQL connection URL");
  }
  if (config.execution.relayUrl !== null) {
    const relay = new URL(config.execution.relayUrl);
    if (
      relay.origin === origin.origin ||
      loopback(relay.hostname) ||
      relay.username !== "" ||
      relay.password !== "" ||
      relay.search !== "" ||
      relay.hash !== ""
    ) {
      reject(
        "EXECUTION_RELAY_URL",
        "requires a separate non-loopback execution control origin without URL credentials, query or fragment",
      );
    }
  }
  if (issues.length > 0) throw new ConfigError(issues);
  return config;
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
      key: "EXECUTION_RELAY_URL",
      value: config.execution.relayUrl ?? "<unset>",
      sensitive: false,
    },
    {
      key: "EXECUTION_RELAY_TOKEN",
      value: config.execution.relayToken === null ? "<unset>" : "[redacted]",
      sensitive: config.execution.relayToken !== null,
    },
    {
      key: "EXECUTION_RESULT_CALLBACK_TOKEN",
      value: config.execution.resultCallbackToken === null ? "<unset>" : "[redacted]",
      sensitive: config.execution.resultCallbackToken !== null,
    },
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
