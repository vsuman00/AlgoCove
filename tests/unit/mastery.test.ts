import { describe, expect, it } from "vitest";
import {
  formatId,
  parseInstant,
  parseMasteryEvidence,
  projectMastery,
  type MasteryEvidence,
  type Result,
} from "@algocove/domain";

function must<T, F>(result: Result<T, F>): T {
  if (!result.ok) throw new Error("Invalid mastery fixture.");
  return result.value;
}
const learnerId = must(formatId("learner", "aaaaaaaaaaaaaaaa"));
const conceptId = must(formatId("concept", "aaaaaaaaaaaaaaaa"));
const observedAt = must(parseInstant("2026-10-02T10:00:00.000Z"));
function evidence(sequence = 1, overrides: Partial<MasteryEvidence> = {}): MasteryEvidence {
  const entropy = String(sequence).padStart(16, "0");
  return {
    sourceEventId: must(formatId("event", entropy)),
    observationId: must(formatId("event", entropy)),
    learnerId,
    conceptId,
    attemptId: must(formatId("attempt", entropy)),
    problemVersionId: must(formatId("problemVersion", entropy)),
    language: "python",
    observedAt,
    provenance: "server_observed_test",
    rubricVersion: "practice-assessment/v1",
    evidencePolicyVersion: 1,
    outcome: "pass",
    correct: true,
    assistanceTier: 0,
    explanationCorrect: null,
    explanationProvenance: null,
    confidence: null,
    confidenceProvenance: null,
    delayMs: null,
    transfer: null,
    transferProvenance: null,
    ...overrides,
  };
}
function projection(facts: readonly MasteryEvidence[]) {
  return must(projectMastery({ learnerId, conceptId, evidence: facts }));
}

describe("Task 30 deterministic evidence projection", () => {
  it("keeps explanation-only evidence out of completion and language counts, and uses prior reviewed explanations under a requiring policy", () => {
    const explanation = evidence(1, {
      sourceKind: "structured_explanation",
      exerciseId: "reasoning-v1",
      provenance: "structured_check",
      rubricVersion: "reasoning-v1/1",
      explanationCorrect: true,
      explanationProvenance: "structured_check",
      confidence: "high",
      confidenceProvenance: "learner_reported",
    });
    expect(projection([explanation])).toMatchObject({
      band: "unassessed",
      languageProficiency: {},
    });
    const code = evidence(2, { attemptId: explanation.attemptId });
    expect(
      must(
        projectMastery({
          learnerId,
          conceptId,
          evidence: [code, explanation],
          policy: { version: 2, requireValidatedExplanation: true },
        }),
      ).band,
    ).toBe("independent_completion");
  });
  it("replays unordered and duplicated observations to the same watermark and reasons", () => {
    const a = evidence(1),
      b = evidence(2, { assistanceTier: 6 });
    expect(projection([b, a, a])).toEqual(projection([a, b]));
    expect(projection([a, b])).toMatchObject({ band: "assisted_completion", evidenceCount: 2 });
  });
  it("changes the watermark when a backfilled source replaces another with the same count and latest observation", () => {
    expect(projection([evidence(1), evidence(3)]).evidenceWatermark).not.toBe(
      projection([evidence(2), evidence(3)]).evidenceWatermark,
    );
  });
  it("keeps solution disclosure and unknown historical assistance below independent transfer", () => {
    const transfer = {
      transfer: true,
      transferProvenance: "structured_check",
      delayMs: 86400000,
    } as const;
    expect(projection([evidence(1, { ...transfer, assistanceTier: 6 })]).band).toBe(
      "assisted_completion",
    );
    expect(projection([evidence(1, { assistanceTier: null })]).band).toBe(
      "completion_unclassified",
    );
    expect(projection([evidence(1)])).toMatchObject({
      band: "independent_completion",
      reasonCodes: expect.arrayContaining(["delayed_transfer_unobserved"]),
    });
    expect(projection([evidence(1, transfer)]).band).toBe("independent_delayed_transfer");
  });
  it("isolates compile/type feedback and ignores infrastructure/cancellation for concept credit", () => {
    const facts = [
      evidence(1),
      evidence(2, { language: "c", outcome: "compile_error", correct: false }),
      evidence(3, { outcome: "infrastructure_error", correct: false }),
      evidence(4, { outcome: "cancelled", correct: false }),
    ];
    expect(projection(facts)).toMatchObject({
      band: "independent_completion",
      languageProficiency: { python: { observedPasses: 1 }, c: { compileErrors: 1 } },
    });
    expect(projection(facts.slice(2)).band).toBe("unassessed");
    expect(projection([evidence(5, { outcome: "wrong_answer", correct: false })]).band).toBe(
      "needs_practice",
    );
  });
  it("excludes advisory/self-reported correctness and transfer", () => {
    expect(projection([evidence(1, { provenance: "model_advisory" })]).band).toBe("unassessed");
    expect(projection([evidence(1, { provenance: "learner_reported" })]).band).toBe("unassessed");
    expect(
      projection([
        evidence(1, { transfer: true, delayMs: 86400000, transferProvenance: "model_advisory" }),
      ]).band,
    ).toBe("independent_completion");
  });
  it("compares policies without rewriting input facts or evidence watermarks", () => {
    const facts = [evidence(1)];
    const before = JSON.stringify(facts);
    const a = projection(facts);
    const b = must(
      projectMastery({
        learnerId,
        conceptId,
        evidence: facts,
        policy: { version: 2, requireValidatedExplanation: true },
      }),
    );
    expect(b.band).toBe("completion_unclassified");
    expect(b.evidenceWatermark).toBe(a.evidenceWatermark);
    expect(JSON.stringify(facts)).toBe(before);
    expect(
      must(
        projectMastery({
          learnerId,
          conceptId,
          evidence: [
            evidence(1, { explanationCorrect: true, explanationProvenance: "model_advisory" }),
          ],
          policy: { version: 2, requireValidatedExplanation: true },
        }),
      ).band,
    ).toBe("completion_unclassified");
  });
  it("rejects malformed, cross-owner and conflicting source facts", () => {
    expect(parseMasteryEvidence({ ...evidence(1), assistanceTier: 7 }).ok).toBe(false);
    expect(parseMasteryEvidence({ ...evidence(1), transfer: true, delayMs: null }).ok).toBe(false);
    expect(
      projectMastery({
        learnerId,
        conceptId,
        evidence: [evidence(1, { learnerId: must(formatId("learner", "bbbbbbbbbbbbbbbb")) })],
      }).ok,
    ).toBe(false);
    expect(
      projectMastery({
        learnerId,
        conceptId,
        evidence: [evidence(1), evidence(1, { assistanceTier: 4 })],
      }),
    ).toMatchObject({ ok: false, error: { code: "evidence_conflict" } });
  });
});
