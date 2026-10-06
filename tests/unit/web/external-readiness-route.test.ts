import { afterEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => vi.fn());
const runtime = vi.hoisted(() => vi.fn());
vi.mock("../../../apps/web/src/auth/clerk-server", () => ({ auth }));
vi.mock("../../../apps/web/src/practice/runtime", () => ({ getPracticeRuntime: runtime }));
const { POST } = await import("../../../apps/web/app/api/practice/external-readiness/route");
const request = (body: unknown) =>
  new Request("http://localhost/api/practice/external-readiness", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
function signedIn() {
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_fixture");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_fixture");
  auth.mockResolvedValue({
    isAuthenticated: true,
    userId: "user_preparation",
    sessionId: "session_preparation",
  });
}
afterEach(() => {
  vi.unstubAllEnvs();
  auth.mockReset();
  runtime.mockReset();
});
describe("external readiness route", () => {
  it("authenticates before loading evidence", async () => {
    signedIn();
    auth.mockResolvedValue({ isAuthenticated: false, userId: null, sessionId: null });
    expect((await POST(request({ attemptId: "att_aaaaaaaaaaaaaaaa" }))).status).toBe(401);
    expect(runtime).not.toHaveBeenCalled();
  });
  it.each([
    { attemptId: "forged" },
    { attemptId: "att_aaaaaaaaaaaaaaaa", evidence: [] },
    { attemptId: "att_aaaaaaaaaaaaaaaa", bypassRequested: "yes" },
  ])("rejects client claims %j", async (body) => {
    signedIn();
    expect((await POST(request(body))).status).toBe(400);
    expect(runtime).not.toHaveBeenCalled();
  });
  it("does not enumerate another learner's attempt", async () => {
    signedIn();
    const load = vi.fn().mockResolvedValue(null);
    runtime.mockReturnValue({ externalReadiness: { loadOwnedReadiness: load } });
    const response = await POST(request({ attemptId: "att_aaaaaaaaaaaaaaaa" }));
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(load.mock.calls[0]?.[1]).toMatch(/^usr_/);
  });
  it("reports unavailable persistence", async () => {
    signedIn();
    runtime.mockReturnValue(null);
    expect((await POST(request({ attemptId: "att_aaaaaaaaaaaaaaaa" }))).status).toBe(503);
  });
});
