import { describe, expect, it } from "vitest";
import {
  createClerkIdentityAdapter,
  createInMemoryClerkIdentityStore,
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
});
