import type { DraftId, DraftKind, PracticeDraft, ProblemLanguage } from "@algocove/domain";

const RECOVERY_SCHEMA_VERSION = 1;
const RECOVERY_KEY_PREFIX = "algocove:draft-recovery:v1:";

export type DraftSyncState =
  "idle" | "pending" | "syncing" | "synced" | "offline" | "conflict" | "expired";

export type DraftRecoverySnapshot = {
  readonly schemaVersion: typeof RECOVERY_SCHEMA_VERSION;
  readonly learnerId: string;
  readonly draftId: string;
  readonly attemptId: string;
  readonly kind: DraftKind;
  readonly language: ProblemLanguage;
  readonly text: string;
  /** The server version this local snapshot was based on. */
  readonly serverVersion: number;
  readonly updatedAt: string;
  readonly expiresAt: string;
};

export type DraftRecoveryStore = {
  load(input: {
    readonly learnerId: string;
    readonly draftId: DraftId;
    readonly now: string;
  }): DraftRecoverySnapshot | null;
  save(snapshot: DraftRecoverySnapshot): void;
  clear(input: { readonly learnerId: string; readonly draftId: DraftId }): void;
  clearLearner(learnerId: string): void;
};

export type DraftSyncTransport = {
  replaceCurrent(input: {
    readonly draftId: DraftId;
    readonly expectedVersion: number;
    readonly text: string;
  }): Promise<PracticeDraft>;
  getDraft(draftId: DraftId): Promise<PracticeDraft>;
};

export type DraftSyncSnapshot = {
  readonly state: DraftSyncState;
  readonly serverDraft: PracticeDraft;
  readonly currentText: string;
  readonly remoteDraft: PracticeDraft | null;
};

export type DraftSyncController = {
  snapshot(): DraftSyncSnapshot;
  recover(): boolean;
  setCurrentText(text: string): void;
  sync(): Promise<DraftSyncSnapshot>;
  reconnect(): Promise<DraftSyncSnapshot>;
  refresh(): Promise<DraftSyncSnapshot>;
  clearLocalRecovery(): void;
  clearLearnerRecovery(): void;
};

export function createBrowserDraftRecoveryStore(
  storage: Storage = browserStorage(),
): DraftRecoveryStore {
  return {
    load(input) {
      const raw = storage.getItem(recoveryKey(input.learnerId, input.draftId));
      if (raw === null) return null;
      try {
        const parsed: unknown = JSON.parse(raw);
        const snapshot = parseRecoverySnapshot(parsed);
        if (
          snapshot === null ||
          snapshot.learnerId !== input.learnerId ||
          snapshot.draftId !== input.draftId ||
          Date.parse(input.now) >= Date.parse(snapshot.expiresAt)
        ) {
          storage.removeItem(recoveryKey(input.learnerId, input.draftId));
          return null;
        }
        return snapshot;
      } catch {
        storage.removeItem(recoveryKey(input.learnerId, input.draftId));
        return null;
      }
    },
    save(snapshot) {
      storage.setItem(recoveryKey(snapshot.learnerId, snapshot.draftId), JSON.stringify(snapshot));
    },
    clear(input) {
      storage.removeItem(recoveryKey(input.learnerId, input.draftId));
    },
    clearLearner(learnerId) {
      const prefix = `${RECOVERY_KEY_PREFIX}${encodeURIComponent(learnerId)}:`;
      const keysToRemove: string[] = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key?.startsWith(prefix)) keysToRemove.push(key);
      }
      for (const key of keysToRemove) storage.removeItem(key);
    },
  };
}

