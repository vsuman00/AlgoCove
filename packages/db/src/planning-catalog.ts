import type {
  PlanningCatalog,
  PlanUnit,
  RoadmapPreferences,
  LearnerId,
  Instant,
  ProblemLanguage,
} from "@algocove/domain";
import { localStudyDay } from "@algocove/domain";
import type { Transaction } from "./transaction.ts";
/** Authored pilot estimates v1: introduction 20m; reasoning, tracing and coding 50m.
 * Catalog adapters expose only journeys actually supported by this release. */
export async function loadPlanningCatalog(
  tx: Transaction,
  learnerId: LearnerId,
  p: RoadmapPreferences,
  now: Instant,
  lock = false,
): Promise<PlanningCatalog> {
  const graph = await tx.query<{ curriculum_version_id: string }>(
    "SELECT curriculum_version_id FROM learning.curriculum_graph_version WHERE status='published' ORDER BY version_number DESC LIMIT 1",
  );
  const problem = await tx.query<{
    problem_version_id: string;
    content_version_id: string;
    title: string;
    languages: ProblemLanguage[];
    rights_valid: boolean;
    slug: string | null;
  }>(
    `SELECT eligible.problem_version_id,eligible.content_version_id,eligible.title,eligible.slug,
       (c.rights_expires_at IS NULL OR c.rights_expires_at>$1) AS rights_valid,eligible.languages
     FROM content.eligible_learning_problem eligible
     JOIN content.content_version c USING(content_version_id)
     WHERE eligible.problem_version_id=(SELECT latest.problem_version_id FROM content.eligible_learning_problem latest
       WHERE latest.problem_id=eligible.problem_id ORDER BY latest.published_at DESC,latest.problem_version_id DESC LIMIT 1)
     ORDER BY eligible.slug ${lock ? "FOR SHARE OF c" : ""}`,
    [now],
  );
  const units: PlanUnit[] = [];
  for (const row of problem.rows) {
    const edges = await tx.query<{ from_concept_id: string }>(
      `SELECT DISTINCT e.from_concept_id FROM learning.curriculum_edge e JOIN learning.problem_concept m ON m.concept_id=e.to_concept_id WHERE e.curriculum_version_id=$1 AND e.edge_kind='required' AND m.problem_version_id=$2`,
      [graph.rows[0]?.curriculum_version_id ?? null, row.problem_version_id],
    );
    units.push({
      key: `lesson:${row.content_version_id}`,
      kind: "lesson",
      targetId: row.content_version_id,
      title: `Introduction: ${row.title}`,
      href: `/learn/lessons/${row.slug ?? "arrays-two-pointer"}`,
      minutes: 20,
      required: true,
      prerequisites: edges.rows.map((e) => `concept:${e.from_concept_id}`),
      languages: [],
      available: true,
      rightsValid: row.rights_valid,
      linkHealthy: true,
      reasonCodes: ["reviewed_pilot_introduction", "estimate_policy_v1"],
    });
    units.push({
      key: `problem:${row.problem_version_id}`,
      kind: "internal_problem",
      targetId: row.problem_version_id,
      title: row.title,
      href: `/learn/${row.slug ?? "arrays-two-pointer"}`,
      minutes: 50,
      required: true,
      prerequisites: [`lesson:${row.content_version_id}`],
      languages: row.languages,
      available: true,
      rightsValid: row.rights_valid,
      linkHealthy: true,
      reasonCodes: ["reviewed_pilot_core", "reasoning_trace_coding_estimate_v1"],
    });
  }
  const mastered = await tx.query<{ concept_id: string }>(
    `SELECT p.concept_id FROM mastery.projection p WHERE p.learner_id=$1 AND p.policy_version=1 AND p.body->>'band' IN ('independent_completion','independent_delayed_transfer') AND (p.body->>'evidenceCount')::integer=(SELECT count(*) FROM mastery.evidence e WHERE e.learner_id=$1 AND e.concept_id=p.concept_id) AND NOT EXISTS(SELECT 1 FROM (SELECT observation_id,problem_version_id,learner_id FROM practice.assessment_observation UNION ALL SELECT observation_id,problem_version_id,learner_id FROM practice.learning_observation) o JOIN learning.problem_concept m USING(problem_version_id) WHERE o.learner_id=$1 AND m.concept_id=p.concept_id AND NOT EXISTS(SELECT 1 FROM mastery.evidence e WHERE e.observation_id=o.observation_id AND e.concept_id=m.concept_id))`,
    [learnerId],
  );
  const reviews = await tx.query<{
    review_id: string;
    due_start: Date;
    due_end: Date;
    title: string;
    available: boolean;
  }>(
    `SELECT r.review_id,r.due_start,r.due_end,c.title,EXISTS(SELECT 1 FROM content.available_release_exercise e WHERE e.concept_id=r.concept_id AND e.status='published' AND (e.rights_expires_at IS NULL OR e.rights_expires_at>$2)) AS available FROM mastery.review_item r JOIN learning.concept c USING(concept_id) WHERE r.learner_id=$1 AND r.status IN ('due','deferred') ORDER BY r.due_start,r.review_id ${lock ? "FOR SHARE OF r" : ""}`,
    [learnerId, now],
  );
  const today = localStudyDay(now, p.timezone);
  for (const review of reviews.rows) {
    const dueStart = localStudyDay(review.due_start.toISOString() as Instant, p.timezone),
      dueEnd = localStudyDay(review.due_end.toISOString() as Instant, p.timezone);
    units.push({
      key: `review:${review.review_id}`,
      kind: "review",
      targetId: review.review_id,
      title: `Review: ${review.title}`,
      href: "/review",
      minutes: 15,
      required: true,
      prerequisites: [],
      languages: [],
      available: review.available,
      rightsValid: review.available,
      linkHealthy: true,
      dueStart: dueStart < today ? today : dueStart,
      dueEnd: dueEnd < today ? today : dueEnd,
      reasonCodes: [dueEnd < today ? "overdue_recovery" : "spaced_review", "review_policy_v1"],
    });
  }
  const collections = [];
  for (const id of p.collectionIds) {
    const counts = await tx.query<{ total: number; unavailable: number; supported: number }>(
      `SELECT count(DISTINCT canonical_identity)::integer AS total,
       count(DISTINCT canonical_identity) FILTER(WHERE availability='unavailable')::integer AS unavailable,
       count(DISTINCT canonical_identity) FILTER(WHERE availability='supported_internal')::integer AS supported
       FROM content.collection_entry_availability WHERE collection_id=$1`,
      [id],
    );
    const c = counts.rows[0]!;
    const title = (
      await tx.query<{ title: string }>(
        "SELECT title FROM content.external_collection WHERE collection_id=$1",
        [id],
      )
    ).rows[0]?.title;
    collections.push({
      id,
      ...(title === undefined ? {} : { title }),
      total: c.total,
      supported: c.supported,
      externalOnly: c.total - c.unavailable - c.supported,
      unavailable: c.unavailable,
    });
  }
  return {
    curriculumVersionId: graph.rows[0]?.curriculum_version_id ?? null,
    units,
    masteredKeys: mastered.rows.map((r) => `concept:${r.concept_id}`),
    coverage:
      "Published original pilot exercises, their introductions and existing review obligations. Comprehensive DSA and complete sheet coverage are unavailable.",
    fullCoverage: false,
    collections,
  };
}
