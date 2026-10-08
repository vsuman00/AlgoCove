import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { rawConfigSchema } from "../../packages/config/src/schema.ts";

const webConfigKeys = [
  ...Object.keys(rawConfigSchema.shape).filter(
    (key) => key !== "NODE_ENV" && key !== "DATABASE_ADMIN_URL",
  ),
  "TELEMETRY_CORRELATION_KEY",
];

/** Apply repository-local settings only when explicitly called by local commands. */
export function loadLocalWebEnv(): void {
  for (const filename of ["../../.env.local", "../../.env"]) {
    let values: ReturnType<typeof parseEnv>;
    try {
      values = parseEnv(readFileSync(new URL(filename, import.meta.url), "utf8"));
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")
        continue;
      throw error;
    }
    for (const key of webConfigKeys) {
      if (process.env[key] === undefined && values[key] !== undefined) {
        process.env[key] = values[key];
      }
    }
  }
}
