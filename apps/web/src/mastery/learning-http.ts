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

export async function boundedLearningBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.body) throw validationError("An object body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 65536) {
        await reader.cancel();
        throw validationError("Request exceeds the bounded size.");
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  return learningBody(
    new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: Buffer.concat(chunks).toString("utf8"),
    }),
  );
}
