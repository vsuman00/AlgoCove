import type { NextConfig } from "next";
import { loadLocalWebEnv } from "./local-env.ts";

// Production runtimes receive explicit environment injection. Local root files
// are read by the dev server and the build-only wrapper, never by `next start`.
if (process.env.NODE_ENV === "development") loadLocalWebEnv();

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
  // Next's development request logger prints raw query strings, including Clerk
  // handshake/session credentials. Keep these URLs out of terminal logs.
  logging: { incomingRequests: false },
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
