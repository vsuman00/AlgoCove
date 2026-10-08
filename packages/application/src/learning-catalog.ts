import { PROBLEM_LANGUAGES, type OpaqueId, type ProblemLanguage } from "@algocove/domain";
import { notFoundError, validationError } from "./errors.ts";

const SLUG = /^[a-z][a-z0-9-]{1,63}$/;
export type PublishedProblemSummary = {
  readonly problemId: string;
  readonly problemVersionId: OpaqueId<"problemVersion">;
  readonly contentVersionId: string;
  readonly checksum: string;
  readonly slug: string;
  readonly title: string;
  readonly pattern: string | null;
  readonly languages: readonly ProblemLanguage[];
};
export type CatalogFilter = {
  readonly limit: number;
  readonly after?: string;
  readonly search?: string;
  readonly pattern?: string;
  readonly language?: ProblemLanguage;
};
export type PublishedLearningCatalog = {
  listProblems(filter: CatalogFilter): Promise<readonly PublishedProblemSummary[]>;
  resolveProblem(slug: string): Promise<PublishedProblemSummary | null>;
};

export function validateCatalogSlug(value: unknown): string {
  if (typeof value !== "string" || !SLUG.test(value) || Object.hasOwn(Object.prototype, value))
    throw validationError("A valid catalog slug is required.");
  return value;
}
export function catalogFilter(raw: Readonly<Record<string, unknown>>): CatalogFilter {
  if (
    Object.keys(raw).some((k) => !["limit", "after", "search", "pattern", "language"].includes(k))
  )
    throw validationError("Unsupported catalog filter.");
  const limit = raw.limit === undefined ? 20 : raw.limit;
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 50)
    throw validationError("Catalog page size must be between 1 and 50.");
  if (raw.search !== undefined && (typeof raw.search !== "string" || raw.search.length > 100))
    throw validationError("Catalog search must be at most 100 characters.");
  if (raw.language !== undefined && !PROBLEM_LANGUAGES.includes(raw.language as ProblemLanguage))
    throw validationError("Unsupported catalog language.");
  return {
    limit,
    ...(raw.after === undefined ? {} : { after: validateCatalogSlug(raw.after) }),
    ...(raw.pattern === undefined ? {} : { pattern: validateCatalogSlug(raw.pattern) }),
    ...(raw.search === undefined ? {} : { search: (raw.search as string).trim() }),
    ...(raw.language === undefined ? {} : { language: raw.language as ProblemLanguage }),
  };
}
export async function listPublishedProblems(
  repo: PublishedLearningCatalog,
  raw: Readonly<Record<string, unknown>> = {},
): Promise<{ items: readonly PublishedProblemSummary[]; nextAfter: string | null }> {
  const filter = catalogFilter(raw);
  const rows = await repo.listProblems(filter);
  const items = rows.slice(0, filter.limit).map(publicSummary);
  return { items, nextAfter: rows.length > filter.limit ? items.at(-1)!.slug : null };
}
export async function resolvePublishedProblem(
  repo: PublishedLearningCatalog,
  slug: unknown,
): Promise<PublishedProblemSummary> {
  const item = await repo.resolveProblem(validateCatalogSlug(slug));
  if (!item) throw notFoundError("This problem is not available.");
  return publicSummary(item);
}
function publicSummary(item: PublishedProblemSummary): PublishedProblemSummary {
  // Construct the public view rather than returning adapter fields.
  return {
    problemId: item.problemId,
    problemVersionId: item.problemVersionId,
    contentVersionId: item.contentVersionId,
    checksum: item.checksum,
    slug: item.slug,
    title: item.title,
    pattern: item.pattern,
    languages: [...item.languages],
  };
}

export type PublishedCollectionSummary = {
  id: string;
  title: string;
  total: number;
  internal: number;
};
export type PublishedCollectionEntry = {
  collectionId: string;
  referenceId: string;
  ordinal: number;
  title: string;
  attribution: string;
  canonicalIdentity: string;
  solveUrl: string | null;
  internalSlug: string | null;
  mappingKind: string | null;
  mappingRationale: string | null;
  availability: "supported_internal" | "external_only" | "unavailable";
};
export type CollectionFilter = { after: string | null; search: string; limit: number };
export type PublishedCollectionCatalog = {
  list(
    input: CollectionFilter,
  ): Promise<{ items: PublishedCollectionSummary[]; nextAfter: string | null }>;
  get(id: string): Promise<{
    collection: { id: string; title: string } | null;
    items: PublishedCollectionEntry[];
    truncated: boolean;
  }>;
};
export function collectionFilter(raw: Readonly<Record<string, unknown>>): CollectionFilter {
  if (Object.keys(raw).some((k) => !["after", "search", "limit"].includes(k)))
    throw validationError("Unsupported sheet filter.");
  const limit = raw.limit ?? 20,
    search = raw.search ?? "",
    after = raw.after ?? null;
  if (
    typeof limit !== "number" ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50 ||
    typeof search !== "string" ||
    search.length > 100 ||
    (after !== null &&
      (typeof after !== "string" || !/^col_[0-9a-hjkmnp-tv-z]{16,52}$/.test(after)))
  )
    throw validationError("Invalid sheet filter.");
  return { limit, search: search.trim(), after: after as string | null };
}
export async function listPublishedCollections(
  repo: PublishedCollectionCatalog,
  raw: Readonly<Record<string, unknown>> = {},
): Promise<{ items: PublishedCollectionSummary[]; nextAfter: string | null }> {
  const data = await repo.list(collectionFilter(raw));
  return {
    items: data.items.map((r) => ({
      id: r.id,
      title: r.title,
      total: r.total,
      internal: r.internal,
    })),
    nextAfter: data.nextAfter,
  };
}
export async function getPublishedCollection(
  repo: PublishedCollectionCatalog,
  id: unknown,
): Promise<{
  collection: { id: string; title: string };
  items: PublishedCollectionEntry[];
  truncated: boolean;
}> {
  if (typeof id !== "string" || !/^col_[0-9a-hjkmnp-tv-z]{16,52}$/.test(id))
    throw validationError("Choose a curated sheet.");
  const data = await repo.get(id);
  if (!data.collection) throw notFoundError("Curated sheet is unavailable.");
  return {
    collection: { id: data.collection.id, title: data.collection.title },
    truncated: data.truncated,
    items: data.items.map((r) => ({
      collectionId: r.collectionId,
      referenceId: r.referenceId,
      ordinal: r.ordinal,
      title: r.title,
      attribution: r.attribution,
      canonicalIdentity: r.canonicalIdentity,
      solveUrl: r.solveUrl,
      internalSlug: r.internalSlug,
      mappingKind: r.mappingKind,
      mappingRationale: r.mappingRationale,
      availability: r.availability,
    })),
  };
}
