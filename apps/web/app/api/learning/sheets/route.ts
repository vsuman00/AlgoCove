import type { NextResponse } from "next/server";
import { PostgresLearningCollectionRepository } from "@algocove/db";
import {
  dependencyUnavailableError,
  validationError,
  getPublishedCollection,
  listPublishedCollections,
} from "@algocove/application";
import { getPracticeRuntime } from "../../../../src/practice/runtime";
import { learningResponse, learningError } from "../../../../src/mastery/learning-http";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const params = new URL(request.url).searchParams;
    if (
      [...params.keys()].some(
        (k) => !["id", "after", "search", "limit"].includes(k) || params.getAll(k).length !== 1,
      )
    )
      throw validationError("Unsupported sheet filter.");
    const id = params.get("id"),
      after = params.get("after"),
      search = params.get("search") ?? "",
      limit = Number(params.get("limit") ?? 20);
    if (
      search.length > 100 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 50 ||
      [id, after].some((v) => v !== null && !/^[a-z0-9._-]{1,128}$/.test(v))
    )
      throw validationError("Invalid sheet filter.");
    const runtime = getPracticeRuntime();
    if (!runtime) throw dependencyUnavailableError("Sheet discovery is temporarily unavailable.");
    const repo = new PostgresLearningCollectionRepository(runtime.pool);
    return learningResponse(
      id
        ? await getPublishedCollection(repo, id)
        : await listPublishedCollections(repo, { after, search, limit }),
    );
  } catch (e) {
    return learningError(request, e);
  }
}
