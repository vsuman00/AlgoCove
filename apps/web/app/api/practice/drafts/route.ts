import { NextResponse } from "next/server";
import {
  dependencyUnavailableError,
  startPracticeDraft,
  toErrorEnvelope,
  toHttpStatus,
  validationError,
} from "@algocove/application";
import { DRAFT_KINDS, parseId, type DraftKind } from "@algocove/domain";
import { authenticatedWebRequestContext } from "../../../../src/auth/request-context";
import { getPracticeRuntime } from "../../../../src/practice/runtime";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const context = await authenticatedWebRequestContext(request);
    const input = await request.json();
    if (!isRecord(input)) throw invalidRequest("Draft input must be an object.");

    const draftId = parseId("draft", input.draftId);
    const attemptId = parseId("attempt", input.attemptId);
    if (!draftId.ok || !attemptId.ok) {
      throw invalidRequest("Draft and attempt identifiers are required.");
    }
    if (!DRAFT_KINDS.includes(input.kind as DraftKind)) {
      throw invalidRequest("Draft kind is not supported.");
    }

    const runtime = getPracticeRuntime();
    if (runtime === null) throw dependencyUnavailableError("Practice persistence is unavailable.");
    const draft = await startPracticeDraft(context, runtime.drafts, {
      draftId: draftId.value,
      attemptId: attemptId.value,
      kind: input.kind as DraftKind,
      ...(typeof input.localRecoveryEnabled === "boolean"
        ? { localRecoveryEnabled: input.localRecoveryEnabled }
        : {}),
    });
    return NextResponse.json({ draft }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(request, error);
  }
}

function invalidRequest(message: string): ReturnType<typeof validationError> {
  return validationError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorResponse(request: Request, error: unknown): NextResponse {
  const traceId = request.headers.get("x-trace-id") ?? "req_0000000000000000";
  return NextResponse.json(toErrorEnvelope(error, traceId), {
    status:
      error instanceof Error && "code" in error && error.code === "unauthenticated"
        ? 401
        : toHttpStatus(error),
    headers: { "Cache-Control": "no-store" },
  });
}
