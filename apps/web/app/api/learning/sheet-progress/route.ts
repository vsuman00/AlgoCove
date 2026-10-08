import type { NextResponse } from "next/server";
import { PostgresLearningCollectionRepository } from "@algocove/db";
import { dependencyUnavailableError, validationError } from "@algocove/application";
import { authenticatedWebRequestContext } from "../../../../src/auth/request-context";
import { getPracticeRuntime } from "../../../../src/practice/runtime";
import { learningResponse, learningError } from "../../../../src/mastery/learning-http";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const ctx = await authenticatedWebRequestContext(request),
      q = new URL(request.url).searchParams,
      id = q.get("id");
    if (
      !id ||
      !/^col_[0-9a-hjkmnp-tv-z]{16,52}$/.test(id) ||
      [...q.keys()].some((k) => k !== "id" || q.getAll(k).length !== 1)
    )
      throw validationError("Choose a curated sheet.");
    const runtime = getPracticeRuntime();
    if (!runtime) throw dependencyUnavailableError("Private progress is temporarily unavailable.");
    return learningResponse({
      items: await new PostgresLearningCollectionRepository(runtime.pool).progress(
        ctx.actor.userId,
        id,
      ),
    });
  } catch (e) {
    return learningError(request, e);
  }
}
