import { afterEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("../../../apps/web/src/auth/clerk-server", () => ({ auth: authMock }));

const { GET: session } = await import("../../../apps/web/app/api/auth/session/route");

afterEach(() => {
  authMock.mockReset();
});

describe("Clerk session route", () => {
  it("returns an internal actor projection for a verified Clerk session", async () => {
    authMock.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_clerk_route",
      sessionId: "sess_clerk_route",
    });

    const response = await session();

    expect(authMock).toHaveBeenCalledOnce();
    const body = await response.json();
    expect({ status: response.status, body }).toMatchObject({
      status: 200,
      body: { authenticated: true, user: { roles: ["learner"] } },
    });
    expect(body.user.id).toMatch(/^usr_/);
  });

  it("returns 401 for a signed-out Clerk session", async () => {
    authMock.mockResolvedValue({ isAuthenticated: false, userId: null, sessionId: null });

    const response = await session();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      authenticated: false,
      error: { code: "unauthenticated" },
    });
  });
});
