import { createHash } from "node:crypto";
import { createActor, type Actor } from "@algocove/application";
import { formatId, ROLES, type LearnerId, type OpaqueId, type Role } from "@algocove/domain";
import { authenticationRequired } from "@algocove/application";

export type ClerkAuthState = {
  readonly isAuthenticated: boolean;
  readonly userId: string | null;
  readonly sessionId: string | null;
  /** Claims are intentionally not used for AlgoCove roles or ownership. */
  readonly claims?: Readonly<Record<string, unknown>>;
};

export type ClerkIdentityStore = {
  findOrCreateLearner(providerSubject: string): Promise<LearnerId>;
  getRoles(learnerId: LearnerId): Promise<readonly Role[]>;
};

export type ClerkIdentityAdapter = {
  authenticate(state: ClerkAuthState): Promise<Actor>;
};

const SUBJECT_PATTERN = /^[A-Za-z0-9_:-]{1,128}$/;

function stableId(kind: "learner" | "session", value: string): OpaqueId<"learner"> | OpaqueId<"session"> {
  const entropy = createHash("sha256").update(value, "utf8").digest("hex").slice(0, 40);
  const parsed = formatId(kind, entropy);
  if (!parsed.ok) {
    throw new Error(parsed.error.message);
  }
  return parsed.value;
}

export function createClerkIdentityAdapter(input: { readonly store: ClerkIdentityStore }): ClerkIdentityAdapter {
  return {
    async authenticate(state) {
      if (
        !state.isAuthenticated ||
        state.userId === null ||
        state.sessionId === null ||
        !SUBJECT_PATTERN.test(state.userId) ||
        !SUBJECT_PATTERN.test(state.sessionId)
      ) {
        throw authenticationRequired();
      }
      const learnerId = await input.store.findOrCreateLearner(`clerk:${state.userId}`);
      const roles = await input.store.getRoles(learnerId);
      if (roles.length === 0) {
        throw authenticationRequired("Authenticated account has no active AlgoCove role.");
      }
      const sessionId = stableId("session", `clerk-session:${state.sessionId}`) as OpaqueId<"session">;
      return createActor({ userId: learnerId, sessionId, roles });
    },
  };
}

export function createInMemoryClerkIdentityStore(): ClerkIdentityStore {
  const learners = new Map<string, LearnerId>();
  const roles = new Map<LearnerId, readonly Role[]>();
  return {
    async findOrCreateLearner(providerSubject) {
      const existing = learners.get(providerSubject);
      if (existing !== undefined) return existing;
      const learnerId = stableId("learner", providerSubject) as LearnerId;
      learners.set(providerSubject, learnerId);
      roles.set(learnerId, [ROLES.learner]);
      return learnerId;
    },
    async getRoles(learnerId) {
      return roles.get(learnerId) ?? [];
    },
  };
}

let defaultStore: ClerkIdentityStore | undefined;
let defaultAdapter: ClerkIdentityAdapter | undefined;
export function getClerkIdentityAdapter(): ClerkIdentityAdapter {
  defaultStore ??= createInMemoryClerkIdentityStore();
  defaultAdapter ??= createClerkIdentityAdapter({ store: defaultStore });
  return defaultAdapter;
}
