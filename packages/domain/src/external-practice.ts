import {
  err,
  normalizeLearnerText,
  ok,
  textLength,
  type Instant,
  type LearnerId,
  type OpaqueId,
  type Result,
} from "./primitives.ts";

export type ExternalReferenceId = OpaqueId<"externalReference">;
export type CollectionId = OpaqueId<"collection">;

export const EXTERNAL_PROVIDERS = [
  "blind",
  "neetcode",
  "top_interview_150",
  "grind_75",
  "striver_a2z",
] as const;
export type ExternalProvider = (typeof EXTERNAL_PROVIDERS)[number];

export const EXTERNAL_LINK_STATUSES = ["unreviewed", "reviewed", "unavailable", "blocked"] as const;
export type ExternalLinkStatus = (typeof EXTERNAL_LINK_STATUSES)[number];

export const PROVIDER_DOMAINS: Readonly<Record<ExternalProvider, readonly string[]>> = {
  blind: ["blind75.com"],
  neetcode: ["neetcode.io"],
  top_interview_150: ["leetcode.com"],
  grind_75: ["grind75.com"],
  striver_a2z: ["takeuforward.org"],
};

export type ExternalReference = {
  readonly externalReferenceId: ExternalReferenceId;
  readonly provider: ExternalProvider;
  /** Provider-owned stable identity, not scraped content. */
  readonly externalKey: string;
  readonly title: string;
  readonly canonicalUrl: string;
  readonly attribution: string;
  readonly urlStatus: ExternalLinkStatus;
  readonly reviewedBy: LearnerId | null;
  readonly reviewedAt: Instant | null;
  readonly version: number;
};

export type ExternalCollection = {
  readonly collectionId: CollectionId;
  readonly slug: string;
  readonly title: string;
  readonly memberships: readonly ExternalReferenceId[];
};

export type ExternalFailureCode =
  | "invalid_provider"
  | "invalid_key"
  | "invalid_title"
  | "invalid_attribution"
  | "invalid_url"
  | "domain_not_allowed"
  | "invalid_review"
  | "invalid_status";

export type ExternalFailure = {
  readonly code: ExternalFailureCode;
  readonly message: string;
};

function boundedText(value: string, maximum: number): string | null {
  const normalized = normalizeLearnerText(value);
  return normalized.length > 0 && textLength(normalized) <= maximum ? normalized : null;
}

function providerIsKnown(value: string): value is ExternalProvider {
  return (EXTERNAL_PROVIDERS as readonly string[]).includes(value);
}

function hostMatchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function validateExternalUrl(
  provider: ExternalProvider,
  value: string,
): Result<string, ExternalFailure> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return err({ code: "invalid_url", message: "External references require a valid URL." });
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || url.hash !== "") {
    return err({
      code: "invalid_url",
      message: "External references require HTTPS without credentials or fragments.",
    });
  }
  const allowed = PROVIDER_DOMAINS[provider].some((domain) =>
    hostMatchesDomain(url.hostname.toLowerCase(), domain),
  );
  if (!allowed) {
    return err({
      code: "domain_not_allowed",
      message: "The URL host is not allowlisted for this provider.",
    });
  }
  url.hostname = url.hostname.toLowerCase();
  return ok(url.toString().replace(/\/$/, ""));
}

export function createExternalReference(input: {
  readonly externalReferenceId: ExternalReferenceId;
  readonly provider: string;
  readonly externalKey: string;
  readonly title: string;
  readonly canonicalUrl: string;
  readonly attribution: string;
}): Result<ExternalReference, ExternalFailure> {
  if (!providerIsKnown(input.provider)) {
    return err({ code: "invalid_provider", message: "External provider is not allowlisted." });
  }
  const externalKey = boundedText(input.externalKey, 200);
  const title = boundedText(input.title, 240);
  const attribution = boundedText(input.attribution, 240);
  if (externalKey === null)
    return err({ code: "invalid_key", message: "External identity is required." });
  if (title === null) return err({ code: "invalid_title", message: "External title is required." });
  if (attribution === null)
    return err({ code: "invalid_attribution", message: "Attribution is required." });
  const url = validateExternalUrl(input.provider, input.canonicalUrl);
  if (!url.ok) return url;
  return ok({
    externalReferenceId: input.externalReferenceId,
    provider: input.provider,
    externalKey,
    title,
    canonicalUrl: url.value,
    attribution,
    urlStatus: "unreviewed",
    reviewedBy: null,
    reviewedAt: null,
    version: 1,
  });
}

export function reviewExternalReference(
  reference: ExternalReference,
  input: {
    readonly reviewerId: LearnerId;
    readonly status: Exclude<ExternalLinkStatus, "unreviewed">;
    readonly reviewedAt: Instant;
  },
): Result<ExternalReference, ExternalFailure> {
  if (reference.urlStatus !== "unreviewed") {
    return err({
      code: "invalid_review",
      message: "Only an unreviewed reference can receive its first review.",
    });
  }
  return ok({
    ...reference,
    urlStatus: input.status,
    reviewedBy: input.reviewerId,
    reviewedAt: input.reviewedAt,
    version: reference.version + 1,
  });
}

export function canNavigateToExternalReference(reference: ExternalReference): boolean {
  return reference.urlStatus === "reviewed";
}

export function addCollectionMembership(
  collection: ExternalCollection,
  reference: ExternalReference,
): ExternalCollection {
  if (collection.memberships.includes(reference.externalReferenceId)) return collection;
  return { ...collection, memberships: [...collection.memberships, reference.externalReferenceId] };
}

export function deduplicateCollectionReferences(
  references: readonly ExternalReference[],
): readonly ExternalReference[] {
  const seen = new Set<string>();
  return references.filter((reference) => {
    const key = `${reference.provider}:${reference.externalKey}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