export function createDraftSyncController(input: {
  readonly learnerId: string;
  readonly initialDraft: PracticeDraft;
  readonly transport: DraftSyncTransport;
  readonly recoveryStore?: DraftRecoveryStore;
  readonly now?: () => string;
}): DraftSyncController {
  const now = input.now ?? (() => new Date().toISOString());
  const recoveryEnabled =
    input.initialDraft.localRecoveryEnabled && input.recoveryStore !== undefined;
  let serverDraft = input.initialDraft;
  let currentText = input.initialDraft.currentText;
  let state: DraftSyncState = "idle";
  let dirty = false;
  let remoteDraft: PracticeDraft | null = null;

  const snapshot = (): DraftSyncSnapshot => ({
    state,
    serverDraft,
    currentText,
    remoteDraft,
  });

  const persistRecovery = (): void => {
    if (!recoveryEnabled || input.recoveryStore === undefined || !dirty) return;
    input.recoveryStore.save({
      schemaVersion: RECOVERY_SCHEMA_VERSION,
      learnerId: input.learnerId,
      draftId: serverDraft.draftId,
      attemptId: serverDraft.attemptId,
      kind: serverDraft.kind,
      language: serverDraft.language,
      text: currentText,
      serverVersion: serverDraft.version,
      updatedAt: now(),
      expiresAt: serverDraft.expiresAt,
    });
  };

  const clearRecovery = (): void => {
    if (input.recoveryStore === undefined) return;
    input.recoveryStore.clear({ learnerId: input.learnerId, draftId: serverDraft.draftId });
  };

  const expired = (): boolean => Date.parse(now()) >= Date.parse(serverDraft.expiresAt);

  return {
    snapshot,
    recover() {
      if (!recoveryEnabled || input.recoveryStore === undefined || expired()) return false;
      const recovered = input.recoveryStore.load({
        learnerId: input.learnerId,
        draftId: serverDraft.draftId,
        now: now(),
      });
      if (
        recovered === null ||
        recovered.attemptId !== serverDraft.attemptId ||
        recovered.kind !== serverDraft.kind ||
        recovered.language !== serverDraft.language ||
        recovered.expiresAt !== serverDraft.expiresAt ||
        Date.parse(recovered.updatedAt) <= Date.parse(serverDraft.updatedAt)
      ) {
        if (recovered !== null) clearRecovery();
        return false;
      }
      currentText = recovered.text;
      dirty = currentText !== serverDraft.currentText;
      state = dirty ? "pending" : "idle";
      return dirty;
    },
    setCurrentText(text) {
      if (expired()) {
        state = "expired";
        clearRecovery();
        return;
      }
      if (text === currentText) return;
      currentText = text;
      dirty = currentText !== serverDraft.currentText;
      remoteDraft = null;
      state = dirty ? "pending" : "idle";
      if (dirty) persistRecovery();
      else clearRecovery();
    },
    async sync() {
      if (expired()) {
        state = "expired";
        clearRecovery();
        return snapshot();
      }
      if (!dirty) {
        state = "synced";
        return snapshot();
      }
      state = "syncing";
      try {
        serverDraft = await input.transport.replaceCurrent({
          draftId: serverDraft.draftId,
          expectedVersion: serverDraft.version,
          text: currentText,
        });
        currentText = serverDraft.currentText;
        dirty = false;
        remoteDraft = null;
        state = "synced";
        clearRecovery();
      } catch (error) {
        if (isVersionConflict(error)) {
          state = "conflict";
          try {
            remoteDraft = await input.transport.getDraft(serverDraft.draftId);
          } catch {
            remoteDraft = null;
          }
          persistRecovery();
        } else if (isExpired(error)) {
          state = "expired";
          clearRecovery();
        } else {
          state = "offline";
          persistRecovery();
        }
      }
      return snapshot();
    },
    async reconnect() {
      return this.sync();
    },
    async refresh() {
      if (expired()) {
        state = "expired";
        clearRecovery();
        return snapshot();
      }
      const latest = await input.transport.getDraft(serverDraft.draftId);
      if (dirty) {
        remoteDraft = latest;
        state = latest.version === serverDraft.version ? "pending" : "conflict";
        persistRecovery();
        return snapshot();
      }
      serverDraft = latest;
      currentText = latest.currentText;
      remoteDraft = null;
      state = "synced";
      clearRecovery();
      return snapshot();
    },
    clearLocalRecovery() {
      clearRecovery();
    },
    clearLearnerRecovery() {
      input.recoveryStore?.clearLearner(input.learnerId);
    },
  };
}

function browserStorage(): Storage {
  if (typeof globalThis.localStorage === "undefined") {
    throw new Error("Local draft recovery requires browser storage.");
  }
  return globalThis.localStorage;
}

function recoveryKey(learnerId: string, draftId: string): string {
  return `${RECOVERY_KEY_PREFIX}${encodeURIComponent(learnerId)}:${encodeURIComponent(draftId)}`;
}

function parseRecoverySnapshot(value: unknown): DraftRecoverySnapshot | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.schemaVersion !== RECOVERY_SCHEMA_VERSION ||
    typeof candidate.learnerId !== "string" ||
    typeof candidate.draftId !== "string" ||
    typeof candidate.attemptId !== "string" ||
    (candidate.kind !== "source" && candidate.kind !== "pseudocode") ||
    typeof candidate.language !== "string" ||
    typeof candidate.text !== "string" ||
    typeof candidate.serverVersion !== "number" ||
    !Number.isSafeInteger(candidate.serverVersion) ||
    candidate.serverVersion <= 0 ||
    typeof candidate.updatedAt !== "string" ||
    typeof candidate.expiresAt !== "string" ||
    Number.isNaN(Date.parse(candidate.updatedAt)) ||
    Number.isNaN(Date.parse(candidate.expiresAt))
  ) {
    return null;
  }
  return {
    schemaVersion: RECOVERY_SCHEMA_VERSION,
    learnerId: candidate.learnerId,
    draftId: candidate.draftId,
    attemptId: candidate.attemptId,
    kind: candidate.kind,
    language: candidate.language as ProblemLanguage,
    text: candidate.text,
    serverVersion: candidate.serverVersion,
    updatedAt: candidate.updatedAt,
    expiresAt: candidate.expiresAt,
  };
}

function isVersionConflict(error: unknown): boolean {
  return isErrorCode(error, "version_conflict") || (isErrorCode(error, "conflict") && true);
}

function isExpired(error: unknown): boolean {
  return isErrorCode(error, "expired");
}

function isErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
