import { PostgresLearningReleaseRepository, withTransaction } from "@algocove/db";
import { LEGACY_LEARNING_VIEW } from "../../../../../src/practice/learning-workspace-adapters";
import type { NextResponse } from "next/server";
import {
  dependencyUnavailableError,
  notFoundError,
  validateCatalogSlug,
} from "@algocove/application";
import { getPracticeRuntime } from "../../../../../src/practice/runtime";
import { problemVersionFrom } from "../../../../../src/practice/problem-catalog";
import { learningError, learningResponse } from "../../../../../src/mastery/learning-http";

export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ problemId: string }> },
): Promise<NextResponse> {
  try {
    const slug = (await params).problemId;
    try {
      validateCatalogSlug(slug);
    } catch {
      throw notFoundError("This problem is not available.");
    }
    const version = await problemVersionFrom(slug);
    const runtime = getPracticeRuntime();
    if (runtime === null)
      throw dependencyUnavailableError("Practice content is temporarily unavailable.");
    const problem = await runtime.practice.getPublishedProblem(version);
    if (problem === null) throw notFoundError("This problem is not available.");
    const learning =
      version === "prb_dddddddddddddddd"
        ? LEGACY_LEARNING_VIEW
        : await withTransaction(
            runtime.pool,
            (tx) => new PostgresLearningReleaseRepository(tx).publicView(version),
            { readOnly: true },
          );
    return learningResponse({ problem: { ...problem, learning } });
  } catch (error) {
    return learningError(request, error);
  }
}
