import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { rawConfigSchema } from "../../packages/config/src/schema.ts";

// ponytail: Next already loaded app-local settings; root files are development fallbacks only.
// Copy known runtime settings only, never operator credentials, into the web process.
if (process.env.NODE_ENV === "development") {
  for (const filename of ["../../.env.local", "../../.env"]) {
    let values: ReturnType<typeof parseEnv>;
    try {
      values = parseEnv(readFileSync(new URL(filename, import.meta.url), "utf8"));
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")
        continue;
      throw error;
    }
    for (const key of Object.keys(rawConfigSchema.shape)) {
      if (
        key !== "DATABASE_ADMIN_URL" &&
        process.env[key] === undefined &&
        values[key] !== undefined
      ) {
        process.env[key] = values[key];
      }
    }
  }
}

/**
 * Web application configuration.
 *
 * Phase 1 deliberately keeps the delivery surface minimal: no database, AI, or
 * execution dependency is required to start the application or to serve the
 * liveness endpoint. Package transpilation covers the first-party workspace
 * packages, which ship TypeScript sources.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Isolated test servers must not share the developer server build/lock directory.
  distDir: process.env.ALGOCOVE_TEST_DIST_DIR ?? ".next",
  agentRules: false,
  // Local reverse proxies and browser checks commonly expose localhost as 127.0.0.1.
  // Permit that loopback origin for Next.js development resources (HMR/CSS).
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  transpilePackages: [
    "@algocove/application",
    "@algocove/config",
    "@algocove/db",
    "@algocove/content",
    "@algocove/retrieval",
    "@algocove/tutor",
    "@algocove/domain",
    "@algocove/visualizer",
  ],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
