import { NextResponse } from "next/server";
import {
  dependencyUnavailableError,
  getOwnedPracticeDraft,
  replacePracticeDraftCurrent,
  savePracticeDraftRevision,
  toErrorEnvelope,
  toHttpStatus,
  validationError,
} from "@algocove/application";
import { parseId } from "@algocove/domain";
import { authenticatedWebRequestContext } from "../../../../../src/auth/request-context";
import { getPracticeRuntime } from "../../../../../src/practice/runtime";

export const dynamic = "force-dynamic";

type RouteContext = { readonly params: Promise<{ readonly draftId: string }> };

export async function GET(request: Request, route: RouteContext): Promise<NextResponse> {
  try {
    const context = await authenticatedWebRequestContext(request);
    const draftId = await draftIdFrom(route);
    const runtime = getPracticeRuntime();
    if (runtime === null) throw dependencyUnavailableError("Practice persistence is unavailable.");
    const draft = await getOwnedPracticeDraft(context, runtime.drafts, draftId);
    return NextResponse.json({ draft }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function PUT(request: Request, route: RouteContext): Promise<NextResponse> {
  try {
    const context = await authenticatedWebRequestContext(request);
    const draftId = await draftIdFrom(route);
    const input = await request.json();
    if (
      !isRecord(input) ||
      typeof input.expectedVersion !== "number" ||
      !Number.isSafeInteger(input.expectedVersion)
    ) {
      throw validationError("expectedVersion is required.", { field: "expected_version" });
    }
    const expectedVersion = input.expectedVersion;
    const runtime = getPracticeRuntime();
    if (runtime === null) throw dependencyUnavailableError("Practice persistence is unavailable.");
    const result =
      input.saveRevision === true
        ? await savePracticeDraftRevision(context, runtime.drafts, {
            draftId,
            expectedVersion,
          })
        : typeof input.text === "string"
          ? await replacePracticeDraftCurrent(context, runtime.drafts, {
              draftId,
              expectedVersion,
              text: input.text,
            })
          : null;
    if (result === null) {
      throw validationError("Draft text is required unless saving the current revision.", {
        field: "text",
      });
    }
    return NextResponse.json({ draft: result.draft, state: result.state }, { status: 200 });
  } catch (error) {
    return errorResponse(request, error);
  }
}

async function draftIdFrom(route: RouteContext) {
  const params = await route.params;
  const draftId = parseId("draft", params.draftId);
  if (!draftId.ok) throw validationError("Draft identifier is invalid.", { field: "draft_id" });
  return draftId.value;
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
