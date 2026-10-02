import type { NextResponse } from "next/server";
import { getLearnerHome, dependencyUnavailableError } from "@algocove/application";
import { authenticatedWebRequestContext } from "../../../src/auth/request-context";
import { getLearningRuntime } from "../../../src/mastery/learning-runtime";
import { learningResponse, learningError } from "../../../src/mastery/learning-http";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const ctx = await authenticatedWebRequestContext(request);
    const runtime = getLearningRuntime();
    if (runtime === null) throw dependencyUnavailableError("Learning persistence is unavailable.");
    return learningResponse(await getLearnerHome(ctx, runtime.progress));
  } catch (e) {
    return learningError(request, e);
  }
}
