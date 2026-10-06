import { describe, expect, it } from "vitest";
import {
  evaluateExternalReadiness,
  READINESS_CATEGORIES,
  type ExternalReadinessEvidence,
  type ExternalReadinessRubric,
  type ReadinessBinding,
} from "@algocove/domain";
import { evaluateOwnedExternalReadiness, type RequestContext } from "@algocove/application";

const binding = {
  learnerId: "lrn_aaaaaaaaaaaaaaaa",
  attemptId: "att_bbbbbbbbbbbbbbbb",
  problemVersionId: "prb_cccccccccccccccc",
  manifestId: "lmanifest_dddddddddddddddd",
  sourceChecksum: "a".repeat(64),
  reasoningRevision: 2,
} as ReadinessBinding;
const rubric: ExternalReadinessRubric = {
  rubricId: "fixture.external.v1",
  version: 1,
  problemVersionId: binding.problemVersionId,
  mode: "learn",
  published: true,
  maximumAssistanceTier: 4,
  requirements: READINESS_CATEGORIES.map((category) => ({
    category,
    checkIds: [`${category}.v1`],
  })),
};
const evidence: ExternalReadinessEvidence[] = READINESS_CATEGORIES.map((category, i) => ({
  ...binding,
  evidenceId: `evt_${i.toString().padStart(16, "0")}` as ExternalReadinessEvidence["evidenceId"],
  rubricId: rubric.rubricId,
  rubricVersion: 1,
  category,
  checkId: `${category}.v1`,
  correct: true,
  provenance: category === "execution" ? "server_observed_test" : "structured_check",
}));
const input = {
  binding,
  mode: "learn" as const,
  contentAvailable: true,
  rubric,
  highestAssistanceTier: 4,
  evidence,
};

// Test-only thresholds: no production rubric is published by these fixtures.
describe("Task 38 external readiness contract", () => {
  it("requires every authored category and retains versioned provenance", () => {
    const decision = evaluateExternalReadiness(input);
    expect(decision.status).toBe("ready");
    expect(decision.rubricVersion).toBe(1);
    expect(decision.evidenceIds).toHaveLength(6);
    expect(decision.bypassAvailable).toBe(false);
  });
  it.each(READINESS_CATEGORIES)("blocks missing %s evidence", (category) => {
    const decision = evaluateExternalReadiness({
      ...input,
      evidence: evidence.filter((e) => e.category !== category),
    });
    expect(decision.status).toBe("not_ready");
    expect(decision.reasons[0]?.code).toBe(`missing:${category}:${category}.v1`);
  });
  it.each(["learner_reported", "model_advisory", "interaction_only"] as const)(
    "rejects %s confidence or interaction as correctness",
    (provenance) => {
      expect(
        evaluateExternalReadiness({
          ...input,
          evidence: evidence.map((e) => ({ ...e, provenance })),
        }).status,
      ).toBe("not_ready");
    },
  );
  it("requires trusted execution rather than a structured execution claim", () => {
    expect(
      evaluateExternalReadiness({
        ...input,
        evidence: evidence.map((e) => ({ ...e, provenance: "structured_check" })),
      }).status,
    ).toBe("not_ready");
  });
  it.each([
    { rubricVersion: 2 },
    { reasoningRevision: 1 },
    { sourceChecksum: "b".repeat(64) },
    { learnerId: "lrn_other" },
    { attemptId: "att_other" },
    { problemVersionId: "prb_other" },
    { manifestId: "lmanifest_other" },
    { correct: false },
  ])("rejects stale or mismatched evidence %j", (changes) => {
    expect(
      evaluateExternalReadiness({
        ...input,
        evidence: evidence.map((e) => ({ ...e, ...changes }) as ExternalReadinessEvidence),
      }).status,
    ).toBe("not_ready");
  });
  it.each([null, 5, -1, 1.5])(
    "blocks unknown or excessive assistance %s",
    (highestAssistanceTier) => {
      expect(evaluateExternalReadiness({ ...input, highestAssistanceTier }).reasons).toContainEqual(
        expect.objectContaining({ code: "assistance_limit" }),
      );
    },
  );
  it("never permits bypass even with otherwise complete evidence", () => {
    expect(evaluateExternalReadiness({ ...input, bypassRequested: true }).reasons).toContainEqual(
      expect.objectContaining({ code: "bypass_disabled" }),
    );
  });
  it("rejects withdrawn content and missing artifacts", () => {
    expect(evaluateExternalReadiness({ ...input, contentAvailable: false }).status).toBe(
      "not_ready",
    );
    expect(
      evaluateExternalReadiness({ ...input, binding: { ...binding, sourceChecksum: null } }).status,
    ).toBe("not_ready");
    expect(
      evaluateExternalReadiness({ ...input, binding: { ...binding, reasoningRevision: 0 } }).status,
    ).toBe("not_ready");
  });
  it.each([
    null,
    { ...rubric, published: false },
    { ...rubric, requirements: [] },
    { ...rubric, mode: "practice" as const },
    { ...rubric, maximumAssistanceTier: 7 },
    { ...rubric, problemVersionId: "prb_other" as ReadinessBinding["problemVersionId"] },
    { ...rubric, requirements: rubric.requirements.map((r) => ({ ...r, checkIds: [] })) },
  ])("requires a complete published matching policy", (rubric) => {
    expect(evaluateExternalReadiness({ ...input, rubric }).reasons).toContainEqual(
      expect.objectContaining({ code: "rubric_unavailable" }),
    );
  });
  it("duplicate facts cannot fill a missing check", () => {
    expect(
      evaluateExternalReadiness({ ...input, evidence: Array(6).fill(evidence[0]) }).status,
    ).toBe("not_ready");
  });
  it("loads server-owned facts and rejects mismatched ownership", async () => {
    const context = { actor: { userId: binding.learnerId } } as RequestContext;
    const repository = { loadOwnedReadiness: async () => input };
    expect(
      (await evaluateOwnedExternalReadiness(context, repository, { attemptId: binding.attemptId }))
        .status,
    ).toBe("ready");
    await expect(
      evaluateOwnedExternalReadiness(
        context,
        { loadOwnedReadiness: async () => null },
        { attemptId: binding.attemptId },
      ),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      evaluateOwnedExternalReadiness(
        context,
        {
          loadOwnedReadiness: async () => ({
            ...input,
            binding: { ...binding, learnerId: "lrn_other" as ReadinessBinding["learnerId"] },
          }),
        },
        { attemptId: binding.attemptId },
      ),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
