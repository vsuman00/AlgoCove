import { afterEach, describe, expect, it, vi } from "vitest";
import { createActor, requireRole } from "@algocove/application";
import { ROLES } from "@algocove/domain";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), authenticate: vi.fn(), telemetry: vi.fn() }));
vi.mock("../../../apps/web/src/auth/clerk-server", () => ({ auth: mocks.auth }));
vi.mock("../../../apps/web/src/auth/clerk-adapter", () => ({
  getClerkIdentityAdapter: () => ({ authenticate: mocks.authenticate }),
}));
vi.mock("../../../apps/web/src/operations/telemetry", () => ({
  rememberTelemetryContext: mocks.telemetry,
}));
import { authenticatedWebRequestContext } from "../../../apps/web/src/auth/request-context";

const actor = (roles: readonly string[]) =>
  createActor({
    userId: "usr_0000000000000001",
    sessionId: "ses_0000000000000001",
    roles,
  });
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
function setup(age: unknown) {
  vi.stubEnv("DEPLOYMENT_ENVIRONMENT", "staging");
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_synthetic");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_synthetic");
  mocks.auth.mockResolvedValue({
    isAuthenticated: true,
    userId: "user_synthetic",
    sessionId: "sess_synthetic",
    factorVerificationAge: age,
    sessionClaims: { publicMetadata: { fva: [0, 0], roles: [ROLES.operator] } },
  });
}
describe("MFA at the authenticated request composition boundary", () => {
  it("rejects staff before handing a context to a privileged use case, ignoring forged headers and metadata", async () => {
    setup([0, -1]);
    mocks.authenticate.mockResolvedValue(actor([ROLES.learner, ROLES.operator]));
    await expect(
      authenticatedWebRequestContext(
        new Request("https://stage.example/api/admin/operations", {
          headers: { "x-factor-verification-age": "[0,0]" },
        }),
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.telemetry).not.toHaveBeenCalled();
  });
  it("admits staff with both recently verified factors", async () => {
    setup([0, 0]);
    mocks.authenticate.mockResolvedValue(actor([ROLES.operator]));
    const context = await authenticatedWebRequestContext(
      new Request("https://stage.example/api/admin/operations"),
    );
    expect(() => requireRole(context, ROLES.operator)).not.toThrow();
    expect(mocks.telemetry).toHaveBeenCalledOnce();
  });
  it("role removal takes effect on the next request despite stale staff metadata and the same provider session", async () => {
    setup([0, 0]);
    mocks.authenticate
      .mockResolvedValueOnce(actor([ROLES.operator]))
      .mockResolvedValueOnce(actor([ROLES.learner]));
    const first = await authenticatedWebRequestContext(
      new Request("https://stage.example/api/admin/operations"),
    );
    expect(() => requireRole(first, ROLES.operator)).not.toThrow();
    const second = await authenticatedWebRequestContext(
      new Request("https://stage.example/api/admin/operations"),
    );
    expect(() => requireRole(second, ROLES.operator)).toThrow();
    expect(mocks.authenticate).toHaveBeenCalledTimes(2);
  });
});
