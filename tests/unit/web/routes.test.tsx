import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as health } from "../../../apps/web/app/api/health/route";
import { GET as readiness } from "../../../apps/web/app/api/readiness/route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("health route", () => {
  it("stays live without configuration or database access", async () => {
    const result = health();

    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("no-store");
    await expect(result.json()).resolves.toEqual({
      ok: true,
      status: "live",
      service: "algocove-web",
    });
  });
});

describe("readiness route", () => {
  it("reports invalid configuration without disclosing values", async () => {
    vi.stubEnv("SERVICE_NAME", undefined);
    vi.stubEnv("APP_ORIGIN", undefined);
    vi.stubEnv("DATABASE_URL", undefined);
    vi.stubEnv("DATABASE_ADMIN_URL", undefined);

    const result = await readiness();

    expect(result.status).toBe(503);
    await expect(result.json()).resolves.toEqual({
      ok: false,
      status: "not_ready",
      checks: { configuration: "failed", database: "unconfigured" },
    });
  });

  it("reports a valid local configuration without pretending an absent database is ready", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SERVICE_NAME", "algocove-web");
    vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
    vi.stubEnv("DATABASE_URL", undefined);
    vi.stubEnv("DATABASE_ADMIN_URL", undefined);

    const result = await readiness();

    expect(result.status).toBe(503);
    await expect(result.json()).resolves.toEqual({
      ok: false,
      status: "not_ready",
      checks: { configuration: "ok", database: "unconfigured" },
    });
  });
});
