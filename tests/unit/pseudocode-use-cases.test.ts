import { describe, expect, it } from "vitest";
import {
  createActor,
  createFixedClock,
  createRequestContext,
  createSequenceIdGenerator,
  evaluateOwnedPseudocode,
  replaceOwnedPseudocodeCurrent,
  saveOwnedPseudocodeRevision,
  startOwnedPseudocode,
  type PseudocodeRepository,
} from "@algocove/application";
import {
  formatId,
  parseInstant,
  startAttempt,
  startLearningSession,
  type LearningAttempt,
  type PseudocodeArtifact,
  type PseudocodeId,
  type PseudocodeRevision,
  type Result,
} from "@algocove/domain";

const now = must(parseInstant("2026-09-18T10:00:00.000Z"));
const learner = must(formatId("learner", "aaaaaaaaaaaaaaaa"));
const otherLearner = must(formatId("learner", "bbbbbbbbbbbbbbbb"));
const sessionId = must(formatId("session", "cccccccccccccccc"));
const attemptId = must(formatId("attempt", "dddddddddddddddd"));
const problemVersionId = must(formatId("problemVersion", "eeeeeeeeeeeeeeee"));
const manifestId = must(formatId("languageManifest", "ffffffffffffffff"));
const pseudocodeId = must(formatId("pseudocode", "1111111111111111"));
const observationId = must(formatId("event", "2222222222222222"));

function must<T, F>(result: Result<T, F>): T {
  if (!result.ok) throw new Error("Invalid pseudocode application fixture.");
  return result.value;
}

function context(actorId = learner) {
  return createRequestContext({
    actor: createActor({ userId: actorId, sessionId, roles: ["learner"] }),
    clock: createFixedClock(now),
    ids: createSequenceIdGenerator(100),
    serviceName: "pseudocode-test",
  });
}

function attempt(): LearningAttempt {
  const session = must(
    startLearningSession({ sessionId, learnerId: learner, mode: "learn", startedAt: now }),
  );
  return must(
    startAttempt(session, {
      attemptId,
      eventId: observationId,
      problemVersionId,
      manifestId,
      language: "python",
      startedAt: now,
    }),
  ).attempt;
}

const fields = {
  inputs: "numbers",
  state: "two indices",
  initialization: "left and right",
  invariant: "discarded ranges cannot improve the answer",
  loop: "move the smaller side",
  termination: "indices meet",
  output: "maximum area",
  complexity: "O(n)",
} as const;

class FakePseudocodeRepository implements PseudocodeRepository {
  readonly attempts = new Map<string, LearningAttempt>([[attemptId, attempt()]]);
  readonly artifacts = new Map<string, PseudocodeArtifact>();
  readonly revisions: PseudocodeRevision[] = [];

  async getAttempt(id: LearningAttempt["attemptId"], owner: LearningAttempt["learnerId"]) {
    const value = this.attempts.get(id);
    return value?.learnerId === owner ? value : null;
  }

  async createPseudocode(artifact: PseudocodeArtifact) {
    this.artifacts.set(artifact.pseudocodeId, artifact);
    return artifact;
  }

  async getPseudocode(id: PseudocodeId, owner: LearningAttempt["learnerId"]) {
    const value = this.artifacts.get(id);
    return value?.learnerId === owner ? value : null;
  }

  async replaceCurrentPseudocode(input: { artifact: PseudocodeArtifact; expectedVersion: number }) {
    const current = this.artifacts.get(input.artifact.pseudocodeId);
    if (current?.version !== input.expectedVersion) return null;
    this.artifacts.set(input.artifact.pseudocodeId, input.artifact);
    return input.artifact;
  }

  async savePseudocodeRevision(input: {
    artifact: PseudocodeArtifact;
    revision: PseudocodeRevision;
    expectedVersion: number;
  }) {
    const current = this.artifacts.get(input.artifact.pseudocodeId);
    if (current?.version !== input.expectedVersion) return null;
    this.artifacts.set(input.artifact.pseudocodeId, input.artifact);
    this.revisions.push(input.revision);
    return input.artifact;
  }

  async listPseudocodeRevisions(id: PseudocodeId, owner: LearningAttempt["learnerId"]) {
    return this.revisions.filter(
      (revision) => revision.pseudocodeId === id && revision.learnerId === owner,
    );
  }

  async deleteLearnerPseudocode(owner: LearningAttempt["learnerId"]) {
    for (const [id, artifact] of this.artifacts) {
      if (artifact.learnerId === owner) this.artifacts.delete(id);
    }
  }
}

describe("Task 26 pseudocode application boundary", () => {
  it("requires explicit saves and fences another writer", async () => {
    const repository = new FakePseudocodeRepository();
    const started = await startOwnedPseudocode(context(), repository, {
      pseudocodeId,
      attemptId,
    });
    const current = await replaceOwnedPseudocodeCurrent(context(), repository, {
      pseudocodeId,
      expectedVersion: started.version,
      fields,
    });
    const saved = await saveOwnedPseudocodeRevision(context(), repository, {
      pseudocodeId,
      expectedVersion: current.artifact.version,
    });
    expect(saved.artifact.savedRevision).toBe(1);
    expect(repository.revisions).toHaveLength(1);
    await expect(
      replaceOwnedPseudocodeCurrent(context(), repository, {
        pseudocodeId,
        expectedVersion: started.version,
        fields: { ...fields, output: "stale" },
      }),
    ).rejects.toMatchObject({ code: "version_conflict" });
    expect(repository.artifacts.get(pseudocodeId)?.current.output).toBe(fields.output);
  });

  it("uses only version-matched authored checks and verified runs for readiness", async () => {
    const repository = new FakePseudocodeRepository();
    const started = await startOwnedPseudocode(context(), repository, {
      pseudocodeId,
      attemptId,
    });
    const current = await replaceOwnedPseudocodeCurrent(context(), repository, {
      pseudocodeId,
      expectedVersion: started.version,
      fields,
    });
    await saveOwnedPseudocodeRevision(context(), repository, {
      pseudocodeId,
      expectedVersion: current.artifact.version,
    });
    const rubric = {
      rubricId: "arrays-v1",
      version: 1,
      requiredFields: ["inputs", "invariant", "termination", "complexity"] as const,
      requiredStructuredChecks: 1,
      requiredVerifiedPasses: 1,
    };
    const result = await evaluateOwnedPseudocode(context(), repository, {
      pseudocodeId,
      revision: 1,
      rubric,
      structuredChecks: [
        {
          checkId: "check-1",
          rubricId: rubric.rubricId,
          rubricVersion: rubric.version,
          pseudocodeId,
          revision: 1,
          passed: true,
          evidenceClass: "structured_check",
        },
      ],
      verifiedRuns: [
        {
          observationId,
          attemptId,
          problemVersionId,
          manifestId,
          passed: true,
        },
      ],
    });
    expect(result.status).toBe("ready");
    expect(repository.revisions[0]?.fields).toEqual(fields);
  });

  it("keeps another learner, including tutor-context callers, outside the artifact", async () => {
    const repository = new FakePseudocodeRepository();
    await startOwnedPseudocode(context(), repository, { pseudocodeId, attemptId });
    await expect(
      startOwnedPseudocode(context(otherLearner), repository, {
        pseudocodeId: must(formatId("pseudocode", "3333333333333333")),
        attemptId,
      }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
