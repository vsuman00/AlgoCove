import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
const auth = vi.hoisted(() => vi.fn());
const getRoadmapRepository = vi.hoisted(() => vi.fn());
vi.mock("../../../apps/web/src/auth/clerk-server", () => ({ auth }));
vi.mock("../../../apps/web/src/planning/runtime", () => ({ getRoadmapRepository }));
const { GET, POST } = await import("../../../apps/web/app/api/planning/roadmap/route");
const request = (body?: unknown) =>
  new Request(
    "http://localhost/api/planning/roadmap",
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
const input = {
  action: "pause",
  expectedToken: "evt_aaaaaaaaaaaaaaaa",
  idempotencyKey: "roadmap-route-command",
  learnerId: "usr_bbbbbbbbbbbbbbbb",
};
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_fixture");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_fixture");
});
afterEach(() => {
  vi.unstubAllEnvs();
  auth.mockReset();
  getRoadmapRepository.mockReset();
});
describe("roadmap route authentication and boundary validation", () => {
  it("authenticates before reads and commands", async () => {
    auth.mockResolvedValue({ isAuthenticated: false, userId: null, sessionId: null });
    for (const r of [await GET(request()), await POST(request(input))]) {
      expect(r.status).toBe(401);
      expect(r.headers.get("cache-control")).toBe("no-store");
    }
    expect(getRoadmapRepository).not.toHaveBeenCalled();
  });
  it("derives owner from session and ignores browser activation/validation claims", async () => {
    auth.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_plan_routes",
      sessionId: "session_plan_routes",
    });
    const command = vi
        .fn()
        .mockResolvedValue({ state: null, candidates: [], history: [], journal: [] }),
      view = vi.fn().mockResolvedValue({ state: null });
    getRoadmapRepository.mockReturnValue({ command, view });
    expect((await GET(request())).status).toBe(200);
    expect((await POST(request({ ...input, validated: true, role: "operator" }))).status).toBe(200);
    expect(command.mock.calls[0]![0].learnerId).not.toBe(input.learnerId);
    expect(command.mock.calls[0]![0].command).toEqual({
      action: "pause",
      expectedToken: input.expectedToken,
      idempotencyKey: input.idempotencyKey,
    });
  });
  it("rejects forged identifiers, absent tokens, unsupported actions and invalid occurrence commands", async () => {
    auth.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_plan_routes",
      sessionId: "session_plan_routes",
    });
    getRoadmapRepository.mockReturnValue({ command: vi.fn() });
    for (const invalid of [
      { ...input, expectedToken: "forged" },
      { ...input, expectedToken: undefined },
      { ...input, action: "publish" },
      { ...input, action: "accept", candidateId: "forged" },
      { ...input, action: "done" },
      { ...input, action: "reverse", occurrenceId: "one", reversesId: "forged" },
      { ...input, action: "build", scope: "custom" },
    ])
      expect((await POST(request(invalid))).status).toBe(400);
  });
  it("reports unavailable persistence honestly", async () => {
    auth.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_plan_routes",
      sessionId: "session_plan_routes",
    });
    getRoadmapRepository.mockReturnValue(null);
    expect((await GET(request())).status).toBe(503);
    expect((await POST(request(input))).status).toBe(503);
  });
});
