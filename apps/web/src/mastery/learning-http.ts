import { webTraceId } from "../auth/request-context";
import { NextResponse } from "next/server";
import { toErrorEnvelope, toHttpStatus, validationError } from "@algocove/application";
export function learningError(request: Request, error: unknown): NextResponse {
  const status =
    error instanceof Error && "code" in error && error.code === "unauthenticated"
      ? 401
      : toHttpStatus(error);
  const envelope = toErrorEnvelope(error, webTraceId(request));
  if (status >= 500)
    process.stderr.write(
      "[api] " +
        JSON.stringify({
          event: "request_failed",
          status,
          traceId: envelope.error.traceId,
          category: envelope.error.category,
          code: envelope.error.code,
          retryable: envelope.error.retryable,
        }) +
        "\n",
    );
  return NextResponse.json(envelope, { status, headers: { "Cache-Control": "no-store" } });
}
export function learningResponse(body: unknown): NextResponse {
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
export async function learningBody(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw validationError("Valid JSON is required.");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body))
    throw validationError("An object body is required.");
  return body as Record<string, unknown>;
}
