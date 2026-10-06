import type { NextResponse } from "next/server";
import {
  dependencyUnavailableError,
  evaluateOwnedExternalReadiness,
  validationError,
} from "@algocove/application";
import { parseId } from "@algocove/domain";
import { authenticatedWebRequestContext } from "../../../../src/auth/request-context";
import { getPracticeRuntime } from "../../../../src/practice/runtime";
import {
  learningResponse,
  learningError,
  learningBody,
} from "../../../../src/mastery/learning-http";
export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const context = await authenticatedWebRequestContext(request);
    const body = await learningBody(request);
    const attemptId = parseId("attempt", body.attemptId);
    if (
      !attemptId.ok ||
      Object.keys(body).some((key) => key !== "attemptId" && key !== "bypassRequested") ||
      (body.bypassRequested !== undefined && typeof body.bypassRequested !== "boolean")
    )
      throw validationError("Provide an attempt identifier and optional bypass request only.");
    const runtime = getPracticeRuntime();
    if (runtime === null) throw dependencyUnavailableError("Practice persistence is unavailable.");
    return learningResponse(
      await evaluateOwnedExternalReadiness(context, runtime.externalReadiness, {
        attemptId: attemptId.value,
        bypassRequested: body.bypassRequested === true,
      }),
    );
  } catch (error) {
    return learningError(request, error);
  }
}
