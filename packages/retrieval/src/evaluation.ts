/** Deterministic ranking metrics over unique canonical chunk IDs. */
export function evaluateRanking(
  ranked: readonly string[],
  relevant: readonly string[],
  forbidden: readonly string[],
  k: number,
): { recall: number; reciprocalRank: number; ndcg: number; forbiddenCount: number } {
  if (!Number.isSafeInteger(k) || k < 1 || k > 50 || !relevant.length)
    throw Error("A bounded cutoff and nonempty relevance set are required.");
  if ([ranked, relevant, forbidden].some((ids) => new Set(ids).size !== ids.length))
    throw Error("Duplicate evaluation IDs are ambiguous.");
  const expected = new Set(relevant),
    excluded = new Set(forbidden),
    top = ranked.slice(0, k);
  if (relevant.some((id) => excluded.has(id))) throw Error("Conflicting evaluation labels.");
  const hits = top.filter((id) => expected.has(id)).length;
  const first = top.findIndex((id) => expected.has(id));
  const dcg = top.reduce((sum, id, i) => sum + (expected.has(id) ? 1 / Math.log2(i + 2) : 0), 0);
  const ideal = Array.from(
    { length: Math.min(k, expected.size) },
    (_, i) => 1 / Math.log2(i + 2),
  ).reduce((a, b) => a + b, 0);
  return {
    recall: hits / expected.size,
    reciprocalRank: first < 0 ? 0 : 1 / (first + 1),
    ndcg: dcg / ideal,
    forbiddenCount: ranked.filter((id) => excluded.has(id)).length,
  };
}
