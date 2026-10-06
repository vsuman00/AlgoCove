import { describe, it, expect } from "vitest";
import { evaluateRanking } from "@algocove/retrieval";
import {
  evaluatePromotion,
  parseEvaluationSuite,
  parseEvaluationRun,
  parseEvaluationConfiguration,
} from "@algocove/tutor";
import { suite, run, reviews, config } from "./evaluation-fixture.ts";
describe("Task45 versioned evaluation", () => {
  it("computes recall, reciprocal rank and normalized DCG with binary relevance", () => {
    expect(evaluateRanking(["x", "b", "a"], ["a", "b"], ["private"], 3)).toMatchObject({
      recall: 1,
      reciprocalRank: 0.5,
      forbiddenCount: 0,
    });
    expect(evaluateRanking(["a", "b"], ["a", "b"], [], 3).ndcg).toBe(1);
    expect(evaluateRanking(["x"], ["a"], [], 3).reciprocalRank).toBe(0);
  });
  it("scans forbidden results even outside the displayed top k", () =>
    expect(evaluateRanking(["a", "private"], ["a"], ["private"], 1).forbiddenCount).toBe(1));
  it("rejects conflicting labels and duplicate results", () => {
    expect(() => evaluateRanking(["a", "a"], ["a"], [], 3)).toThrow();
    expect(() => evaluateRanking(["a"], ["a"], ["a"], 3)).toThrow();
  });
  it("passes only complete reviewed evidence", () =>
    expect(evaluatePromotion(suite, run, reviews)).toMatchObject({
      passed: true,
      reasons: [],
      metrics: { recall: 1, mrr: 1, ndcg: 1, generationPassRate: 1 },
    }));
  it.each(["policyViolations", "privacyViolations"] as const)(
    "blocks one %s despite perfect averages",
    (key) => {
      const changed = structuredClone(run);
      changed.measurements[1]![key] = 1;
      expect(evaluatePromotion(suite, changed, reviews).reasons).toContain(
        "critical_policy_privacy",
      );
    },
  );
  it("requires exact immutable membership", () => {
    expect(
      evaluatePromotion(suite, { ...run, measurements: run.measurements.slice(1) }, reviews)
        .reasons,
    ).toContain("case_membership");
    expect(evaluatePromotion(suite, { ...run, suiteVersion: "other.v1" }, reviews).passed).toBe(
      false,
    );
  });
  it.each(["maxLatencyMs", "maxCostUnits"] as const)("enforces %s for each case", (key) => {
    const changed = structuredClone(run);
    changed.measurements[0]![key === "maxLatencyMs" ? "latencyMs" : "costUnits"] =
      suite.thresholds[key] + 1;
    expect(evaluatePromotion(suite, changed, reviews).reasons).toContain(key);
  });
  it("requires declared human sample and correct rubric", () => {
    expect(evaluatePromotion(suite, run, []).passed).toBe(false);
    expect(evaluatePromotion(suite, run, [{ ...reviews[0]!, rubricVersion: "wrong" }]).passed).toBe(
      false,
    );
  });
  it.each([
    { query: "private" },
    { learnerId: "private" },
    { code: "private" },
    { response: "private" },
  ])("rejects undeclared/private payload fields %j", (field) => {
    expect(() => parseEvaluationSuite({ ...suite, ...field })).toThrow();
    expect(() => parseEvaluationRun({ ...run, ...field })).toThrow();
  });
  it("requires synthetic provenance, critical cases and positive thresholds", () => {
    const changed = structuredClone(suite);
    changed.cases[0]!.provenance = "private" as never;
    expect(() => parseEvaluationSuite(changed)).toThrow();
    expect(() =>
      parseEvaluationSuite({
        ...suite,
        cases: suite.cases.map((c) => ({ ...c, critical: false })),
      }),
    ).toThrow();
    expect(() =>
      parseEvaluationSuite({ ...suite, thresholds: { ...suite.thresholds, recall: 0 } }),
    ).toThrow();
  });
  it("rejects nonfinite measurements, duplicate cases and live configs without approval", () => {
    const changed = structuredClone(run);
    changed.measurements[0]!.latencyMs = NaN;
    expect(() => parseEvaluationRun(changed)).toThrow();
    expect(() =>
      parseEvaluationRun({ ...run, measurements: [run.measurements[0], run.measurements[0]] }),
    ).toThrow();
    expect(() => parseEvaluationConfiguration({ ...config, fixture: false })).toThrow();
  });
  it("does not let a positive reviewer hide an unresolved negative judgment", () =>
    expect(
      evaluatePromotion(suite, run, [...reviews, { ...reviews[0]!, score: 0.2, accepted: false }])
        .reasons,
    ).toContain("human_review"));
});
