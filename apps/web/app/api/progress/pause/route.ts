import type { NextResponse } from "next/server";
import {
  pauseOwnedStudy,
  validationError,
  dependencyUnavailableError,
} from "@algocove/application";
import { authenticatedWebRequestContext } from "../../../../src/auth/request-context";
import { getLearningRuntime } from "../../../../src/mastery/learning-runtime";
import {
  learningResponse,
  learningError,
  learningBody,
} from "../../../../src/mastery/learning-http";
export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const ctx = await authenticatedWebRequestContext(request);
    const input = await learningBody(request);
    if (
      typeof input.startDay !== "string" ||
      typeof input.endDay !== "string" ||
      typeof input.timezone !== "string"
    )
      throw validationError("Pause start and end days are required.");
    const runtime = getLearningRuntime();
    if (runtime === null) throw dependencyUnavailableError("Learning persistence is unavailable.");
    await pauseOwnedStudy(ctx, runtime.progress, {
      startDay: input.startDay,
      endDay: input.endDay,
      timezone: input.timezone,
    });
    return learningResponse({ status: "paused" });
  } catch (e) {
    return learningError(request, e);
  }
}
