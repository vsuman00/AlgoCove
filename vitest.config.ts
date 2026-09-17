import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

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
  plugins: [react()],
  resolve: {
    alias: {
      "@algocove/application": path.join(root, "packages/application/src/index.ts"),
      "@algocove/config": path.join(root, "packages/config/src/index.ts"),
      "@algocove/db": path.join(root, "packages/db/src/index.ts"),
      "@algocove/observability": path.join(root, "packages/observability/src/index.ts"),
      "@algocove/execution-contracts": path.join(root, "packages/execution-contracts/src/index.ts"),
      "@algocove/execution-control": path.join(root, "services/execution-control/src/index.ts"),
      "@algocove/domain": path.join(root, "packages/domain/src/index.ts"),
    },
  },
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
          include: ["tests/unit/web/**/*.test.ts", "tests/unit/web/**/*.test.tsx"],
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
