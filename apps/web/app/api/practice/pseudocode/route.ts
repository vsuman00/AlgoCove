import { NextResponse } from "next/server";
import {
  dependencyUnavailableError,
  startOwnedPseudocode,
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
    if (!isRecord(input)) throw validationError("Pseudocode input must be an object.");
    const pseudocodeId = parseId("pseudocode", input.pseudocodeId);
    const attemptId = parseId("attempt", input.attemptId);
    if (!pseudocodeId.ok || !attemptId.ok) {
      throw validationError("Pseudocode and attempt identifiers are required.");
    }
    const runtime = getPracticeRuntime();
    if (runtime === null) throw dependencyUnavailableError("Practice persistence is unavailable.");
    const artifact = await startOwnedPseudocode(context, runtime.pseudocode, {
      pseudocodeId: pseudocodeId.value,
      attemptId: attemptId.value,
    });
    return NextResponse.json(
      { artifact },
      { status: 201, headers: { "Cache-Control": "no-store" } },
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
