import { createHash, randomBytes } from "node:crypto";
import {
  authenticateSession,
  createActor,
  createSystemClock,
  type Actor,
  type IdGenerator,
  type SessionStore,
  type StoredSession,
} from "@algocove/application";
import { formatId, type Instant, type LearnerId, type OpaqueId, type Role } from "@algocove/domain";

export const LOCAL_SESSION_COOKIE = "algocove_session";

export type LocalPrincipal = {
  readonly principal: string;
  readonly userId: LearnerId;
  readonly roles: readonly Role[];
};

export type LocalIdentityAdapter = {
  login(principal: unknown): Promise<{ readonly token: string; readonly sessionId: OpaqueId<"session">; readonly actor: Actor }>;
  authenticate(token: unknown): Promise<Actor>;
  logout(token: unknown): Promise<void>;
};

type LocalClock = { now(): Instant };

function createRandomIdGenerator(): IdGenerator {
  return {
    generate<TKind extends Parameters<typeof formatId>[0]>(kind: TKind): OpaqueId<TKind> {
      const result = formatId(kind, randomBytes(20).toString("hex"));
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.value;
    },
  };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createLocalIdentityAdapter(options: {
  readonly principals: readonly LocalPrincipal[];
  readonly now?: () => Instant;
  readonly ids?: IdGenerator;
}): LocalIdentityAdapter {
  const clock: LocalClock = { now: options.now ?? createSystemClock().now };
  const ids = options.ids ?? createRandomIdGenerator();
  const sessions = new Map<string, StoredSession>();
  const principals = new Map(options.principals.map((principal) => [principal.principal, principal]));

  const store: SessionStore = {
    findByTokenHash: async (tokenHash) => sessions.get(tokenHash) ?? null,
    revoke: async (sessionId, revokedAt) => {
      for (const [tokenHash, session] of sessions) {
        if (session.sessionId === sessionId) {
          sessions.set(tokenHash, { ...session, revokedAt });
        }
      }
    },
  };

  return {
    async login(principalInput) {
      if (typeof principalInput !== "string" || !/^[a-z][a-z0-9._-]{1,63}$/.test(principalInput)) {
        throw new Error("Local principal is invalid.");
      }
      const principal = principals.get(principalInput);
      if (principal === undefined) {
        throw new Error("Local principal is not configured.");
      }
      const token = randomBytes(32).toString("base64url");
      const sessionId = ids.generate("session");
      const createdAt = clock.now();
      const expiresAt = new Date(Date.parse(createdAt) + 8 * 60 * 60 * 1000).toISOString() as Instant;
      const session: StoredSession = {
        sessionId,
        userId: principal.userId,
        roles: principal.roles,
        expiresAt,
        revokedAt: null,
      };
      sessions.set(hashToken(token), session);
      return { token, sessionId, actor: createActor({ userId: principal.userId, sessionId, roles: principal.roles }) };
    },
    async authenticate(token) {
      return authenticateSession({ token, tokenHasher: { hash: hashToken }, store, now: clock.now() });
    },
    async logout(token) {
      const session = typeof token === "string" ? await store.findByTokenHash(hashToken(token)) : null;
      if (session !== null) {
        await store.revoke(session.sessionId, clock.now());
      }
    },
  };
}

const defaultUserId = formatId("learner", "0000000000000001");
if (!defaultUserId.ok) {
  throw new Error(defaultUserId.error.message);
}
const defaultLearnerId = defaultUserId.value;

let defaultAdapter: LocalIdentityAdapter | undefined;
export function getLocalIdentityAdapter(): LocalIdentityAdapter {
  defaultAdapter ??= createLocalIdentityAdapter({
    principals: [{ principal: "learner", userId: defaultLearnerId, roles: ["learner"] }],
  });
  return defaultAdapter;
}
