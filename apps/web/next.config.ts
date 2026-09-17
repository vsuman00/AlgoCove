import type { NextConfig } from "next";

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
  poweredByHeader: false,
  transpilePackages: [
    "@algocove/application",
    "@algocove/config",
    "@algocove/db",
    "@algocove/domain",
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
