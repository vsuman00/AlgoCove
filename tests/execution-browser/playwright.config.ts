import { defineConfig, devices } from "@playwright/test";
import { loadLocalWebEnv } from "../../apps/web/local-env.ts";

loadLocalWebEnv();

export default defineConfig({
  testDir: "..",
  outputDir: "../../.tmp/test-results/execution-browser",
  testMatch: /(?:guided-results|worker-offline)\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:3200",
    trace: "retain-on-failure",
    colorScheme: "light",
  },
  webServer: {
    command: "pnpm --filter @algocove/web exec next start --hostname 127.0.0.1 --port 3200",
    env: {
      EXECUTION_ENABLED: "true",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
      CLERK_SECRET_KEY: "",
    },
    url: "http://127.0.0.1:3200/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
