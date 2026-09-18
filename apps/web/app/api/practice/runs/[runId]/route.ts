import { NextResponse } from "next/server";
import {
  dependencyUnavailableError,
  notFoundError,
  toErrorEnvelope,
  toHttpStatus,
} from "@algocove/application";
import { parseId } from "@algocove/domain";
import { authenticatedWebRequestContext } from "../../../../../src/auth/request-context";
import { getPracticeRuntime } from "../../../../../src/practice/runtime";

export const dynamic = "force-dynamic";

export async function GET(
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
    const run = await runtime.practice.getRun(runId.value, context.actor.userId);
    if (run === null) throw notFoundError("Execution run is not available.");
    const attempt = await runtime.practice.getAttempt(run.attemptId, context.actor.userId);
    if (attempt === null) throw notFoundError("Execution attempt is not available.");
    const terminal =
      run.terminalResultId === null
        ? null
        : run.terminalCategory !== null && run.classification !== null && run.completedAt !== null
          ? {
              resultId: run.terminalResultId,
              terminalCategory: run.terminalCategory,
              classification: run.classification,
              passed: run.terminalCategory === "pass" && run.classification === "success",
              completedAt: run.completedAt,
            }
          : null;
    if (run.terminalResultId !== null && terminal === null) {
      throw dependencyUnavailableError("Execution result is temporarily unavailable.");
    }
    return NextResponse.json(
      {
        runId: run.runId,
        mode: run.mode,
        status: terminal === null ? "queued" : "completed",
        attempt: { status: attempt.status },
        result: terminal,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const traceId = request.headers.get("x-trace-id") ?? "req_0000000000000000";
    return NextResponse.json(toErrorEnvelope(error, traceId), {
      status:
        error instanceof Error && "code" in error && error.code === "unauthenticated"
          ? 401
          : toHttpStatus(error),
      headers: { "Cache-Control": "no-store" },
    });
  }
}
