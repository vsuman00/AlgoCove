import type { QueryResult, QueryResultRow } from "pg";
import type {
  CatalogFilter,
  PublishedLearningCatalog,
  PublishedProblemSummary,
} from "@algocove/application";
import { parseId, type ProblemLanguage } from "@algocove/domain";

type CatalogQuery = {
  query<T extends QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
};

type Row = {
  problem_id: string;
  problem_version_id: string;
  content_version_id: string;
  checksum: string;
  slug: string;
  title: string;
  pattern: string | null;
  languages: ProblemLanguage[];
};
function summary(row: Row): PublishedProblemSummary {
  const version = parseId("problemVersion", row.problem_version_id);
  if (!version.ok) throw Error("Published catalog identity is invalid.");
  return {
    problemId: row.problem_id,
    problemVersionId: version.value,
    contentVersionId: row.content_version_id,
    checksum: row.checksum,
    slug: row.slug,
    title: row.title,
    pattern: row.pattern,
    languages: row.languages,
  };
}
export class PostgresLearningCatalogRepository implements PublishedLearningCatalog {
  private readonly db: CatalogQuery;
  constructor(db: CatalogQuery) {
    this.db = db;
  }
  async listProblems(filter: CatalogFilter): Promise<readonly PublishedProblemSummary[]> {
    const rows = await this.db.query<Row>(
      `WITH latest AS (SELECT DISTINCT ON(slug) * FROM content.eligible_learning_problem ORDER BY slug,published_at DESC,problem_version_id DESC)
       SELECT problem_id,problem_version_id,content_version_id,checksum,slug,title,pattern,languages FROM latest
       WHERE ($1::text IS NULL OR slug>$1) AND ($2::text IS NULL OR position(lower($2) in lower(title))>0)
         AND ($3::text IS NULL OR pattern=$3) AND ($4::text IS NULL OR $4=ANY(languages))
       ORDER BY slug LIMIT $5`,
      [
        filter.after ?? null,
        filter.search || null,
        filter.pattern ?? null,
        filter.language ?? null,
        filter.limit + 1,
      ],
    );
    return rows.rows.map(summary);
  }
  async resolveProblem(slug: string): Promise<PublishedProblemSummary | null> {
    const rows = await this.db.query<Row>(
      `SELECT eligible.problem_id,eligible.problem_version_id,eligible.content_version_id,eligible.checksum,
              eligible.slug,eligible.title,eligible.pattern,eligible.languages
       FROM content.problem_route route JOIN content.eligible_learning_problem eligible USING(problem_id)
       WHERE route.slug=$1 ORDER BY eligible.published_at DESC,eligible.problem_version_id DESC LIMIT 1`,
      [slug],
    );
    return rows.rows[0] ? summary(rows.rows[0]) : null;
  }
}
