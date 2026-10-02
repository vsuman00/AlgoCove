import {
  PERMISSIONS,
  type ConceptId,
  type ProblemVersionId,
  type LearnerId,
  type Instant,
} from "@algocove/domain";
import { requirePermission } from "./authorize.ts";
import { validationError } from "./errors.ts";
import type { RequestContext } from "./request-context.ts";
export type ConceptMappingRepository = {
  replaceDraftMapping(input: {
    problemVersionId: ProblemVersionId;
    learnerId: LearnerId;
    now: Instant;
    mappings: readonly { conceptId: ConceptId; rationale: string }[];
  }): Promise<void>;
};
export async function authorProblemConceptMapping(
  context: RequestContext,
  repository: ConceptMappingRepository,
  input: {
    problemVersionId: ProblemVersionId;
    mappings: readonly { conceptId: ConceptId; rationale: string }[];
  },
): Promise<void> {
  requirePermission(context, PERMISSIONS.contentAuthor);
  if (
    input.mappings.length < 1 ||
    input.mappings.length > 16 ||
    new Set(input.mappings.map((m) => m.conceptId)).size !== input.mappings.length ||
    input.mappings.some((m) => m.rationale.trim().length < 1 || m.rationale.length > 500)
  )
    throw validationError(
      "Provide one to sixteen distinct concepts with a bounded mapping rationale.",
    );
  await repository.replaceDraftMapping({
    ...input,
    learnerId: context.actor.userId,
    now: context.now,
  });
}
