import { describe, expect, it } from "vitest";
import {
  createActor,
  createFixedClock,
  createRequestContext,
  createSequenceIdGenerator,
  replacePracticeDraftCurrent,
  savePracticeDraftRevision,
  startPracticeDraft as startDraftUseCase,
  type DraftRepository,
} from "@algocove/application";
import {
  formatId,
  parseInstant,
  startAttempt,
  startLearningSession,
  type DraftId,
  type LearningAttempt,
  type PracticeDraft,
  type Result,
  type SavedDraftRevision,
} from "@algocove/domain";

const now = must(parseInstant("2026-09-18T10:00:00.000Z"));
const learner = must(formatId("learner", "aaaaaaaaaaaaaaaa"));
const sessionId = must(formatId("session", "bbbbbbbbbbbbbbbb"));
const attemptId = must(formatId("attempt", "cccccccccccccccc"));
const problemVersionId = must(formatId("problemVersion", "dddddddddddddddd"));
const manifestId = must(formatId("languageManifest", "eeeeeeeeeeeeeeee"));
const draftId = must(formatId("draft", "ffffffffffffffff"));

function must<T, F>(result: Result<T, F>): T {
  if (!result.ok) throw new Error("Invalid draft fixture.");
  return result.value;
}

function context() {
  return createRequestContext({
    actor: createActor({ userId: learner, sessionId, roles: ["learner"] }),
    clock: createFixedClock(now),
    ids: createSequenceIdGenerator(100),
    serviceName: "draft-test",
  });
}

function attempt(): LearningAttempt {
  const session = must(
    startLearningSession({ sessionId, learnerId: learner, mode: "practice", startedAt: now }),
  );
  return must(
    startAttempt(session, {
      attemptId,
      eventId: must(formatId("event", "1111111111111111")),
      problemVersionId,
      manifestId,
      language: "python",
      startedAt: now,
    }),
  ).attempt;
}

class FakeDraftRepository implements DraftRepository {
  readonly drafts = new Map<string, PracticeDraft>();
  readonly revisions: SavedDraftRevision[] = [];
  readonly attempts = new Map<string, LearningAttempt>([[attemptId, attempt()]]);

  async getAttempt(id: LearningAttempt["attemptId"], owner: LearningAttempt["learnerId"]) {
    const value = this.attempts.get(id);
    return value?.learnerId === owner ? value : null;
  }

  async createDraft(draft: PracticeDraft) {
    this.drafts.set(draft.draftId, draft);
    return draft;
  }

  async getDraft(id: DraftId, owner: LearningAttempt["learnerId"]) {
    const value = this.drafts.get(id);
    return value?.learnerId === owner ? value : null;
  }

  async replaceCurrentDraft(input: { draft: PracticeDraft; expectedVersion: number }) {
    const current = this.drafts.get(input.draft.draftId);
    if (current?.version !== input.expectedVersion) return null;
    this.drafts.set(input.draft.draftId, input.draft);
    return input.draft;
  }

  async saveDraftRevision(input: {
    draft: PracticeDraft;
    revision: SavedDraftRevision;
    expectedVersion: number;
  }) {
    const current = this.drafts.get(input.draft.draftId);
    if (current?.version !== input.expectedVersion) return null;
    this.drafts.set(input.draft.draftId, input.draft);
    this.revisions.push(input.revision);
    return input.draft;
  }

  async listDraftRevisions(id: DraftId, owner: LearningAttempt["learnerId"]) {
    return this.revisions.filter(
      (revision) => revision.draftId === id && revision.learnerId === owner,
    );
  }

  async deleteLearnerDrafts(owner: LearningAttempt["learnerId"]) {
    for (const [id, draft] of this.drafts) {
      if (draft.learnerId === owner) this.drafts.delete(id);
    }
  }
}

describe("Task 25b recoverable drafts", () => {
  it("replaces current snapshots and appends only explicit saved revisions", async () => {
    const repository = new FakeDraftRepository();
    const started = await startDraftUseCase(context(), repository, {
      draftId,
      attemptId,
      kind: "source",
    });
    const current = await replacePracticeDraftCurrent(context(), repository, {
      draftId,
      expectedVersion: started.version,
      text: "solve(input)",
    });
    expect(current).toMatchObject({
      state: "saved_current",
      draft: { currentRevision: 1, savedRevision: 0 },
    });
    expect(repository.revisions).toHaveLength(0);

    const saved = await savePracticeDraftRevision(context(), repository, {
      draftId,
      expectedVersion: current.draft.version,
    });
    expect(saved).toMatchObject({ state: "saved_revision", draft: { savedRevision: 1 } });
    expect(repository.revisions).toHaveLength(1);
    expect(repository.revisions[0]?.text).toBe("solve(input)");

    const replacedAgain = await replacePracticeDraftCurrent(context(), repository, {
      draftId,
      expectedVersion: saved.draft.version,
      text: "solve(input)\nreturn answer",
    });
    expect(replacedAgain.draft.savedRevision).toBe(1);
    expect(repository.revisions).toHaveLength(1);
  });

  it("rejects stale writers without overwriting the newer current snapshot", async () => {
    const repository = new FakeDraftRepository();
    const started = await startDraftUseCase(context(), repository, {
      draftId,
      attemptId,
      kind: "pseudocode",
    });
    const newer = await replacePracticeDraftCurrent(context(), repository, {
      draftId,
      expectedVersion: started.version,
      text: "state: answer\nloop until done",
    });

    await expect(
      replacePracticeDraftCurrent(context(), repository, {
        draftId,
        expectedVersion: started.version,
        text: "stale tab content",
      }),
    ).rejects.toMatchObject({ code: "version_conflict" });
    expect(repository.drafts.get(draftId)?.currentText).toBe(newer.draft.currentText);
  });

  it("clears all owner-scoped recovery state without retaining keystroke history", async () => {
    const repository = new FakeDraftRepository();
    const started = await startDraftUseCase(context(), repository, {
      draftId,
      attemptId,
      kind: "source",
      localRecoveryEnabled: true,
    });
    await replacePracticeDraftCurrent(context(), repository, {
      draftId,
      expectedVersion: started.version,
      text: "private source",
    });
    expect(JSON.stringify(repository.drafts.get(draftId))).not.toContain("keystroke");
    await repository.deleteLearnerDrafts(learner);
    expect(repository.drafts.size).toBe(0);
  });
});
