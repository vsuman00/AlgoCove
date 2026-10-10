import { describe, expect, it } from "vitest";
import { assertHostedWebEnvironment, ConfigError } from "@algocove/config";

const staging = {
  DEPLOYMENT_ENVIRONMENT: "staging",
  NODE_ENV: "production",
  SERVICE_NAME: "algocove-web",
  APP_ORIGIN: "https://staging.algocove.example",
  DATABASE_URL:
    "postgres://runtime:synthetic-password@db.algocove.example/staging?sslmode=verify-full",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_synthetic",
  CLERK_SECRET_KEY: "sk_test_synthetic",
  TELEMETRY_CORRELATION_KEY: "synthetic-correlation-key-for-tests-only",
};

describe("hosted web configuration admission", () => {
  it("keeps local builds and liveness independent of hosted credentials", () => {
    expect(assertHostedWebEnvironment({ NODE_ENV: "production" })).toBeNull();
    expect(assertHostedWebEnvironment({ DEPLOYMENT_ENVIRONMENT: "local" })).toBeNull();
  });

  it("accepts explicit staging with redacted credentials and AI disabled", () => {
    const config = assertHostedWebEnvironment(staging);
    expect(config?.environment).toBe("production");
    expect(config?.features).toEqual({ tutor: false, execution: false });
    expect(JSON.stringify(config)).not.toContain("synthetic-password");
    expect(JSON.stringify(config)).not.toContain("sk_test_synthetic");
  });

  it.each([
    ["DEPLOYMENT_ENVIRONMENT", "preview"],
    ["DEPLOYMENT_ENVIRONMENT", ""],
    ["NODE_ENV", "test"],
    ["NODE_TLS_REJECT_UNAUTHORIZED", "0"],
    ["DATABASE_OPERATOR_URL", "postgres://operator:private-value@db/staging"],
    ["DATABASE_ADMIN_URL", "postgres://owner:private-value@db/staging"],
    ["PRIVACY_WORKER_DATABASE_URL", "postgres://purge:private-value@db/staging"],
    ["WORKER_DATABASE_URL", "postgres://worker:private-value@db/staging"],
    ["WORKER_OPERATIONS_DATABASE_URL", "postgres://worker:private-value@db/staging"],
    ["LOCAL_PHASE5_E2E", "1"],
    ["LOCAL_PHASE5_NATIVE_HOST", "1"],
    ["ALGOCOVE_TEST_DIST_DIR", "private-value"],
    ["APP_ORIGIN", "https://localhost"],
    ["APP_ORIGIN", "https://127.1"],
    ["APP_ORIGIN", "https://[::1]"],
    ["APP_ORIGIN", "https://staging.algocove.example/path?token=private-value"],
    ["APP_ORIGIN", "https://user:private-value@staging.algocove.example"],
    [
      "DATABASE_URL",
      "postgres://runtime:private-value@db.algocove.example/staging?sslmode=require",
    ],
    ["DATABASE_URL", "postgres://runtime:private-value@localhost/staging?sslmode=verify-full"],
    ["DATABASE_URL", "postgres://runtime:private-value@db.algocove.example"],
    [
      "DATABASE_URL",
      "postgres://runtime:private-value@db.algocove.example/staging?sslmode=verify-full&sslmode=no-verify",
    ],
    [
      "DATABASE_URL",
      "postgres://runtime:private-value@db.algocove.example/staging?sslmode=verify-full&host=localhost",
    ],
    ["TELEMETRY_CORRELATION_KEY", "short-private-value"],
    ["TUTOR_ENABLED", "true"],
    ["ROADMAP_PROPOSAL_ENABLED", "true"],
  ])("rejects unsafe %s without echoing values", (key, value) => {
    try {
      assertHostedWebEnvironment({ ...staging, [key]: value });
      expect.fail("Expected hosted configuration rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).issues.map((issue) => issue.key)).toContain(key);
      expect((error as ConfigError).message).not.toContain("private-value");
    }
  });

  it("requires complete authentication configuration before startup", () => {
    expect(() => assertHostedWebEnvironment({ ...staging, CLERK_SECRET_KEY: "" })).toThrow(
      ConfigError,
    );
  });

  it.each([
    "https://staging.algocove.example",
    "https://localhost",
    "https://user:private-value@relay.example",
    "https://relay.example?token=private-value",
  ])("rejects unsafe execution relay configuration", (url) => {
    expect(() =>
      assertHostedWebEnvironment({
        ...staging,
        EXECUTION_RELAY_URL: url,
        EXECUTION_RELAY_TOKEN: "synthetic-relay-token",
      }),
    ).toThrow(/EXECUTION_RELAY_URL/);
  });
});
