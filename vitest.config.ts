import { defineConfig } from "vitest/config";

/**
 * Workspace test configuration.
 *
 * Projects are separated by the trust and environment they need, not by folder
 * cosmetics:
 *
 * - `unit` runs pure domain/application/adapter code in Node with no services;
 * - `web` renders React components in jsdom, so hooks and ARIA state are testable;
 * - `architecture` inspects source files and enforces the dependency direction;
 * - `integration` requires a live PostgreSQL instance and an isolated database
 *   per test file, so it never runs implicitly with `pnpm test`.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
          exclude: ["tests/unit/web/**"],
        },
      },
      {
        test: {
          name: "web",
          environment: "jsdom",
          include: ["tests/unit/web/**/*.test.tsx"],
          setupFiles: ["tests/setup/web.ts"],
        },
      },
      {
        test: {
          name: "architecture",
          environment: "node",
          include: ["tests/architecture/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          testTimeout: 30_000,
          hookTimeout: 60_000,
          // Integration files own cluster-wide resources (roles, databases), so they
          // run one at a time. Isolation comes from a database per file, not from
          // clearing shared tables.
          fileParallelism: false,
          maxConcurrency: 1,
        },
      },
    ],
  },
});
