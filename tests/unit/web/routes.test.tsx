import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GET as health } from "../../../apps/web/app/api/health/route";
import { GET as readiness } from "../../../apps/web/app/api/readiness/route";
import GlobalError from "../../../apps/web/app/error";

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

describe("error boundary", () => {
  it("offers an accessible retry and home recovery path", async () => {
    const user = userEvent.setup();
    const reset = vi.fn();

    render(<GlobalError reset={reset} />);

    expect(screen.getByRole("heading", { name: "This page needs another try." })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Go home" })).toHaveAttribute("href", "/");
  });
});
