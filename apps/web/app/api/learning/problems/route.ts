import type { NextResponse } from "next/server";
import {
  dependencyUnavailableError,
  listPublishedProblems,
  validationError,
} from "@algocove/application";
import { PostgresLearningCatalogRepository } from "@algocove/db";
import { getPracticeRuntime } from "../../../../src/practice/runtime";
import { learningError, learningResponse } from "../../../../src/mastery/learning-http";

export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const params = new URL(request.url).searchParams;
    const filters: Record<string, unknown> = Object.create(null);
    for (const [key, value] of params) {
      if (Object.hasOwn(filters, key))
        throw validationError("Catalog filters may not be repeated.");
      filters[key] = key === "limit" ? Number(value) : value;
    }
    const runtime = getPracticeRuntime();
    if (!runtime) throw dependencyUnavailableError("Learning catalog is temporarily unavailable.");
    return learningResponse(
      await listPublishedProblems(new PostgresLearningCatalogRepository(runtime.pool), filters),
    );
  } catch (error) {
    return learningError(request, error);
  }
}
