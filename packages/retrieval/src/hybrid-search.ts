import { canonicalJson } from "./evidence-package.ts";
import { checksum } from "@algocove/content";
export type RetrievalConfiguration = {
  schemaVersion: 1;
  version: string;
  corpusVersion: string;
  indexIds: readonly string[];
  embeddingConfigurationId: string;
  chunkPolicyVersion: string;
  lexicalPolicy: "english.plainto.cover-density.32.v1";
  densePolicy: "exact.cosine.v1";
  fusionPolicy: "rrf.equal.exact-duplicate.v1";
  rrfK: number;
  candidateLimit: number;
  topK: number;
  maximumTextCharacters: number;
  timeoutMs: number;
};
export type RetrievalScope = {
  learnerId: string;
  attemptId: string;
  problemVersionId: string;
  curriculumVersionId: string;
  language: string;
  conceptIds: readonly string[];
  targetLevel: "unspecified";
  visibility: "published_curriculum";
  maximumHintTier: number;
};
export type RetrievalCandidate = {
  chunkId: string;
  indexId: string;
  contentVersionId: string;
  problemVersionId: string;
  problemId: string;
  sourceObjectId: string;
  kind: "problem_statement" | "hint_tier";
  hintTier: number;
  text: string;
  textChecksum: string;
  sourceChecksum: string;
  normalizedChecksum: string;
  title: string;
  rightsHolder: string;
  license: string;
  conceptIds: readonly string[];
  curriculumVersionIds: readonly string[];
  languages: readonly string[];
  language: "neutral";
  targetLevel: "unspecified";
  visibility: "published_curriculum";
  score: number;
};
export type FusedCandidate = {
  candidate: RetrievalCandidate;
  lexicalRank: number | null;
  denseRank: number | null;
  fusedScore: number;
};
export type FusedResult = {
  selected: readonly FusedCandidate[];
  ranked: readonly FusedCandidate[];
  excluded: readonly { chunkId: string; reason: "duplicate" | "context_budget" | "top_k" }[];
  contradictions: readonly { reason: "version_disagreement"; chunkIds: readonly string[] }[];
  lowConfidence: boolean;
};
export function validateRetrievalConfiguration(c: RetrievalConfiguration): void {
  const label = /^[A-Za-z0-9._:-]{1,128}$/;
  if (
    c.schemaVersion !== 1 ||
    typeof c.version !== "string" ||
    !label.test(c.version) ||
    typeof c.corpusVersion !== "string" ||
    !label.test(c.corpusVersion) ||
    typeof c.chunkPolicyVersion !== "string" ||
    !label.test(c.chunkPolicyVersion) ||
    !/^emb_[0-9a-f]{40}$/.test(c.embeddingConfigurationId) ||
    !Array.isArray(c.indexIds) ||
    c.indexIds.length < 1 ||
    c.indexIds.length > 500 ||
    new Set(c.indexIds).size !== c.indexIds.length ||
    c.indexIds.some((id) => !/^idx_[0-9a-f]{40}$/.test(id)) ||
    c.lexicalPolicy !== "english.plainto.cover-density.32.v1" ||
    c.densePolicy !== "exact.cosine.v1" ||
    c.fusionPolicy !== "rrf.equal.exact-duplicate.v1" ||
    !Number.isInteger(c.rrfK) ||
    c.rrfK < 1 ||
    c.rrfK > 1000 ||
    !Number.isInteger(c.candidateLimit) ||
    c.candidateLimit < 1 ||
    c.candidateLimit > 50 ||
    !Number.isInteger(c.topK) ||
    c.topK < 1 ||
    c.topK > 10 ||
    c.topK > c.candidateLimit ||
    !Number.isInteger(c.maximumTextCharacters) ||
    c.maximumTextCharacters < 1 ||
    c.maximumTextCharacters > 80000 ||
    !Number.isInteger(c.timeoutMs) ||
    c.timeoutMs < 1 ||
    c.timeoutMs > 2000
  )
    throw Error("Invalid retrieval configuration.");
}
export function assertPermittedCandidate(
  c: RetrievalCandidate,
  scope: RetrievalScope,
  config: RetrievalConfiguration,
): void {
  if (
    !["problem_statement", "hint_tier"].includes(c.kind) ||
    !config.indexIds.includes(c.indexId) ||
    !c.curriculumVersionIds.includes(scope.curriculumVersionId) ||
    !c.languages.includes(scope.language) ||
    !c.conceptIds.some((id) => scope.conceptIds.includes(id)) ||
    c.visibility !== scope.visibility ||
    c.language !== "neutral" ||
    c.targetLevel !== scope.targetLevel ||
    !Number.isInteger(c.hintTier) ||
    c.hintTier < 0 ||
    c.hintTier > scope.maximumHintTier ||
    (c.kind === "hint_tier" &&
      (c.problemVersionId !== scope.problemVersionId || c.hintTier === 0)) ||
    (c.kind === "problem_statement" && c.hintTier !== 0) ||
    !Number.isFinite(c.score) ||
    c.text.length < 1 ||
    c.text.length > 20000 ||
    checksum(c.text) !== c.textChecksum
  )
    throw Error("Retrieval candidate violates permitted scope or lineage.");
}
export function fuseCandidates(
  lexical: readonly RetrievalCandidate[],
  dense: readonly RetrievalCandidate[],
  scope: RetrievalScope,
  config: RetrievalConfiguration,
): FusedResult {
  validateRetrievalConfiguration(config);
  if (lexical.length > config.candidateLimit || dense.length > config.candidateLimit)
    throw Error("Candidate budget exceeded.");
  const entries = new Map<string, FusedCandidate>();
  for (const [branch, list] of [
    ["lexical", lexical],
    ["dense", dense],
  ] as const) {
    const seen = new Set<string>();
    for (const [i, c] of list.entries()) {
      assertPermittedCandidate(c, scope, config);
      if (seen.has(c.chunkId)) throw Error("Duplicate candidate in retriever ranking.");
      seen.add(c.chunkId);
      const existing = entries.get(c.chunkId);
      if (existing) {
        const { score: _leftScore, ...left } = existing.candidate;
        const { score: _rightScore, ...right } = c;
        if (canonicalJson(left) !== canonicalJson(right))
          throw Error("Retriever lineage mismatch.");
      }
      const entry = existing ?? { candidate: c, lexicalRank: null, denseRank: null, fusedScore: 0 };
      if (branch === "lexical") entry.lexicalRank = i + 1;
      else entry.denseRank = i + 1;
      entry.fusedScore += 1 / (config.rrfK + i + 1);
      entries.set(c.chunkId, entry);
    }
  }
  const ranked = [...entries.values()].sort(
    (a, b) => b.fusedScore - a.fusedScore || (a.candidate.chunkId < b.candidate.chunkId ? -1 : 1),
  );
  const selected: FusedCandidate[] = [],
    excluded: FusedResult["excluded"][number][] = [],
    dedup = new Set<string>();
  let characters = 0;
  for (const entry of ranked) {
    const c = entry.candidate,
      key = JSON.stringify([c.kind, c.hintTier, c.language, c.textChecksum]);
    const reason = dedup.has(key)
      ? "duplicate"
      : selected.length >= config.topK
        ? "top_k"
        : characters + c.text.length > config.maximumTextCharacters
          ? "context_budget"
          : null;
    if (reason) excluded.push({ chunkId: c.chunkId, reason });
    else {
      selected.push(entry);
      dedup.add(key);
      characters += c.text.length;
    }
  }
  const groups = new Map<string, FusedCandidate[]>();
  for (const entry of ranked) {
    const c = entry.candidate,
      key = JSON.stringify([
        c.problemId,
        c.kind,
        c.hintTier,
        c.sourceObjectId.startsWith("prb_") ? "statement" : c.sourceObjectId,
      ]);
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }
  const contradictions = [...groups.values()]
    .filter((group) => new Set(group.map((e) => e.candidate.textChecksum)).size > 1)
    .map((group) => ({
      reason: "version_disagreement" as const,
      chunkIds: group.map((e) => e.candidate.chunkId).sort(),
    }))
    .sort((a, b) => (a.chunkIds[0]! < b.chunkIds[0]! ? -1 : 1));
  return {
    selected,
    ranked,
    excluded,
    contradictions,
    lowConfidence: selected.length === 0 || contradictions.length > 0,
  };
}
