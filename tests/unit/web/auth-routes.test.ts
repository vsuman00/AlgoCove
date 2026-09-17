import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as login } from "../../../apps/web/app/api/auth/login/route";
import { POST as logout } from "../../../apps/web/app/api/auth/logout/route";
import { GET as session } from "../../../apps/web/app/api/auth/session/route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("local identity routes", () => {
  it("creates a server-owned session and returns only the safe actor projection", async () => {
    const response = await login(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ principal: "learner", roles: ["operator"] }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("set-cookie")).toMatch(/algocove_session=[^;]+; Path=\/; HttpOnly/);
    await expect(response.json()).resolves.toEqual({
      authenticated: true,
      user: { id: "usr_0000000000000001", roles: ["learner"] },
    });
  });

  it("rejects a missing or revoked cookie", async () => {
    const missing = await session(new Request("http://localhost/api/auth/session"));
    expect(missing.status).toBe(401);

    const loginResponse = await login(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ principal: "learner" }),
      }),
    );
    const cookie = loginResponse.headers.get("set-cookie")!.split(";", 1)[0]!;
    const active = await session(
      new Request("http://localhost/api/auth/session", { headers: { cookie } }),
    );
    expect(active.status).toBe(200);

    const loggedOut = await logout(
      new Request("http://localhost/api/auth/logout", { method: "POST", headers: { cookie } }),
    );
    expect(loggedOut.status).toBe(200);
    expect(loggedOut.headers.get("set-cookie")).toContain("Max-Age=0");

    const revoked = await session(
      new Request("http://localhost/api/auth/session", { headers: { cookie } }),
    );
    expect(revoked.status).toBe(401);
  });
});
