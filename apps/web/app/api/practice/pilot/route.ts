import type { NextResponse } from "next/server";
import { PILOT_CATALOG, pilotIdentity } from "@algocove/domain";
import { dependencyUnavailableError } from "@algocove/application";
import { getPracticeRuntime } from "../../../../src/practice/runtime";
import { learningResponse, learningError } from "../../../../src/mastery/learning-http";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const runtime = getPracticeRuntime();
    if (!runtime) throw dependencyUnavailableError("Pilot catalog persistence is unavailable.");
    const rows = (
      await runtime.pool.query(
        `SELECT p.slug,v.title,EXISTS(SELECT 1 FROM content.eligible_learning_problem eligible WHERE eligible.problem_version_id=p.problem_version_id) available FROM content.pilot_bundle p JOIN content.content_version v USING(content_version_id)`,
      )
    ).rows;
    const items = [];
    for (const entry of PILOT_CATALOG) {
      const id = pilotIdentity(entry.slug)!;
      const row = rows.find((r) => r.slug === entry.slug);
      const ref = (
        await runtime.pool.query(
          `SELECT r.title,r.canonical_url,r.attribution,x.mapping_kind,x.mapping_rationale FROM content.external_readiness_rubric x JOIN content.reviewed_practice_destination r USING(external_reference_id) WHERE x.problem_version_id=$1 AND x.status='published' AND r.reviewed_by IS NOT NULL AND r.reviewed_at IS NOT NULL ORDER BY x.version DESC LIMIT 1`,
          [id.problemVersionId],
        )
      ).rows[0];
      items.push({
        pattern: entry.pattern,
        slug: entry.slug,
        title: row?.available ? row.title : entry.pattern.replaceAll("-", " "),
        status: row?.available ? "supported_internal" : ref ? "external_only" : "unavailable",
        href: row?.available ? `/learn/${entry.slug}` : null,
        external: ref
          ? {
              title: ref.title,
              url: ref.canonical_url,
              attribution: ref.attribution,
              relation: ref.mapping_kind,
              rationale: ref.mapping_rationale,
            }
          : null,
      });
    }
    return learningResponse({
      items,
      coverage:
        "Four original pilot exercises. Complete DSA and named-sheet coverage are unavailable.",
    });
  } catch (e) {
    return learningError(request, e);
  }
}
