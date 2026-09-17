import { beforeEach, describe, expect, it } from "vitest";
import {
  ConfigError,
  describeConfig,
  loadConfig,
  redactSecrets,
  resetSecretRegistry,
} from "@algocove/config";

const baseEnvironment = {
  SERVICE_NAME: "algocove-web",
  APP_ORIGIN: "http://localhost:3000",
};

beforeEach(() => {
  resetSecretRegistry();
});

describe("validated configuration", () => {
  it("applies safe development defaults", () => {
    const config = loadConfig(baseEnvironment);

    expect(config.environment).toBe("development");
    expect(config.logLevel).toBe("info");
    expect(config.web.port).toBe(3000);
    expect(config.database.runtimeUrl).toBeNull();
    expect(config.features).toEqual({ tutor: false, execution: false, localIdentity: true });
  });

  it("parses explicit values without changing the secret boundary", () => {
    const runtimeUrl = "postgres://runtime:super-secret-password@localhost/algocove";
    const adminUrl = "postgres://admin:another-secret-password@localhost/algocove";
    const config = loadConfig({
      ...baseEnvironment,
      NODE_ENV: "test",
      LOG_LEVEL: "debug",
      PORT: "3100",
      DATABASE_URL: runtimeUrl,
      DATABASE_ADMIN_URL: adminUrl,
      DATABASE_POOL_MAX: "12",
      DATABASE_STATEMENT_TIMEOUT_MS: "1200",
      TUTOR_ENABLED: "true",
      EXECUTION_ENABLED: false,
      LOCAL_IDENTITY_ENABLED: "false",
    });

    expect(config.web.port).toBe(3100);
    expect(config.database.poolMax).toBe(12);
    expect(config.database.statementTimeoutMs).toBe(1200);
    expect(config.features).toEqual({ tutor: true, execution: false, localIdentity: false });
    expect(config.database.runtimeUrl?.toString()).toBe("[redacted]");
    expect(config.database.adminUrl?.toJSON()).toBe("[redacted]");
    expect(describeConfig(config)).toContainEqual({
      key: "DATABASE_URL",
      value: "[redacted]",
      sensitive: true,
    });
    expect(JSON.stringify(config)).not.toContain("super-secret-password");
  });

  it("reports all schema and cross-field failures without including values", () => {
    const secret = "postgres://admin:do-not-log-this@localhost/algocove";

    try {
      loadConfig({
        ...baseEnvironment,
        NODE_ENV: "production",
        SERVICE_NAME: "INVALID SERVICE",
        APP_ORIGIN: "http://insecure.example",
        DATABASE_ADMIN_URL: secret,
        DATABASE_URL: secret,
        PORT: "0",
      });
      throw new Error("expected configuration to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const configError = error as ConfigError;
      expect(configError.issues.map((issue) => issue.key)).toEqual(
        expect.arrayContaining(["SERVICE_NAME", "PORT"]),
      );
      expect(configError.message).not.toContain(secret);
      expect(configError.message).not.toContain("do-not-log-this");
    }
  });

  it("rejects an identical runtime and migration connection", () => {
    expect(() =>
      loadConfig({
        ...baseEnvironment,
        DATABASE_URL: "postgres://same@localhost/algocove",
        DATABASE_ADMIN_URL: "postgres://same@localhost/algocove",
      }),
    ).toThrow(/must differ from DATABASE_URL/);
  });

  it("enforces production transport and runtime database requirements", () => {
    expect(() =>
      loadConfig({
        ...baseEnvironment,
        NODE_ENV: "production",
        APP_ORIGIN: "http://production.example",
        DATABASE_ADMIN_URL: "postgres://admin@localhost/algocove",
      }),
    ).toThrow(/APP_ORIGIN must use https in production/);

    try {
      loadConfig({
        ...baseEnvironment,
        NODE_ENV: "production",
        APP_ORIGIN: "https://production.example",
      });
      throw new Error("expected production database requirement to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).issues).toContainEqual({
        key: "DATABASE_URL",
        message: "is required in production",
      });
    }
  });

  it("redacts registered secrets from diagnostic text", () => {
    const secret = "postgres://user:token-value-that-must-not-escape@localhost/algocove";
    loadConfig({
      ...baseEnvironment,
      DATABASE_URL: secret,
    });

    expect(redactSecrets(`connection failed for ${secret}`)).toBe(
      "connection failed for [redacted]",
    );
  });
});
