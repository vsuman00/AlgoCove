import { NextResponse } from "next/server";
import { dependencyUnavailableError, validationError } from "@algocove/application";
import { parseId } from "@algocove/domain";
import { parseTutorInput } from "@algocove/tutor";
import { authenticatedWebRequestContext } from "../../../src/auth/request-context";
import { learningError } from "../../../src/mastery/learning-http";
import { getTutorRuntime } from "../../../src/tutor/runtime";
export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const ctx = await authenticatedWebRequestContext(request),
      runtime = getTutorRuntime();
    if (!runtime) throw dependencyUnavailableError("Tutor persistence is unavailable.");
    const raw = await request.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw validationError("Tutor operation is invalid.");
    if (raw.action === "start" && Object.keys(raw).length === 2) {
      const result = await runtime.repository.start(ctx, parseTutorInput(raw.input));
      return NextResponse.json(result, {
        status: result.status === "pending" ? 202 : 200,
        headers: { "Cache-Control": "no-store" },
      });
    }
    const id = parseId("event", raw.requestId);
    if (!id.ok || Object.keys(raw).length !== 2 || !["complete", "cancel"].includes(raw.action))
      throw validationError("Tutor operation is invalid.");
    const result =
      raw.action === "cancel"
        ? await runtime.repository.cancel(ctx, id.value)
        : await runtime.service.complete(ctx, id.value, request.signal);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return learningError(request, error);
  }
}
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const ctx = await authenticatedWebRequestContext(request),
      id = parseId("event", new URL(request.url).searchParams.get("requestId"));
    if (!id.ok) throw validationError("Tutor request is invalid.");
    const runtime = getTutorRuntime();
    if (!runtime) throw dependencyUnavailableError("Tutor persistence is unavailable.");
    return NextResponse.json(await runtime.repository.read(ctx, id.value), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return learningError(request, error);
  }
}
