import type { NextResponse } from "next/server";
import { dependencyUnavailableError, notFoundError } from "@algocove/application";
import { getPracticeRuntime } from "../../../../../src/practice/runtime";
import { problemVersionFrom } from "../../../../../src/practice/problem-catalog";
import { learningError, learningResponse } from "../../../../../src/mastery/learning-http";

export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ problemId: string }> },
): Promise<NextResponse> {
  try {
    let version;
    try {
      version = problemVersionFrom((await params).problemId);
    } catch {
      throw notFoundError("This problem is not available.");
    }
    const runtime = getPracticeRuntime();
    if (runtime === null)
      throw dependencyUnavailableError("Practice content is temporarily unavailable.");
    const problem = await runtime.practice.getPublishedProblem(version);
    if (problem === null) throw notFoundError("This problem is not available.");
    return learningResponse({ problem });
  } catch (error) {
    return learningError(request, error);
  }
}
