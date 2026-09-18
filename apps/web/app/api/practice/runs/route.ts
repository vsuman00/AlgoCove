import { NextResponse } from "next/server";
import {
  dependencyUnavailableError,
  requestPracticeCodeRun,
  toErrorEnvelope,
  toHttpStatus,
  validationError,
} from "@algocove/application";
import { parseId } from "@algocove/domain";
import { sha256Digest } from "@algocove/execution-contracts";
import { authenticatedWebRequestContext } from "../../../../src/auth/request-context";
import { getPracticeRuntime } from "../../../../src/practice/runtime";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const context = await authenticatedWebRequestContext(request);
    const input = await request.json();
    if (!isRecord(input)) throw validationError("Execution request must be an object.");
    const attemptId = parseId("attempt", input.attemptId);
    if (!attemptId.ok)
      throw validationError("Execution attempt is invalid.", { field: "attempt_id" });
    if (input.mode !== "run" && input.mode !== "submit") {
      throw validationError("Execution mode is invalid.", { field: "mode" });
    }
    if (typeof input.source !== "string") {
      throw validationError("Execution source must be text.", { field: "source" });
    }
    const runtime = getPracticeRuntime();
    if (runtime === null) throw dependencyUnavailableError("Practice persistence is unavailable.");
    if (runtime.executionRelay === null) {
      throw dependencyUnavailableError("Execution is temporarily unavailable.");
    }
    const result = await requestPracticeCodeRun(context, runtime.practice, runtime.executionRelay, {
      attemptId: attemptId.value,
      mode: input.mode,
      source: input.source,
      sourceChecksum: sha256Digest(input.source),
      sourceLength: Buffer.byteLength(input.source, "utf8"),
    });
    return NextResponse.json(
      { status: "queued", runId: result.run.runId, mode: result.run.mode },
      { status: 202, headers: { "Cache-Control": "no-store" } },
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
