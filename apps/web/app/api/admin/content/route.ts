import type { NextResponse } from "next/server";
import { authenticatedWebRequestContext } from "../../../../src/auth/request-context";
import { readContent, commandContent } from "../../../../src/content/operations";
import {
  learningBody,
  learningResponse,
  learningError,
} from "../../../../src/mastery/learning-http";
import { validationError } from "@algocove/application";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<NextResponse> {
  try {
    return learningResponse(
      await readContent(
        await authenticatedWebRequestContext(request),
        new URL(request.url).searchParams.get("id") ?? undefined,
      ),
    );
  } catch (error) {
    return learningError(request, error);
  }
}
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const ctx = await authenticatedWebRequestContext(request);
    if (request.body === null) throw validationError("A content command is required.");
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 163_840) {
          await reader.cancel();
          throw validationError("Content command exceeds the bounded size.");
        }
        chunks.push(chunk.value);
      }
    } finally {
      reader.releaseLock();
    }
    const text = Buffer.concat(chunks).toString("utf8");
    return learningResponse(
      await commandContent(
        ctx,
        await learningBody(
          new Request(request.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: text,
          }),
        ),
      ),
    );
  } catch (error) {
    return learningError(request, error);
  }
}
