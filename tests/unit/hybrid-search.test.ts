import { describe, it, expect } from "vitest";
import { checksum } from "@algocove/content";
import {
  fuseCandidates,
  canonicalJson,
  sealEvidence,
  verifyEvidence,
  type RetrievalCandidate,
  type RetrievalScope,
  type RetrievalConfiguration,
  type EvidencePackage,
} from "@algocove/retrieval";
const scope: RetrievalScope = {
  learnerId: "usr_aaaaaaaaaaaaaaaa",
  attemptId: "att_aaaaaaaaaaaaaaaa",
  problemVersionId: "prb_aaaaaaaaaaaaaaaa",
  curriculumVersionId: "cur_aaaaaaaaaaaaaaaa",
  language: "python",
  conceptIds: ["cpt_aaaaaaaaaaaaaaaa"],
  targetLevel: "unspecified",
  visibility: "published_curriculum",
  maximumHintTier: 2,
};
const config: RetrievalConfiguration = {
  schemaVersion: 1,
  version: "hybrid.v1",
  corpusVersion: "pilot.v1",
  indexIds: ["idx_" + "a".repeat(40)],
  embeddingConfigurationId: "emb_" + "a".repeat(40),
  chunkPolicyVersion: "pedagogical.problem.v1",
  lexicalPolicy: "english.plainto.cover-density.32.v1",
  densePolicy: "exact.cosine.v1",
  fusionPolicy: "rrf.equal.exact-duplicate.v1",
  rrfK: 60,
  candidateLimit: 50,
  topK: 3,
  maximumTextCharacters: 80000,
  timeoutMs: 2000,
};
function candidate(id: string, text = id): RetrievalCandidate {
  return {
    chunkId: id,
    indexId: config.indexIds[0]!,
    contentVersionId: "cnt_aaaaaaaaaaaaaaaa",
    problemVersionId: scope.problemVersionId,
    problemId: "pro_aaaaaaaaaaaaaaaa",
    sourceObjectId: scope.problemVersionId,
    kind: "problem_statement",
    hintTier: 0,
    text,
    textChecksum: checksum(text),
    sourceChecksum: checksum("source"),
    normalizedChecksum: checksum("normalized"),
    title: "Title",
    rightsHolder: "AlgoCove",
    license: "original",
    conceptIds: scope.conceptIds,
    curriculumVersionIds: [scope.curriculumVersionId],
    languages: [scope.language],
    language: "neutral",
    targetLevel: "unspecified",
    visibility: "published_curriculum",
    score: 1,
  };
}
describe("hybrid retrieval fusion", () => {
  it("fuses exact ranks with deterministic ties", () => {
    const a = candidate("a"),
      b = candidate("b");
    const result = fuseCandidates([a, b], [b, a], scope, config);
    expect(result.selected.map((e) => e.candidate.chunkId)).toEqual(["a", "b"]);
    expect(result.selected[0]!.fusedScore).toBeCloseTo(1 / 61 + 1 / 62, 12);
  });
  it("deduplicates equal pedagogical units and retains ranks/reasons", () => {
    const result = fuseCandidates(
      [candidate("a", "same"), candidate("b", "same")],
      [],
      scope,
      config,
    );
    expect(result.selected).toHaveLength(1);
    expect(result.excluded).toEqual([{ chunkId: "b", reason: "duplicate" }]);
  });
  it("flags version disagreements conservatively", () => {
    const r = fuseCandidates(
      [candidate("a", "Move left"), candidate("b", "Move right")],
      [],
      scope,
      config,
    );
    expect(r.contradictions[0]!.reason).toBe("version_disagreement");
    expect(r.lowConfidence).toBe(true);
  });
  it("respects context budgets without truncating units", () => {
    const r = fuseCandidates([candidate("a", "12345"), candidate("b", "12")], [], scope, {
      ...config,
      maximumTextCharacters: 3,
    });
    expect(r.selected.map((e) => e.candidate.chunkId)).toEqual(["b"]);
    expect(r.excluded[0]!.reason).toBe("context_budget");
  });
  it("empty evidence is explicit low confidence", () => {
    expect(fuseCandidates([], [], scope, config).lowConfidence).toBe(true);
  });
  it.each([
    { hintTier: 6, kind: "hint_tier" as const },
    { languages: ["java"] },
    { curriculumVersionIds: [] },
    { conceptIds: [] },
    { visibility: "private" },
    { textChecksum: "forged" },
    { indexId: "other" },
    { targetLevel: "advanced" },
  ])("rejects contaminated adapter candidates %j", (patch) => {
    expect(() =>
      fuseCandidates([{ ...candidate("a"), ...patch } as RetrievalCandidate], [], scope, config),
    ).toThrow();
  });
  it("rejects duplicate retriever rows and mismatched lineage", () => {
    const a = candidate("a");
    expect(() => fuseCandidates([a, a], [], scope, config)).toThrow();
    expect(() => fuseCandidates([a], [{ ...a, indexId: "wrong" }], scope, config)).toThrow();
  });
  it("uses a canonical checksum independent of JSON object key order", () => {
    expect(canonicalJson({ z: 1, a: [{ b: 2, a: 1 }] })).toBe(
      canonicalJson({ a: [{ a: 1, b: 2 }], z: 1 }),
    );
    const e = sealEvidence({ schemaVersion: 1, packageId: "test" } as Omit<
      EvidencePackage,
      "checksum"
    >);
    expect(verifyEvidence(JSON.parse(JSON.stringify(e)))).toBe(true);
    expect(verifyEvidence({ ...e, packageId: "changed" })).toBe(false);
  });
});
