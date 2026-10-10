import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig, devices } from "@playwright/test";

const local = parseEnv(readFileSync(".env", "utf8"));
for (const key of ["CLERK_SECRET_KEY", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]) {
  process.env[key] ??= local[key];
}
const origin = process.env.HOSTED_AUTH_ORIGIN;
if (
  !origin ||
  !/^https:\/\/algocove-[a-z0-9]+-vsuman00s-projects\.vercel\.app$/.test(origin) ||
  !process.env.CLERK_SECRET_KEY?.startsWith("sk_test_") ||
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_") ||
  !process.env.DATABASE_TEST_OPERATOR_URL
)
  throw Error(
    "Hosted authentication tests require an immutable Preview and private test credentials.",
  );

export default defineConfig({
  testDir: ".",
  testMatch: /hosted-auth\.spec\.ts$/,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  outputDir: "../../.tmp/test-results/hosted-auth",
  reporter: "line",
  use: {
    baseURL: origin,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
