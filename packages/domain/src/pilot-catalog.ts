/** Stable v1 pilot identities. Availability is always resolved from published SQL content. */
export const PILOT_CATALOG = [
  { pattern: "arrays-hashing", slug: "matching-readings", key: "1" },
  { pattern: "two-pointers", slug: "target-gap-pairs", key: "2" },
  { pattern: "sliding-window", slug: "stable-signal-run", key: "3" },
  { pattern: "stack", slug: "signal-cancellation", key: "4" },
] as const;
export type PilotIdentity = {
  pattern: (typeof PILOT_CATALOG)[number]["pattern"];
  slug: string;
  key: string;
  contentId: string;
  contentVersionId: string;
  problemId: string;
  problemVersionId: string;
  conceptId: string;
  hintPrefix: string;
  manifestId: (languageIndex: number) => string;
};
export function pilotIdentity(slug: string): PilotIdentity | null {
  const entry = PILOT_CATALOG.find((p) => p.slug === slug);
  if (!entry) return null;
  const suffix = entry.key.repeat(16);
  return {
    ...entry,
    contentId: `con_${suffix}`,
    contentVersionId: `cnt_${suffix}`,
    problemId: `pro_${suffix}`,
    problemVersionId: `prb_${suffix}`,
    conceptId: `cpt_${suffix}`,
    hintPrefix: `hint-pilot-${entry.pattern}`,
    manifestId: (languageIndex: number) => `man_${entry.key.repeat(15)}${languageIndex + 1}`,
  };
}
export function pilotIdentityFromVersion(problemVersionId: string): PilotIdentity | null {
  return (
    PILOT_CATALOG.map((p) => pilotIdentity(p.slug)!).find(
      (p) => p.problemVersionId === problemVersionId,
    ) ?? null
  );
}
