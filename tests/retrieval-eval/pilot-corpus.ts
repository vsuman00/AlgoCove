/** Original, synthetic teaching corpus. Labels and vectors test retrieval plumbing;
 * they are not an external embedding provider or a production quality benchmark. */
export const pilotCorpus = [
  {
    key: "invariant",
    text: "The two pointer invariant discards the shorter boundary because its height limits every narrower container.",
    query: "shorter boundary invariant",
    terms: ["invariant", "shorter", "boundary", "discards"],
  },
  {
    key: "area",
    text: "Container area equals the minimum endpoint height multiplied by the distance between the left and right endpoints.",
    query: "minimum height distance area",
    terms: ["area", "minimum", "height", "distance"],
  },
  {
    key: "complexity",
    text: "Time complexity is linear because each pointer moves inward at most n times. Auxiliary space is constant.",
    query: "linear time auxiliary space",
    terms: ["complexity", "linear", "time", "space"],
  },
  {
    key: "termination",
    text: "The termination condition is left less than right. Stop when the pointers meet to avoid a zero width container.",
    query: "termination pointers meet",
    terms: ["termination", "meet", "stop", "zero"],
  },
  {
    key: "equality",
    text: "When endpoint heights are equal, moving either pointer preserves correctness. Equal boundaries need no special tie rule.",
    query: "equal heights tie rule",
    terms: ["equal", "equality", "tie", "either"],
  },
  {
    key: "overflow",
    text: "Large integer heights and widths can overflow their product. Use an integer representation wide enough for the maximum area.",
    query: "integer product overflow",
    terms: ["overflow", "integer", "product", "large"],
  },
  {
    key: "empty",
    text: "An empty input or one bar cannot form a container. Return zero before indexing either boundary.",
    query: "empty input one bar",
    terms: ["empty", "input", "bar", "indexing"],
  },
  {
    key: "testing",
    text: "Test descending, ascending and repeated heights. Compare tiny random inputs against exhaustive pairs as a testing oracle.",
    query: "exhaustive pairs testing oracle",
    terms: ["testing", "oracle", "exhaustive", "random"],
  },
  {
    key: "width",
    text: "The width decreases on every inward pointer move. A taller new boundary can compensate for the lost distance.",
  },
  {
    key: "brute",
    text: "The brute force baseline enumerates all endpoint pairs, computing the best container in quadratic time.",
  },
  {
    key: "trace",
    text: "Record left, right and best area for each two pointer trace step to inspect the algorithm manually.",
  },
  {
    key: "mutation",
    text: "The container algorithm reads heights without sorting or mutating the input array, preserving endpoint positions.",
  },
] as const;
export function pilotVector(text: string): number[] {
  const words = new Set(text.toLowerCase().match(/[a-z]+/g) ?? []);
  const v = pilotCorpus
    .slice(0, 8)
    .map((entry) =>
      "terms" in entry ? 0.05 + entry.terms.filter((term) => words.has(term)).length : 0.05,
    );
  const norm = Math.hypot(...v);
  return v.map((x) => x / norm);
}
