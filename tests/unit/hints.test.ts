import { describe, expect, it } from "vitest";
import {
  createActor,
  createFixedClock,
  createRequestContext,
  createSequenceIdGenerator,
  revealAuthoredHint,
  type HintRepository,
} from "@algocove/application";
import {
  decideHintReveal,
  formatId,
  parseInstant,
  startAttempt,
  startLearningSession,
  type AuthoredHint,
  type HintExposure,
  type LearningAttempt,
  type ProblemVersionId,
  type Result,
} from "@algocove/domain";

const now = must(parseInstant("2026-09-18T10:00:00.000Z"));
const learner = must(formatId("learner", "aaaaaaaaaaaaaaaa"));
const otherLearner = must(formatId("learner", "bbbbbbbbbbbbbbbb"));
const sessionId = must(formatId("session", "cccccccccccccccc"));
const attemptId = must(formatId("attempt", "dddddddddddddddd"));
const problemVersionId = must(formatId("problemVersion", "eeeeeeeeeeeeeeee"));
const manifestId = must(formatId("languageManifest", "ffffffffffffffff"));

function must<T, F>(result: Result<T, F>): T {
  if (!result.ok) throw new Error("Invalid hint fixture.");
  return result.value;
}

function context(actorId = learner) {
  return createRequestContext({
    actor: createActor({ userId: actorId, sessionId, roles: ["learner"] }),
    clock: createFixedClock(now),
    ids: createSequenceIdGenerator(100),
    serviceName: "hint-test",
  });
}

function attempt(owner = learner): LearningAttempt {
  const session = must(
    startLearningSession({ sessionId, learnerId: owner, mode: "learn", startedAt: now }),
  );
  return must(
    startAttempt(session, {
      attemptId,
      eventId: must(formatId("event", "2222222222222222")),
      problemVersionId,
      manifestId,
      language: "python",
      startedAt: now,
    }),
  ).attempt;
}

class FakeHintRepository implements HintRepository {
  readonly attempts = new Map<string, LearningAttempt>([[attemptId, attempt()]]);
  readonly hints = new Map<string, AuthoredHint>([
    [
      "hint-1",
      {
        hintId: "hint-1",
        problemVersionId,
        tier: 1,
        kind: "clarification",
        body: "What information must remain true after each step?",
      },
    ],
    [
      "solution",
      {
        hintId: "solution",
        problemVersionId,
        tier: 6,
        kind: "solution_review",
        body: "Review the complete authored solution after the gate.",
      },
    ],
  ]);
  readonly exposures: HintExposure[] = [];
  failNextSave = false;
  racedExposure: HintExposure | null = null;

  async getAttempt(id: LearningAttempt["attemptId"], owner: LearningAttempt["learnerId"]) {
    const value = this.attempts.get(id);
    return value?.learnerId === owner ? value : null;
  }

  async getAuthoredHint(input: { problemVersionId: ProblemVersionId; hintId: string }) {
    const value = this.hints.get(input.hintId);
    return value?.problemVersionId === input.problemVersionId ? value : null;
  }

  async getExposureByIdempotency(input: {
    learnerId: LearningAttempt["learnerId"];
    idempotencyKey: string;
  }) {
    return (
      this.exposures.find(
        (exposure) =>
          exposure.learnerId === input.learnerId &&
          exposure.idempotencyKey === input.idempotencyKey,
      ) ?? null
    );
  }

  async getHighestExposedTier(input: {
    learnerId: LearningAttempt["learnerId"];
    problemVersionId: ProblemVersionId;
  }) {
    return this.exposures
      .filter(
        (exposure) =>
          exposure.learnerId === input.learnerId &&
          exposure.problemVersionId === input.problemVersionId,
      )
      .reduce((highest, exposure) => Math.max(highest, exposure.tier), 0);
  }

  async saveExposure(exposure: HintExposure) {
    if (this.racedExposure !== null) {
      const raced = this.racedExposure;
      this.racedExposure = null;
      this.exposures.push(raced);
      return null;
    }
    if (this.failNextSave) {
      this.failNextSave = false;
      return null;
    }
    if (await this.getExposureByIdempotency(exposure)) return null;
    this.exposures.push(exposure);
    return exposure;
  }
}

