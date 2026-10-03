import { afterEach, expect, it, vi } from "vitest";

vi.mock("node:fs", () => ({
  readFileSync: (filename: URL) =>
    filename.pathname.endsWith(".env.local")
      ? "DATABASE_URL=postgres://local/runtime\nCLERK_SECRET_KEY=local-secret\nDATABASE_ADMIN_URL=postgres://operator/private\nDATABASE_OPERATOR_URL=postgres://operator/private"
      : "DATABASE_URL=postgres://base/runtime\nCLERK_SECRET_KEY=base-secret\nAPP_ORIGIN=http://localhost:3000",
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("uses root development fallbacks without overriding app settings or loading operator secrets", async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("DATABASE_URL", undefined);
  vi.stubEnv("CLERK_SECRET_KEY", "app-secret");
  vi.stubEnv("DATABASE_ADMIN_URL", undefined);
  vi.stubEnv("DATABASE_OPERATOR_URL", undefined);
  vi.stubEnv("APP_ORIGIN", undefined);
  await import("../../../apps/web/next.config.ts");
  expect(process.env.DATABASE_URL).toBe("postgres://local/runtime");
  expect(process.env.CLERK_SECRET_KEY).toBe("app-secret");
  expect(process.env.APP_ORIGIN).toBe("http://localhost:3000");
  expect(process.env.DATABASE_ADMIN_URL).toBeUndefined();
  expect(process.env.DATABASE_OPERATOR_URL).toBeUndefined();
});

it("never loads local root files into a production runtime", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DATABASE_URL", undefined);
  await import("../../../apps/web/next.config.ts");
  expect(process.env.DATABASE_URL).toBeUndefined();
});
