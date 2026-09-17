import { describe, expect, it } from "vitest";
import {
  addCollectionMembership,
  canNavigateToExternalReference,
  createExternalReference,
  deduplicateCollectionReferences,
  formatId,
  parseInstant,
  reviewExternalReference,
  type ExternalCollection,
} from "@algocove/domain";

const referenceId = formatId("externalReference", "aaaaaaaaaaaaaaaa");
const secondReferenceId = formatId("externalReference", "bbbbbbbbbbbbbbbb");
const collectionId = formatId("collection", "cccccccccccccccc");
const reviewerId = formatId("learner", "dddddddddddddddd");
const instant = parseInstant(new Date("2026-09-17T10:00:00.000Z"));
if (!referenceId.ok || !secondReferenceId.ok || !collectionId.ok || !reviewerId.ok || !instant.ok) {
  throw new Error("external reference fixtures are invalid");
}
const referenceIdValue = referenceId.value;
const secondReferenceIdValue = secondReferenceId.value;
const collectionIdValue = collectionId.value;
const reviewerIdValue = reviewerId.value;
const instantValue = instant.value;

function reference(overrides: Partial<Parameters<typeof createExternalReference>[0]> = {}) {
  const result = createExternalReference({
    externalReferenceId: referenceIdValue,
    provider: "blind",
    externalKey: "two-sum",
    title: "Two Sum",
    canonicalUrl: "https://blind75.com/problems/two-sum",
    attribution: "Blind 75",
    ...overrides,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe("reviewed external references", () => {
  it("accepts only provider-owned HTTPS metadata URLs", () => {
    expect(reference().canonicalUrl).toBe("https://blind75.com/problems/two-sum");
    expect(
      createExternalReference({
        externalReferenceId: referenceIdValue,
        provider: "blind",
        externalKey: "evil",
        title: "Evil redirect",
        canonicalUrl: "https://blind75.com.evil.test/problem",
        attribution: "Unknown",
      }),
    ).toMatchObject({ ok: false, error: { code: "domain_not_allowed" } });
    expect(
      createExternalReference({
        externalReferenceId: referenceIdValue,
        provider: "blind",
        externalKey: "credentialed",
        title: "Credentialed URL",
        canonicalUrl: "https://user:password@blind75.com/problem",
        attribution: "Blind 75",
      }),
    ).toMatchObject({ ok: false, error: { code: "invalid_url" } });
  });

  it("requires a review before outbound navigation", () => {
    const pending = reference();
    expect(canNavigateToExternalReference(pending)).toBe(false);
    const reviewed = reviewExternalReference(pending, {
      reviewerId: reviewerIdValue,
      status: "reviewed",
      reviewedAt: instantValue,
    });
    expect(reviewed).toMatchObject({ ok: true, value: { urlStatus: "reviewed", version: 2 } });
    if (reviewed.ok) expect(canNavigateToExternalReference(reviewed.value)).toBe(true);
  });

  it("deduplicates one provider identity across overlapping collections", () => {
    const first = reference();
    const second = reference({
      externalReferenceId: secondReferenceIdValue,
      provider: "blind",
      externalKey: "three-sum",
      title: "Three Sum",
      canonicalUrl: "https://blind75.com/problems/three-sum",
    });
    const collection: ExternalCollection = {
      collectionId: collectionIdValue,
      slug: "blind-75",
      title: "Blind 75",
      memberships: [],
    };
    const once = addCollectionMembership(collection, first);
    const twice = addCollectionMembership(once, first);
    expect(twice.memberships).toEqual([first.externalReferenceId]);
    expect(deduplicateCollectionReferences([first, first, second])).toEqual([first, second]);
  });
});