describe("Task 28 deterministic authored hints", () => {
  it("persists exposure before returning authored text and replays the same request", async () => {
    const repository = new FakeHintRepository();
    const first = await revealAuthoredHint(context(), repository, {
      attemptId,
      hintId: "hint-1",
      requestedTier: 1,
      idempotencyKey: "hint-reveal-1",
    });
    expect(first).toMatchObject({ disposition: "committed", hint: { body: expect.any(String) } });
    expect(repository.exposures).toHaveLength(1);

    const replay = await revealAuthoredHint(context(), repository, {
      attemptId,
      hintId: "hint-1",
      requestedTier: 1,
      idempotencyKey: "hint-reveal-1",
    });
    expect(replay).toMatchObject({ disposition: "replayed", exposure: { tier: 1 } });
    expect(repository.exposures).toHaveLength(1);
  });

  it("rejects premature solution review and preserves state when the exposure write fails", async () => {
    const repository = new FakeHintRepository();
    await expect(
      revealAuthoredHint(context(), repository, {
        attemptId,
        hintId: "solution",
        requestedTier: 6,
        idempotencyKey: "solution-too-early",
      }),
    ).rejects.toMatchObject({
      code: "invalid_request",
      details: { field: "ceiling_exceeded" },
    });

    repository.failNextSave = true;
    await expect(
      revealAuthoredHint(context(), repository, {
        attemptId,
        hintId: "hint-1",
        requestedTier: 1,
        idempotencyKey: "write-fails",
      }),
    ).rejects.toMatchObject({ code: "version_conflict" });
    expect(repository.exposures).toHaveLength(0);
  });

  it("rejects an idempotency race whose exposure belongs to another problem version", async () => {
    const repository = new FakeHintRepository();
    const otherProblemVersionId = must(formatId("problemVersion", "1111111111111111"));
    repository.racedExposure = {
      exposureId: must(formatId("event", "5555555555555555")),
      learnerId: learner,
      attemptId,
      problemVersionId: otherProblemVersionId,
      hintId: "hint-1",
      tier: 1,
      idempotencyKey: "wrong-problem-race",
      exposedAt: now,
    };

    await expect(
      revealAuthoredHint(context(), repository, {
        attemptId,
        hintId: "hint-1",
        requestedTier: 1,
        idempotencyKey: "wrong-problem-race",
      }),
    ).rejects.toMatchObject({ code: "version_conflict" });
  });

  it("keeps the ladder deterministic and cumulative across attempts", async () => {
    expect(
      decideHintReveal({
        mode: "learn",
        requestedTier: 6,
        highestExposedTier: 0,
        solutionReviewApproved: false,
      }),
    ).toMatchObject({ ok: false, error: { code: "ceiling_exceeded" } });
    expect(
      decideHintReveal({
        mode: "practice",
        requestedTier: 6,
        highestExposedTier: 0,
        solutionReviewApproved: false,
      }),
    ).toMatchObject({ ok: false, error: { code: "solution_gate_required" } });

    const repository = new FakeHintRepository();
    await revealAuthoredHint(context(), repository, {
      attemptId,
      hintId: "hint-1",
      requestedTier: 1,
      idempotencyKey: "first-attempt",
    });
    const nextAttemptId = must(formatId("attempt", "3333333333333333"));
    repository.attempts.set(nextAttemptId, {
      ...attempt(),
      attemptId: nextAttemptId,
    });
    repository.hints.set("hint-2", {
      hintId: "hint-2",
      problemVersionId,
      tier: 2,
      kind: "example",
      body: "Use a smaller example to inspect the invariant.",
    });
    const second = await revealAuthoredHint(context(), repository, {
      attemptId: nextAttemptId,
      hintId: "hint-2",
      requestedTier: 2,
      idempotencyKey: "second-attempt",
    });
    expect(second.exposure.tier).toBe(2);
    expect(repository.exposures).toHaveLength(2);
  });

  it("does not expose another learner's authored assistance", async () => {
    const repository = new FakeHintRepository();
    await expect(
      revealAuthoredHint(context(otherLearner), repository, {
        attemptId,
        hintId: "hint-1",
        requestedTier: 1,
        idempotencyKey: "other-learner",
      }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
