import { describe, expect, it } from "vitest";
import {
  authenticateSession,
  createSessionActor,
  type SessionStore,
  type StoredSession,
} from "@algocove/application";
import { createLocalIdentityAdapter } from "../../../apps/web/src/auth/local-adapter";
import { formatId, parseInstant, ROLES, type Instant } from "@algocove/domain";

const now = parseInstant("2026-09-17T10:00:00.000Z");
const learner = formatId("learner", "0000000000000001");
const session = formatId("session", "0000000000000002");

if (!now.ok) throw new Error("identity test instant fixture is invalid");
if (!learner.ok) throw new Error("identity test learner fixture is invalid");
if (!session.ok) throw new Error("identity test session fixture is invalid");

const fixedNow: Instant = now.value;
const learnerId = learner.value;
const sessionId = session.value;
const expiry = parseInstant("2026-09-17T11:00:00.000Z");
if (!expiry.ok) throw new Error("identity test expiry fixture is invalid");
const expiresAt: Instant = expiry.value;

function storedSession(overrides: Partial<StoredSession> = {}): StoredSession {
  return {
    sessionId,
    userId: learnerId,
    roles: [ROLES.learner],
    expiresAt,
    revokedAt: null,
    ...overrides,
  };
}

describe("server-owned session authentication", () => {
  it("loads actor identity and roles from the session store", async () => {
    const store: SessionStore = {
      findByTokenHash: async (tokenHash) =>
        tokenHash === "hashed" ? storedSession({ roles: [ROLES.learner] }) : null,
      revoke: async () => undefined,
    };

    const actor = await authenticateSession({
      token: "opaque-token-that-is-long-enough-for-the-session-boundary",
      tokenHasher: { hash: () => "hashed" },
      store,
      now: fixedNow,
    });

    expect(actor.userId).toBe(learnerId);
    expect(actor.roles).toEqual([ROLES.learner]);
  });

  it("rejects expired or revoked sessions and never accepts browser roles", async () => {
    const inactiveRecords = [
      storedSession({ expiresAt: fixedNow, roles: [ROLES.learner] }),
      storedSession({ revokedAt: fixedNow, roles: [ROLES.learner] }),
    ];

    for (const record of inactiveRecords) {
      const store: SessionStore = {
        findByTokenHash: async () => record,
        revoke: async () => undefined,
      };

      await expect(
        authenticateSession({
          token: "opaque-token-that-is-long-enough-for-the-session-boundary",
          tokenHasher: { hash: () => "hashed" },
          store,
          now: fixedNow,
        }),
      ).rejects.toMatchObject({ code: "unauthenticated" });
    }

    const forgedRoleStore: SessionStore = {
      findByTokenHash: async () => storedSession({ roles: ["root"] }),
      revoke: async () => undefined,
    };
    await expect(
      authenticateSession({
        token: "opaque-token-that-is-long-enough-for-the-session-boundary",
        tokenHasher: { hash: () => "hashed" },
        store: forgedRoleStore,
        now: fixedNow,
      }),
    ).rejects.toMatchObject({ code: "invalid_request" });
  });

  it("creates actors only from verified session fields", () => {
    expect(() => createSessionActor(storedSession())).not.toThrow();
    expect(() => createSessionActor(storedSession({ roles: ["root"] }))).toThrow(
      "unrecognized role",
    );
  });
});

describe("local identity adapter", () => {
  it("rotates tokens and revokes the old session", async () => {
    const adapter = createLocalIdentityAdapter({
      now: () => fixedNow,
      principals: [{ principal: "learner", userId: learnerId, roles: [ROLES.learner] }],
    });

    const first = await adapter.login("learner");
    const second = await adapter.login("learner");

    expect(first.token).not.toBe(second.token);
    await expect(adapter.authenticate(first.token)).resolves.toMatchObject({
      userId: learnerId,
    });

    await adapter.logout(first.token);
    await expect(adapter.authenticate(first.token)).rejects.toMatchObject({
      code: "unauthenticated",
    });
    await expect(adapter.authenticate(second.token)).resolves.toMatchObject({
      userId: learnerId,
    });
  });
});
