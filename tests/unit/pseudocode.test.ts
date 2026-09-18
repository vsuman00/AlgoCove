import { describe, expect, it } from "vitest";
import {
  evaluatePseudocodeReadiness,
  formatId,
  parseInstant,
  replacePseudocodeCurrent,
  savePseudocodeRevision,
  startAttempt,
  startLearningSession,
  startPseudocodeArtifact,
  type PseudocodeFields,
  type Result,
} from "@algocove/domain";

const now = must(parseInstant("2026-09-18T10:00:00.000Z"));
const later = must(parseInstant("2026-09-18T10:01:00.000Z"));
const learner = must(formatId("learner", "aaaaaaaaaaaaaaaa"));
const sessionId = must(formatId("session", "bbbbbbbbbbbbbbbb"));
const attemptId = must(formatId("attempt", "cccccccccccccccc"));
const problemVersionId = must(formatId("problemVersion", "dddddddddddddddd"));
const manifestId = must(formatId("languageManifest", "eeeeeeeeeeeeeeee"));
const pseudocodeId = must(formatId("pseudocode", "ffffffffffffffff"));
const checkId = "check-arrays-v1";
const observationId = must(formatId("event", "1111111111111111"));

function must<T, F>(result: Result<T, F>): T {
  if (!result.ok) throw new Error("Invalid pseudocode fixture.");
  return result.value;
}

function fields(overrides: Partial<PseudocodeFields> = {}): PseudocodeFields {
  return {
    inputs: "array of integers",
    state: "left and right indices",
    initialization: "left = 0, right = length - 1",
    invariant: "all discarded values cannot be a valid pair",
    loop: "move the index with the smaller value",
    termination: "stop when the indices meet",
    output: "the maximum area",
    complexity: "O(n) time, O(1) space",
    ...overrides,
  };
}

function artifact() {
  const session = must(
    startLearningSession({
      sessionId,
      learnerId: learner,
      mode: "learn",
      startedAt: now,
    }),
  );
  const attempt = must(
    startAttempt(session, {
      attemptId,
      eventId: observationId,
      problemVersionId,
      manifestId,
      language: "python",
      startedAt: now,
    }),
  ).attempt;
  return must(startPseudocodeArtifact({ pseudocodeId, attempt, startedAt: now }));
}

describe("Task 26 structured pseudocode and readiness", () => {
  it("keeps current editing separate from explicit append-only revisions", () => {
    const started = artifact();
    const replaced = must(
      replacePseudocodeCurrent(started, { fields: fields(), updatedAt: later }),
    );

    expect(replaced.artifact.currentRevision).toBe(1);
    expect(replaced.artifact.savedRevision).toBe(0);
    expect(replaced.revision).toBeUndefined();

    const saved = must(savePseudocodeRevision(replaced.artifact, { savedAt: later }));
    expect(saved.artifact.savedRevision).toBe(1);
    expect(saved.revision).toMatchObject({ revision: 1, fields: fields() });
  });

  it("does not infer readiness from nonempty prose or mismatched evidence", () => {
    const started = artifact();
    const replaced = must(
      replacePseudocodeCurrent(started, { fields: fields(), updatedAt: later }),
    );
    const saved = must(savePseudocodeRevision(replaced.artifact, { savedAt: later }));
    const rubric = {
      rubricId: "arrays-v1",
      version: 1,
      requiredFields: ["inputs", "invariant", "termination", "complexity"] as const,
      requiredStructuredChecks: 1,
      requiredVerifiedPasses: 1,
    };

    expect(
      evaluatePseudocodeReadiness({
        artifact: saved.artifact,
        revision: saved.revision!,
        rubric,
        structuredChecks: [],
        verifiedRuns: [],
      }),
    ).toMatchObject({ status: "not_ready", missing: ["structured_checks", "verified_runs"] });

    const ready = evaluatePseudocodeReadiness({
      artifact: saved.artifact,
      revision: saved.revision!,
      rubric,
      structuredChecks: [
        {
          checkId,
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
    expect(ready).toMatchObject({
      status: "ready",
      evidence: { structuredChecks: 1, verifiedPasses: 1 },
    });
  });

  it("rejects oversized fields and non-monotonic edits", () => {
    const started = artifact();
    expect(
      replacePseudocodeCurrent(started, {
        fields: fields({ inputs: "x".repeat(20_001) }),
        updatedAt: later,
      }),
    ).toMatchObject({ ok: false, error: { code: "invalid_field" } });
    const replaced = must(
      replacePseudocodeCurrent(started, { fields: fields(), updatedAt: later }),
    );
    expect(
      replacePseudocodeCurrent(replaced.artifact, {
        fields: fields({ output: "a different output" }),
        updatedAt: now,
      }),
    ).toMatchObject({ ok: false, error: { code: "invalid_time" } });
  });
});
