import type {
  PublishedCollectionCatalog,
  PublishedCollectionSummary,
  PublishedCollectionEntry,
} from "@algocove/application";
import type { QueryResult, QueryResultRow } from "pg";
type CollectionQuery = {
  query<T extends QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
};
/** Public projection retains ordered occurrences and exposes canonical identity separately. */
export class PostgresLearningCollectionRepository implements PublishedCollectionCatalog {
  private readonly pool: CollectionQuery;
  constructor(pool: CollectionQuery) {
    this.pool = pool;
  }
  async get(id: string): Promise<{
    collection: { id: string; title: string } | null;
    items: PublishedCollectionEntry[];
    truncated: boolean;
  }> {
    const entries = (
      await this.pool.query<PublishedCollectionEntry>(
        `SELECT collection_id AS "collectionId",external_reference_id AS "referenceId",ordinal,title,attribution,canonical_identity AS "canonicalIdentity",solve_url AS "solveUrl",internal_slug AS "internalSlug",mapping_kind AS "mappingKind",mapping_rationale AS "mappingRationale",availability FROM content.collection_entry_availability WHERE collection_id=$1 ORDER BY ordinal LIMIT 501`,
        [id],
      )
    ).rows;
    const collection = (
      await this.pool.query<{ id: string; title: string }>(
        "SELECT collection_id AS id,title FROM content.external_collection WHERE collection_id=$1",
        [id],
      )
    ).rows[0];
    return {
      collection: collection ?? null,
      items: entries.slice(0, 500),
      truncated: entries.length > 500,
    };
  }
  async list(input: {
    after: string | null;
    search: string;
    limit: number;
  }): Promise<{ items: PublishedCollectionSummary[]; nextAfter: string | null }> {
    const rows = (
      await this.pool.query<PublishedCollectionSummary>(
        `SELECT c.collection_id AS id,c.title,count(DISTINCT a.canonical_identity)::integer AS total,count(DISTINCT a.canonical_identity) FILTER(WHERE a.availability='supported_internal')::integer AS internal FROM content.external_collection c LEFT JOIN content.collection_entry_availability a USING(collection_id) WHERE ($1::text IS NULL OR c.collection_id>$1) AND position(lower($2) in lower(c.title))>0 GROUP BY c.collection_id,c.title ORDER BY c.collection_id LIMIT $3`,
        [input.after, input.search, input.limit + 1],
      )
    ).rows;
    return {
      items: rows.slice(0, input.limit),
      nextAfter: rows.length > input.limit ? rows[input.limit - 1]!.id : null,
    };
  }
  async progress(learnerId: string, id: string): Promise<Record<string, unknown>[]> {
    return (
      await this.pool.query(
        `SELECT a.canonical_identity AS "canonicalIdentity",COALESCE((SELECT e.kind FROM practice.external_practice_event e JOIN content.external_destination_mapping m ON m.external_reference_id=e.reference_id WHERE e.learner_id=$1 AND COALESCE(m.destination_id,'reference:'||e.reference_id)=a.canonical_identity AND e.kind IN ('completed','corrected') ORDER BY e.occurred_at DESC,e.event_id DESC LIMIT 1),'unreported') AS "selfReport",bool_or(EXISTS(SELECT 1 FROM practice.attempt p WHERE p.learner_id=$1 AND p.problem_version_id=a.internal_problem_version_id AND p.status='submitted')) AS "hasSubmittedAttempt" FROM content.collection_entry_availability a WHERE a.collection_id=$2 GROUP BY a.canonical_identity ORDER BY a.canonical_identity`,
        [learnerId, id],
      )
    ).rows;
  }
}
