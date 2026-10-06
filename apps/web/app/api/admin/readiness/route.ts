import type { NextResponse } from "next/server";
import { dependencyUnavailableError } from "@algocove/application";
import { authenticatedWebRequestContext } from "../../../../src/auth/request-context";
import { getPracticeRuntime } from "../../../../src/practice/runtime";
import {
  boundedLearningBody,
  learningError,
  learningResponse,
} from "../../../../src/mastery/learning-http";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const context = await authenticatedWebRequestContext(request),
      runtime = getPracticeRuntime();
    if (!runtime) throw dependencyUnavailableError("Content persistence is unavailable.");
    return learningResponse(await runtime.readinessContent.list(context));
  } catch (error) {
    return learningError(request, error);
  }
}
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const context = await authenticatedWebRequestContext(request),
      body = await boundedLearningBody(request),
      runtime = getPracticeRuntime();
    if (!runtime) throw dependencyUnavailableError("Content persistence is unavailable.");
    await runtime.readinessContent.command(context, body);
    return learningResponse({ status: "recorded" });
  } catch (error) {
    return learningError(request, error);
  }
}
