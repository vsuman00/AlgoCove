/**
 * Load `.env` when present.
 *
 * Operator commands use this so local development matches the documented
 * `cp .env.example .env` setup without adding a dotenv dependency. A missing file
 * is expected: CI and deployments provide real environment variables.
 */
export function loadLocalEnvFile(filename = ".env"): boolean {
  try {
    process.loadEnvFile(filename);
    return true;
  } catch {
    return false;
  }
}

/** Read a required environment variable, failing with a stable message. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(
      `Environment variable ${name} is required. Copy .env.example to .env, or export it before running this command.`,
    );
  }
  return value;
}

/** Read an optional environment variable with a default. */
export function optionalEnv(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value.trim().length === 0 ? fallback : value;
}

/** True when the process is running in production mode. */
export function isProduction(): boolean {
  return process.env["NODE_ENV"] === "production";
}
