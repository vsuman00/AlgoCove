import { webTraceId } from "../../../apps/web/src/auth/request-context";
import { describe, expect, it, vi } from "vitest";
import {
  createClerkIdentityAdapter,
  createInMemoryClerkIdentityStore,
  getClerkIdentityAdapter,
  getClerkIdentityStore,
} from "../../../apps/web/src/auth/clerk-adapter";
import { ROLES } from "@algocove/domain";

describe("Clerk identity boundary", () => {
  it("maps a Clerk subject to an opaque learner and loads roles from the server store", async () => {
    const store = createInMemoryClerkIdentityStore();
    const adapter = createClerkIdentityAdapter({ store });

    const actor = await adapter.authenticate({
      isAuthenticated: true,
      userId: "user_clerk_123",
      sessionId: "sess_clerk_123",
      claims: { publicMetadata: { roles: [ROLES.operator] } },
    });

    expect(actor.userId).toMatch(/^usr_[0-9a-hjkmnp-tv-z]{16,52}$/);
    expect(actor.sessionId).toMatch(/^ses_[0-9a-hjkmnp-tv-z]{16,52}$/);
    expect(actor.roles).toEqual([ROLES.learner]);
  });

  it("rejects signed-out and malformed Clerk auth state", async () => {
    const adapter = createClerkIdentityAdapter({ store: createInMemoryClerkIdentityStore() });

    await expect(
      adapter.authenticate({ isAuthenticated: false, userId: null, sessionId: null }),
    ).rejects.toMatchObject({ code: "unauthenticated" });
    await expect(
      adapter.authenticate({ isAuthenticated: true, userId: "", sessionId: "sess" }),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("does not trust roles, learner IDs, or session IDs supplied in Clerk metadata", async () => {
    const store = createInMemoryClerkIdentityStore();
    const adapter = createClerkIdentityAdapter({ store });
    const first = await adapter.authenticate({
      isAuthenticated: true,
      userId: "user_clerk_456",
      sessionId: "sess_clerk_456",
      claims: {
        userId: "usr_attacker",
        sessionId: "ses_attacker",
        publicMetadata: { roles: [ROLES.operator] },
      },
    });
    const second = await adapter.authenticate({
      isAuthenticated: true,
      userId: "user_clerk_456",
      sessionId: "sess_clerk_456",
      claims: { publicMetadata: { roles: [ROLES.operator] } },
    });

    expect(first).toEqual(second);
    expect(first.roles).toEqual([ROLES.learner]);
  });
  it("never substitutes ephemeral identity persistence when PostgreSQL is missing", async () => {
    vi.stubEnv("DATABASE_URL", "");
    try {
      const adapter = getClerkIdentityAdapter();
      await expect(
        adapter.authenticate({ isAuthenticated: false, userId: null, sessionId: null }),
      ).rejects.toMatchObject({ code: "unauthenticated" });
      await expect(
        adapter.authenticate({
          isAuthenticated: true,
          userId: "user_real",
          sessionId: "sess_real",
        }),
      ).rejects.toMatchObject({ status: 503 });
      expect(() => getClerkIdentityStore()).toThrow("Identity persistence is unavailable.");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("web request correlation", () => {
  it("shares a safe trace across request logs and responses and regenerates missing or unsafe values", () => {
    const request = new Request("http://localhost/api/auth/session");
    expect(webTraceId(request)).toMatch(/^req_[a-z0-9]{16,52}$/);
    expect(webTraceId(request)).toBe(webTraceId(request));
    expect(webTraceId(new Request(request))).not.toBe(webTraceId(request));
    expect(webTraceId(new Request(request, { headers: { "x-trace-id": "safe-trace-123" } }))).toBe(
      "safe-trace-123",
    );
    expect(webTraceId(new Request(request, { headers: { "x-trace-id": "unsafe trace" } }))).toMatch(
      /^req_/,
    );
  });
});
