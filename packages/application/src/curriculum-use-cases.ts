import {
  publishCurriculumGraph,
  type CurriculumGraphInput,
  type CurriculumGraphVersion,
  type CurriculumVersionId,
} from "@algocove/domain";
import { requirePermission } from "./authorize.ts";
import { validationError } from "./errors.ts";
import type { RequestContext } from "./request-context.ts";

export type CurriculumGraphRepository = {
  publish(graph: CurriculumGraphVersion): Promise<CurriculumGraphVersion>;
  getPublished(versionId: CurriculumVersionId): Promise<CurriculumGraphVersion | null>;
};

/** Publish a validated graph snapshot; editing a published graph is never an update operation. */
export async function publishCurriculumVersion(
  context: RequestContext,
  repository: CurriculumGraphRepository,
  input: {
    readonly curriculumVersionId: CurriculumVersionId;
    readonly versionNumber: number;
    readonly graph: CurriculumGraphInput;
  },
): Promise<CurriculumGraphVersion> {
  requirePermission(context, "content.publish");
  const graph = publishCurriculumGraph({
    ...input,
    createdAt: context.now,
    publishedAt: context.now,
  });
  if (!graph.ok) throw validationError(graph.error.message, { field: graph.error.code });
  return repository.publish(graph.value);
}

/** Resolve the exact snapshot referenced by a historical session or receipt. */
export async function resolvePublishedCurriculumVersion(
  repository: CurriculumGraphRepository,
  versionId: CurriculumVersionId,
): Promise<CurriculumGraphVersion> {
  const graph = await repository.getPublished(versionId);
  if (graph === null) throw new Error("The pinned curriculum graph version is unavailable.");
  return graph;
}
