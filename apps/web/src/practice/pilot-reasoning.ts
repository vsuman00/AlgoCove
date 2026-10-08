import {
  PSEUDOCODE_FIELDS,
  parseReviewedQuestions,
  type AuthoredPseudocodeRubric,
  type PseudocodeRevision,
  type StructuredPseudocodeCheck,
} from "@algocove/domain";
import { CONTAINER_REASONING_RUBRIC, containerReasoningChecks } from "./container-reasoning";
import type { PracticeRuntime } from "./runtime";
/** Reviewed answer keys stay server-side. Free text presence never substitutes for grading. */
export async function reasoningContract(
  pool: PracticeRuntime["pool"],
  revision: PseudocodeRevision | undefined,
): Promise<{
  rubric: AuthoredPseudocodeRubric;
  structuredChecks: readonly StructuredPseudocodeCheck[];
}> {
  if (!revision || revision.problemVersionId === "prb_dddddddddddddddd")
    return {
      rubric: CONTAINER_REASONING_RUBRIC,
      structuredChecks: revision ? containerReasoningChecks(revision) : [],
    };
  const row = (
    await pool.query(
      "SELECT e.questions,e.rubric_version,COALESCE(p.pattern,r.packet->>'pattern') AS pattern FROM content.review_exercise e JOIN content.problem_version problem USING(problem_version_id) JOIN content.content_version v ON v.content_version_id=problem.content_version_id LEFT JOIN content.pilot_bundle p USING(problem_version_id) LEFT JOIN content.learning_release r ON r.content_version_id=v.content_version_id WHERE e.problem_version_id=$1 AND e.kind='recall' AND e.status='published' AND v.status='published' AND v.payload_status='available' AND (e.rights_expires_at IS NULL OR e.rights_expires_at>now()) AND (v.rights_expires_at IS NULL OR v.rights_expires_at>now())",
      [revision.problemVersionId],
    )
  ).rows[0];
  const rubric: AuthoredPseudocodeRubric = {
    rubricId: `pilot.${row?.pattern ?? "unavailable"}.reasoning.v1`,
    version: row?.rubric_version ?? 1,
    requiredFields: PSEUDOCODE_FIELDS,
    requiredStructuredChecks: 1,
    requiredVerifiedPasses: 1,
  };
  if (!row) return { rubric, structuredChecks: [] };
  const questions = parseReviewedQuestions(row.questions);
  return {
    rubric: { ...rubric, requiredStructuredChecks: questions.length },
    structuredChecks: questions.map((q) => ({
      checkId: `${rubric.rubricId}-${q.id}`,
      rubricId: rubric.rubricId,
      rubricVersion: rubric.version,
      pseudocodeId: revision.pseudocodeId,
      revision: revision.revision,
      evidenceClass: "structured_check",
      passed: revision.fields.structuredAnswers?.[q.id] === q.answer,
    })),
  };
}
