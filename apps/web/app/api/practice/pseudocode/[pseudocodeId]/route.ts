import { NextResponse } from "next/server";
import {
  dependencyUnavailableError,
  getOwnedPseudocode,
  replaceOwnedPseudocodeCurrent,
  saveOwnedPseudocodeRevision,
  toErrorEnvelope,
  toHttpStatus,
  validationError,
} from "@algocove/application";
import { PSEUDOCODE_FIELDS, parseId, type PseudocodeFields } from "@algocove/domain";
import { authenticatedWebRequestContext } from "../../../../../src/auth/request-context";
import { getPracticeRuntime } from "../../../../../src/practice/runtime";

export const dynamic = "force-dynamic";

type RouteContext = {
  readonly params: Promise<{ readonly pseudocodeId: string }>;
};

export async function GET(request: Request, route: RouteContext): Promise<NextResponse> {
  try {
    const context = await authenticatedWebRequestContext(request);
    const pseudocodeId = await idFrom(route);
    const runtime = getPracticeRuntime();
    if (runtime === null) throw dependencyUnavailableError("Practice persistence is unavailable.");
    const artifact = await getOwnedPseudocode(context, runtime.pseudocode, pseudocodeId);
    return NextResponse.json({ artifact }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function PUT(request: Request, route: RouteContext): Promise<NextResponse> {
  try {
    const context = await authenticatedWebRequestContext(request);
    const pseudocodeId = await idFrom(route);
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
        ? await saveOwnedPseudocodeRevision(context, runtime.pseudocode, {
            pseudocodeId,
            expectedVersion,
          })
        : isRecord(input.fields)
          ? await replaceOwnedPseudocodeCurrent(context, runtime.pseudocode, {
              pseudocodeId,
              expectedVersion,
              fields: parseFields(input.fields),
            })
          : null;
    if (result === null) {
      throw validationError("Pseudocode fields are required unless saving the current revision.", {
        field: "fields",
      });
    }
    return NextResponse.json({ artifact: result.artifact, state: result.state });
  } catch (error) {
    return errorResponse(request, error);
  }
}

async function idFrom(route: RouteContext) {
  const params = await route.params;
  const pseudocodeId = parseId("pseudocode", params.pseudocodeId);
  if (!pseudocodeId.ok) {
    throw validationError("Pseudocode identifier is invalid.", { field: "pseudocode_id" });
  }
  return pseudocodeId.value;
}

function parseFields(value: Record<string, unknown>): PseudocodeFields {
  const fields = {} as Record<(typeof PSEUDOCODE_FIELDS)[number], string>;
  for (const field of PSEUDOCODE_FIELDS) {
    if (typeof value[field] !== "string") {
      throw validationError(`Pseudocode field ${field} is required.`, { field });
    }
    fields[field] = value[field];
  }
  return fields;
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
