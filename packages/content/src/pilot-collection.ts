import { pilotIdentity, validateExternalUrl } from "@algocove/domain";
export type PilotCollection = {
  schemaVersion: 1;
  slug: string;
  title: string;
  scope: string;
  reviewStatus: "pending-human-review";
  checkedAt: string;
  entries: {
    pattern: string;
    problemSlug: string;
    provider: "leetcode";
    externalKey: string;
    title: string;
    canonicalUrl: string;
    attribution: string;
    relation: "same_pattern" | "transfer";
    rationale: string;
    linkHealth: "reachable";
    reviewStatus: "pending-human-review";
  }[];
};
export function validatePilotCollection(raw: unknown): PilotCollection {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Error("Collection required.");
  const b = raw as PilotCollection;
  const keys = (value: object, allowed: string[]) => {
    if (Object.keys(value).some((k) => !allowed.includes(k)))
      throw Error("Unsupported collection field.");
  };
  keys(b, ["schemaVersion", "slug", "title", "scope", "reviewStatus", "checkedAt", "entries"]);
  if (
    b.schemaVersion !== 1 ||
    b.slug !== "algocove-pilot-transfer" ||
    typeof b.title !== "string" ||
    !b.title ||
    b.title.length > 200 ||
    typeof b.scope !== "string" ||
    b.scope.length > 500 ||
    b.reviewStatus !== "pending-human-review" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(b.checkedAt) ||
    !Array.isArray(b.entries) ||
    b.entries.length !== 4
  )
    throw Error("Bounded original pilot collection required.");
  const seen = new Set<string>();
  for (const e of b.entries) {
    keys(e, [
      "pattern",
      "problemSlug",
      "provider",
      "externalKey",
      "title",
      "canonicalUrl",
      "attribution",
      "relation",
      "rationale",
      "linkHealth",
      "reviewStatus",
    ]);
    const id = pilotIdentity(e.problemSlug);
    if (
      !id ||
      id.pattern !== e.pattern ||
      seen.has(id.problemVersionId) ||
      e.provider !== "leetcode" ||
      !validateExternalUrl(e.provider, e.canonicalUrl).ok ||
      new URL(e.canonicalUrl).search ||
      !["same_pattern", "transfer"].includes(e.relation) ||
      e.reviewStatus !== "pending-human-review" ||
      e.linkHealth !== "reachable" ||
      [e.externalKey, e.title, e.attribution, e.rationale].some(
        (v) => typeof v !== "string" || !v.trim() || v.length > 240,
      )
    )
      throw Error("Invalid or duplicate original mapping.");
    seen.add(id.problemVersionId);
  }
  if (new Set(b.entries.map((e) => e.canonicalUrl)).size !== 4)
    throw Error("Duplicate outbound identity.");
  return structuredClone(b);
}
