import type { OpaqueId } from "@algocove/domain";
import {
  dependencyUnavailableError,
  resolvePublishedProblem,
  validateCatalogSlug,
} from "@algocove/application";
import { PostgresLearningCatalogRepository } from "@algocove/db";
import { getPracticeRuntime } from "./runtime";

/** Route identity resolves from the published catalog; never invent a version from a slug. */
export async function problemVersionFrom(value: unknown): Promise<OpaqueId<"problemVersion">> {
  const slug = validateCatalogSlug(value);
  const runtime = getPracticeRuntime();
  if (!runtime) throw dependencyUnavailableError("Practice content is temporarily unavailable.");
  const problem = await resolvePublishedProblem(
    new PostgresLearningCatalogRepository(runtime.pool),
    slug,
  );
  return problem.problemVersionId;
}
