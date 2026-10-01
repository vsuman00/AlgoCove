import {
  PSEUDOCODE_FIELDS,
  type AuthoredPseudocodeRubric,
  type PseudocodeRevision,
  type StructuredPseudocodeCheck,
} from "@algocove/domain";

export const CONTAINER_REASONING_RUBRIC: AuthoredPseudocodeRubric = {
  rubricId: "container.reasoning.v1",
  version: 1,
  requiredFields: PSEUDOCODE_FIELDS,
  requiredStructuredChecks: 2,
  requiredVerifiedPasses: 1,
};

/** Reviewed original answer key. Prose remains advisory; only exact selections count. */
export function containerReasoningChecks(
  revision: PseudocodeRevision,
): readonly StructuredPseudocodeCheck[] {
  return Object.entries({ area: "minimum_times_width", boundary: "shorter" }).map(
    ([question, answer]) => ({
      checkId: `container-v1-${question}`,
      rubricId: CONTAINER_REASONING_RUBRIC.rubricId,
      rubricVersion: CONTAINER_REASONING_RUBRIC.version,
      pseudocodeId: revision.pseudocodeId,
      revision: revision.revision,
      evidenceClass: "structured_check" as const,
      passed:
        revision.problemVersionId === "prb_dddddddddddddddd" &&
        revision.fields.structuredAnswers?.[question] === answer,
    }),
  );
}
