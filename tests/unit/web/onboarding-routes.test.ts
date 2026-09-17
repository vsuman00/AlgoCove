import { afterEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("../../../apps/web/src/auth/clerk-server", () => ({ auth: authMock }));

const { GET: onboardingGet, PUT: onboardingPut } = await import(
  "../../../apps/web/app/api/onboarding/route"
);

const profileInput = {
  goal: "Prepare for an algorithms interview",
  targetRole: "software engineer",
  timezone: "Asia/Kolkata",
  dailyCapacityMinutes: 45,
  horizonDays: 30,
  accessibility: { reducedMotion: true, highContrast: false, screenReader: false },
  preferredLanguages: ["python", "typescript"],
};

afterEach(() => {
  authMock.mockReset();
});

describe("onboarding route", () => {
  it("requires a verified Clerk session", async () => {
    authMock.mockResolvedValue({ isAuthenticated: false, userId: null, sessionId: null });

    const response = await onboardingGet(new Request("http://localhost/api/onboarding"));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("unauthenticated");
    expect(JSON.stringify(body)).not.toContain("clerk");
  });

  it("creates and updates the authenticated learner's versioned profile", async () => {
    authMock.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_clerk_onboarding_test",
      sessionId: "sess_clerk_onboarding_test",
    });

    const createdResponse = await onboardingPut(
      new Request("http://localhost/api/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileInput),
      }),
    );
    expect(createdResponse.status).toBe(200);
    const created = await createdResponse.json();
    expect(created.profile.version).toBe(1);
    expect(created.profile.updatedBy).toMatch(/^usr_/);

    const readResponse = await onboardingGet(new Request("http://localhost/api/onboarding"));
    expect(readResponse.status).toBe(200);
    await expect(readResponse.json()).resolves.toMatchObject({
      profile: { goal: profileInput.goal, version: 1, preferredLanguages: profileInput.preferredLanguages },
    });

    const updatedResponse = await onboardingPut(
      new Request("http://localhost/api/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profileInput, goal: "Build durable DSA intuition", version: 1 }),
      }),
    );
    expect(updatedResponse.status).toBe(200);
    await expect(updatedResponse.json()).resolves.toMatchObject({
      profile: { goal: "Build durable DSA intuition", version: 2 },
    });
  });
});
