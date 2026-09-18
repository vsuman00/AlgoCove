import { describe, expect, it } from "vitest";
import {
  createDraftSyncController,
  createBrowserDraftRecoveryStore,
} from "../../../apps/web/src/drafts/draft-sync";
import {
  formatId,
  parseInstant,
  startAttempt,
  startLearningSession,
  type PracticeDraft,
  type Result,
} from "@algocove/domain";

const now = "2026-09-18T10:00:00.000Z";
const nowInstant = must(parseInstant(now));
const learner = must(formatId("learner", "aaaaaaaaaaaaaaaa"));
const sessionId = must(formatId("session", "bbbbbbbbbbbbbbbb"));
const attemptId = must(formatId("attempt", "cccccccccccccccc"));
const problemVersionId = must(formatId("problemVersion", "dddddddddddddddd"));
const manifestId = must(formatId("languageManifest", "eeeeeeeeeeeeeeee"));
const draftId = must(formatId("draft", "ffffffffffffffff"));

function must<T, F>(result: Result<T, F>): T {
  if (!result.ok) throw new Error("Invalid draft-sync fixture.");
  return result.value;
}

function draft(overrides: Partial<PracticeDraft> = {}): PracticeDraft {
  const session = must(
    startLearningSession({
      sessionId,
      learnerId: learner,
      mode: "practice",
      startedAt: nowInstant,
    }),
  );
  const attempt = must(
    startAttempt(session, {
      attemptId,
      eventId: must(formatId("event", "1111111111111111")),
      problemVersionId,
      manifestId,
      language: "python",
      startedAt: nowInstant,
    }),
  ).attempt;
  return {
    draftId,
    attemptId: attempt.attemptId,
    learnerId: attempt.learnerId,
    problemVersionId: attempt.problemVersionId,
    manifestId: attempt.manifestId,
    language: attempt.language,
    kind: "source",
    currentText: "",
    currentRevision: 0,
    savedRevision: 0,
    version: 1,
    updatedAt: nowInstant,
    expiresAt: must(parseInstant("2026-09-25T10:00:00.000Z")),
    localRecoveryEnabled: true,
    ...overrides,
  };
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("Task 25b browser draft synchronization", () => {
  it("recovers one current snapshot after reload and clears it after server acknowledgement", async () => {
    const storage = new MemoryStorage();
    const recovery = createBrowserDraftRecoveryStore(storage);
    const server = draft();
    let latest = server;
    const transport = {
      async replaceCurrent(input: {
        draftId: typeof draftId;
        expectedVersion: number;
        text: string;
      }) {
        expect(input.expectedVersion).toBe(latest.version);
        latest = {
          ...latest,
          currentText: input.text,
          currentRevision: 1,
          version: 2,
          updatedAt: must(parseInstant("2026-09-18T10:01:00.000Z")),
        };
        return latest;
      },
      async getDraft() {
        return latest;
      },
    };

    const first = createDraftSyncController({
      learnerId: learner,
      initialDraft: server,
      transport,
      recoveryStore: recovery,
      now: () => "2026-09-18T10:01:00.000Z",
    });
    first.setCurrentText("function solve(input) { return input; }");
    expect(storage.length).toBe(1);

    const reloaded = createDraftSyncController({
      learnerId: learner,
      initialDraft: server,
      transport,
      recoveryStore: recovery,
      now: () => "2026-09-18T10:02:00.000Z",
    });
    expect(reloaded.recover()).toBe(true);
    expect(reloaded.snapshot()).toMatchObject({
      state: "pending",
      currentText: "function solve(input) { return input; }",
    });
    await expect(reloaded.sync()).resolves.toMatchObject({
      state: "synced",
      currentText: "function solve(input) { return input; }",
    });
    expect(storage.length).toBe(0);
  });

  it("keeps local work and exposes the newer remote draft on a two-tab conflict", async () => {
    const storage = new MemoryStorage();
    const recovery = createBrowserDraftRecoveryStore(storage);
    const server = draft();
    const remote = {
      ...server,
      currentText: "newer tab",
      currentRevision: 1,
      version: 2,
      updatedAt: must(parseInstant("2026-09-18T10:01:00.000Z")),
    };
    const transport = {
      async replaceCurrent() {
        const error = Object.assign(new Error("version conflict"), { code: "version_conflict" });
        throw error;
      },
      async getDraft() {
        return remote;
      },
    };
    const controller = createDraftSyncController({
      learnerId: learner,
      initialDraft: server,
      transport,
      recoveryStore: recovery,
      now: () => "2026-09-18T10:02:00.000Z",
    });

    controller.setCurrentText("local tab");
    const result = await controller.sync();

    expect(result).toMatchObject({
      state: "conflict",
      currentText: "local tab",
      remoteDraft: { currentText: "newer tab", version: 2 },
    });
    expect(storage.length).toBe(1);
  });

  it("retains a bounded local snapshot while offline and clears all learner recovery on logout", async () => {
    const storage = new MemoryStorage();
    const recovery = createBrowserDraftRecoveryStore(storage);
    const server = draft();
    const controller = createDraftSyncController({
      learnerId: learner,
      initialDraft: server,
      transport: {
        async replaceCurrent() {
          throw new Error("network unavailable");
        },
        async getDraft() {
          return server;
        },
      },
      recoveryStore: recovery,
      now: () => "2026-09-18T10:03:00.000Z",
    });

    controller.setCurrentText("offline source");
    expect((await controller.sync()).state).toBe("offline");
    expect(JSON.stringify(storage.getItem(storage.key(0) ?? ""))).not.toContain("keystroke");
    controller.clearLearnerRecovery();
    expect(storage.length).toBe(0);
  });

  it("does not recover a local snapshot after the server expiry boundary", () => {
    const storage = new MemoryStorage();
    const recovery = createBrowserDraftRecoveryStore(storage);
    const expired = draft({ expiresAt: must(parseInstant("2026-09-18T10:00:00.000Z")) });
    const controller = createDraftSyncController({
      learnerId: learner,
      initialDraft: expired,
      transport: {
        async replaceCurrent() {
          return expired;
        },
        async getDraft() {
          return expired;
        },
      },
      recoveryStore: recovery,
      now: () => "2026-09-18T10:00:00.000Z",
    });

    controller.setCurrentText("discarded");
    expect(controller.snapshot().state).toBe("expired");
    expect(storage.length).toBe(0);
  });
});
