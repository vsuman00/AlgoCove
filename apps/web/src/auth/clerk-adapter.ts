import { createHash } from "node:crypto";
import { createActor, type Actor, type LearnerProfileRepository } from "@algocove/application";
import { createPool, PostgresIdentityRepository } from "@algocove/db";
import { formatId, ROLES, type LearnerId, type OpaqueId, type Role } from "@algocove/domain";
import type { LearnerProfile } from "@algocove/domain";
import { authenticationRequired } from "@algocove/application";

export type ClerkAuthState = {
  readonly isAuthenticated: boolean;
  readonly userId: string | null;
  readonly sessionId: string | null;
  /** Claims are intentionally not used for AlgoCove roles or ownership. */
  readonly claims?: Readonly<Record<string, unknown>>;
};

export type ClerkIdentityStore = LearnerProfileRepository & {
  findOrCreateLearner(providerSubject: string): Promise<LearnerId>;
  getRoles(learnerId: LearnerId): Promise<readonly Role[]>;
};

export type ClerkIdentityAdapter = {
  authenticate(state: ClerkAuthState): Promise<Actor>;
};

const SUBJECT_PATTERN = /^[A-Za-z0-9_:-]{1,128}$/;

function stableId(
  kind: "learner" | "session",
  value: string,
): OpaqueId<"learner"> | OpaqueId<"session"> {
  const entropy = createHash("sha256").update(value, "utf8").digest("hex").slice(0, 40);
  const parsed = formatId(kind, entropy);
  if (!parsed.ok) {
    throw new Error(parsed.error.message);
  }
  return parsed.value;
}

export function createClerkIdentityAdapter(input: {
  readonly store: ClerkIdentityStore;
}): ClerkIdentityAdapter {
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
      const sessionId = stableId(
        "session",
        `clerk-session:${state.sessionId}`,
      ) as OpaqueId<"session">;
      return createActor({ userId: learnerId, sessionId, roles });
    },
  };
}

export function createInMemoryClerkIdentityStore(): ClerkIdentityStore {
  const learners = new Map<string, LearnerId>();
  const roles = new Map<LearnerId, readonly Role[]>();
  const profiles = new Map<LearnerId, LearnerProfile>();
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
    async get(learnerId) {
      return profiles.get(learnerId) ?? null;
    },
    async create(profile) {
      if (profiles.has(profile.learnerId)) {
        throw new Error("Learner profile already exists.");
      }
      profiles.set(profile.learnerId, profile);
      return profile;
    },
    async update(input) {
      const current = profiles.get(input.learnerId);
      if (current === undefined || current.version !== input.expectedVersion) return null;
      profiles.set(input.learnerId, input.profile);
      return input.profile;
    },
  };
}

let defaultStore: ClerkIdentityStore | undefined;
let defaultAdapter: ClerkIdentityAdapter | undefined;

function createConfiguredStore(): ClerkIdentityStore {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined || connectionString.length === 0) {
    return createInMemoryClerkIdentityStore();
  }
  if (
    !connectionString.startsWith("postgres://") &&
    !connectionString.startsWith("postgresql://")
  ) {
    throw new Error("DATABASE_URL must be a PostgreSQL connection string.");
  }
  const maxConnections = Number.parseInt(process.env.DATABASE_POOL_MAX ?? "10", 10);
  const statementTimeoutMs = Number.parseInt(
    process.env.DATABASE_STATEMENT_TIMEOUT_MS ?? "5000",
    10,
  );
  if (!Number.isInteger(maxConnections) || maxConnections < 1 || maxConnections > 64) {
    throw new Error("DATABASE_POOL_MAX is outside the supported range.");
  }
  if (
    !Number.isInteger(statementTimeoutMs) ||
    statementTimeoutMs < 100 ||
    statementTimeoutMs > 60_000
  ) {
    throw new Error("DATABASE_STATEMENT_TIMEOUT_MS is outside the supported range.");
  }
  return new PostgresIdentityRepository(
    createPool({
      connectionString,
      applicationName: "algocove-web-auth",
      maxConnections,
      statementTimeoutMs,
    }),
  );
}

export function getClerkIdentityStore(): ClerkIdentityStore {
  defaultStore ??= createConfiguredStore();
  return defaultStore;
}

export function getClerkIdentityAdapter(): ClerkIdentityAdapter {
  defaultStore ??= createConfiguredStore();
  defaultAdapter ??= createClerkIdentityAdapter({ store: defaultStore });
  return defaultAdapter;
}
