import {
  pilotIdentity,
  PROBLEM_LANGUAGES,
  languageProfile,
  type ProblemLanguage,
} from "@algocove/domain";
import { canonicalPilotBundle, validatePilotBundle } from "@algocove/content/pilot";
import { pilotHarness } from "@algocove/content/pilot-harness";
import { sha256Digest } from "@algocove/execution-contracts";
export type ReviewedPilot = {
  problemVersionId: string;
  manifestId: (language: ProblemLanguage) => string;
  manifestDigest: (language: ProblemLanguage) => string;
  fixtureDigest: string;
  fixtures: readonly { id: string; values: readonly number[]; expected: number }[];
  harness: typeof pilotHarness;
};
/** Operator-installed publication export; draft assets are never activated by default. */
export function loadPublishedPilotCatalog(raw: unknown): ReadonlyMap<string, ReviewedPilot> {
  if (!Array.isArray(raw) || raw.length > 4) throw Error("Bounded publication catalog required.");
  const catalog = new Map<string, ReviewedPilot>();
  for (const record of raw) {
    if (
      !record ||
      typeof record !== "object" ||
      Object.keys(record).some((k) => !["bundle", "checksum", "publicationRecordId"].includes(k)) ||
      typeof record.publicationRecordId !== "string" ||
      !/^evt_[0-9a-hjkmnp-tv-z]{16,52}$/.test(record.publicationRecordId)
    )
      throw Error("A publication receipt is required.");
    const b = validatePilotBundle(record.bundle);
    if (record.checksum !== sha256Digest(canonicalPilotBundle(b)))
      throw Error("Publication checksum mismatch.");
    const ids = pilotIdentity(b.slug);
    if (
      !ids ||
      ids.pattern !== b.pattern ||
      b.version !== `pilot.${b.pattern}.v1` ||
      catalog.has(ids.problemVersionId)
    )
      throw Error("Registered unique publication required.");
    const fixtures = b.fixtures.map((f) => ({
      id: `pilot-${ids.key}-${f.id}`,
      values: f.values,
      expected: f.expected,
    }));
    catalog.set(ids.problemVersionId, {
      problemVersionId: ids.problemVersionId,
      manifestId: (l) => ids.manifestId(PROBLEM_LANGUAGES.indexOf(l)),
      fixtureDigest: sha256Digest(JSON.stringify(fixtures)),
      fixtures,
      harness: pilotHarness,
      manifestDigest: (l) =>
        sha256Digest(
          JSON.stringify({
            problem: ids.problemVersionId,
            manifest: ids.manifestId(PROBLEM_LANGUAGES.indexOf(l)),
            profile: languageProfile(l),
            harness: pilotHarness(l, ""),
            bundleChecksum: record.checksum,
          }),
        ),
    });
  }
  return catalog;
}
