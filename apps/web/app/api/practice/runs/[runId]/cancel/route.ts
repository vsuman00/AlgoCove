import { learningError as errorResponse } from "../../../../../../src/mastery/learning-http";
import { NextResponse } from "next/server";
import {
  cancelPracticeCodeRun,
  dependencyUnavailableError,
  notFoundError,
} from "@algocove/application";
import { parseId } from "@algocove/domain";
import { authenticatedWebRequestContext } from "../../../../../../src/auth/request-context";
import { getPracticeRuntime } from "../../../../../../src/practice/runtime";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { readonly params: Promise<{ readonly runId: string }> },
): Promise<NextResponse> {
  try {
    const context = await authenticatedWebRequestContext(request);
    const { runId: rawRunId } = await params;
    const runId = parseId("codeRun", rawRunId);
    if (!runId.ok) throw notFoundError("Execution run is not available.");
    const runtime = getPracticeRuntime();
    if (runtime === null) throw dependencyUnavailableError("Practice persistence is unavailable.");
    if (runtime.executionRelay === null) {
      throw dependencyUnavailableError("Execution cancellation is temporarily unavailable.");
    }
    await cancelPracticeCodeRun(context, runtime.practice, runtime.executionRelay, {
      runId: runId.value,
      reason: "learner",
    });
    return NextResponse.json(
      { status: "cancellation_requested", runId: runId.value },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(request, error);
  }
}
