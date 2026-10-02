import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => vi.fn());
const getRoadmapIntentRepository = vi.hoisted(() => vi.fn());
vi.mock("../../../apps/web/src/auth/clerk-server", () => ({ auth }));
vi.mock("../../../apps/web/src/planning/runtime", () => ({ getRoadmapIntentRepository }));
const { GET, POST } = await import("../../../apps/web/app/api/planning/intent/route");
const preferences = {
  goal: "Practice patterns",
  targetRole: "Engineer",
  horizonMonths: 1,
  startDay: "2026-12-31",
  timezone: "Asia/Kolkata",
  dailyCapacityMinutes: 45,
  studyWeekdays: [1, 2, 3],
  preferredLanguages: ["python"],
  collectionIds: [],
};
const input = {
  planId: null,
  expectedVersion: null,
  idempotencyKey: "planning-api-command",
  preferences,
  learnerId: "usr_bbbbbbbbbbbbbbbb",
};
const request = (body?: unknown) =>
  new Request(
    "http://localhost/api/planning/intent",
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_fixture");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_fixture");
});
afterEach(() => {
  auth.mockReset();
  getRoadmapIntentRepository.mockReset();
  vi.unstubAllEnvs();
});
describe("private planning preference routes", () => {
  it("authenticates before accessing read or write persistence", async () => {
    auth.mockResolvedValue({ isAuthenticated: false, userId: null, sessionId: null });
    for (const response of [await GET(request()), await POST(request(input))]) {
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
    expect(getRoadmapIntentRepository).not.toHaveBeenCalled();
  });
  it("derives the owner from the session and persists only normalized preferences", async () => {
    auth.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_planning_routes",
      sessionId: "session_planning_routes",
    });
    const getContext = vi.fn().mockResolvedValue({ intent: null, profile: null, collections: [] });
    const save = vi.fn().mockImplementation(async (value) => ({
      intent: {
        planId: value.newPlanId,
        learnerId: value.learnerId,
        version: 1,
        preferences: value.preferences,
        savedAt: value.now,
      },
      disposition: "committed",
    }));
    getRoadmapIntentRepository.mockReturnValue({ getContext, save });
    expect((await GET(request())).status).toBe(200);
    const response = await POST(request(input));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body.intent.preferences).toMatchObject({ endDay: "2027-01-31" });
    expect(save.mock.calls[0]?.[0].learnerId).not.toBe(input.learnerId);
    expect(save.mock.calls[0]?.[0].preferences).not.toHaveProperty("learnerId");
  });
  it("rejects invalid horizons, forged plan identifiers, mismatched target dates and version tokens", async () => {
    auth.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_planning_routes",
      sessionId: "session_planning_routes",
    });
    const save = vi.fn();
    getRoadmapIntentRepository.mockReturnValue({ save });
    for (const invalid of [
      { ...input, preferences: { ...preferences, horizonMonths: 5 } },
      { ...input, planId: "wrong" },
      { ...input, expectedVersion: 1 },
      { ...input, preferences: { ...preferences, targetDay: "2027-02-01" } },
      { ...input, idempotencyKey: "bad" },
    ])
      expect((await POST(request(invalid))).status).toBe(400);
    expect(save).not.toHaveBeenCalled();
  });
  it("reports unavailable persistence without fabricating an active plan", async () => {
    auth.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_planning_routes",
      sessionId: "session_planning_routes",
    });
    getRoadmapIntentRepository.mockReturnValue(null);
    expect((await GET(request())).status).toBe(503);
    expect((await POST(request(input))).status).toBe(503);
  });
});
