import { NextResponse } from "next/server";
import {
  dependencyUnavailableError,
  revealAuthoredHint,
  toErrorEnvelope,
  toHttpStatus,
  validationError,
} from "@algocove/application";
import { parseId } from "@algocove/domain";
import { authenticatedWebRequestContext } from "../../../../src/auth/request-context";
import { getPracticeRuntime } from "../../../../src/practice/runtime";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const context = await authenticatedWebRequestContext(request);
    const input = await request.json();
    if (!isRecord(input)) throw validationError("Hint input must be an object.");
    const attemptId = parseId("attempt", input.attemptId);
    if (!attemptId.ok)
      throw validationError("Attempt identifier is invalid.", { field: "attempt_id" });
    if (typeof input.hintId !== "string" || input.hintId.length < 1 || input.hintId.length > 160) {
      throw validationError("Hint identifier is invalid.", { field: "hint_id" });
    }
    if (
      typeof input.requestedTier !== "number" ||
      !Number.isSafeInteger(input.requestedTier) ||
      input.requestedTier < 1
    ) {
      throw validationError("Hint tier is invalid.", { field: "requested_tier" });
    }
    if (
      typeof input.idempotencyKey !== "string" ||
      input.idempotencyKey.length < 8 ||
      input.idempotencyKey.length > 160
    ) {
      throw validationError("Hint idempotency key is invalid.", { field: "idempotency_key" });
    }
    const runtime = getPracticeRuntime();
    if (runtime === null) throw dependencyUnavailableError("Practice persistence is unavailable.");
    const receipt = await revealAuthoredHint(context, runtime.hints, {
      attemptId: attemptId.value,
      hintId: input.hintId,
      requestedTier: input.requestedTier,
      idempotencyKey: input.idempotencyKey,
    });
    return NextResponse.json(
      {
        disposition: receipt.disposition,
        exposure: receipt.exposure,
        hint: receipt.hint,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(request, error);
  }
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
