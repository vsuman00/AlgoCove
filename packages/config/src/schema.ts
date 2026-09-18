/**
 * Typed, fail-closed configuration schema.
 *
 * Parsing happens once, at process start, against the raw environment. Rules:
 *
 * - required values must be present and valid, or the process does not start;
 * - every failure is reported with the configuration key name only, never its
 *   value, so a bad secret is not echoed into a log or an error page;
 * - production-only requirements are enforced here rather than discovered at the
 *   first request.
 */
import { z } from "zod";

const environmentSchema = z.enum(["development", "test", "production"]);
const logLevelSchema = z.enum(["debug", "info", "warn", "error"]);

const serviceNameSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{1,31}$/, "must be 2-32 characters: lowercase letters, digits, hyphen");

const portSchema = z.coerce.number().int().min(1).max(65535);

/** Postgres connection string. Passwords stay inside `SecretString` in the result. */
const connectionStringSchema = z
  .string()
  .min(1)
  .refine((value) => value.startsWith("postgres://") || value.startsWith("postgresql://"), {
    message: "must be a postgres:// or postgresql:// connection string",
  });

const booleanFromEnv = z
  .union([z.boolean(), z.string()])
  .transform((value) => (typeof value === "boolean" ? String(value) : value.toLowerCase()))
  .pipe(z.enum(["true", "false"]))
  .transform((value) => value === "true");

export const rawConfigSchema = z.object({
  NODE_ENV: environmentSchema.default("development"),
  SERVICE_NAME: serviceNameSchema,
  LOG_LEVEL: logLevelSchema.default("info"),
  APP_ORIGIN: z.string().url(),
  PORT: portSchema.default(3000),
  DATABASE_ADMIN_URL: connectionStringSchema.optional(),
  DATABASE_URL: connectionStringSchema.optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(64).default(10),
  DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(5_000),
  TUTOR_ENABLED: booleanFromEnv.default(false),
  EXECUTION_ENABLED: booleanFromEnv.default(false),
  EXECUTION_RELAY_URL: z
    .string()
    .url()
    .refine(
      (value) => value.startsWith("http://") || value.startsWith("https://"),
      "must use http or https",
    )
    .optional(),
  EXECUTION_RELAY_TOKEN: z.string().min(16).optional(),
  EXECUTION_RESULT_CALLBACK_TOKEN: z.string().min(16).optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  CLERK_SECRET_KEY: z.string().min(1).optional(),
});

export type RawConfig = z.infer<typeof rawConfigSchema>;

export type Environment = z.infer<typeof environmentSchema>;
export type LogLevel = z.infer<typeof logLevelSchema>;
