import { webTraceId } from "../../../../src/auth/request-context";
import { NextResponse } from "next/server";
import {
  dependencyUnavailableError,
  getOwnedMasteryView,
  toErrorEnvelope,
  toHttpStatus,
  validationError,
} from "@algocove/application";
import { parseId } from "@algocove/domain";
import { authenticatedWebRequestContext } from "../../../../src/auth/request-context";
import { getMasteryRepository } from "../../../../src/mastery/runtime";

export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { readonly params: Promise<{ readonly conceptId: string }> },
): Promise<NextResponse> {
  try {
    const context = await authenticatedWebRequestContext(request);
    const concept = parseId("concept", (await params).conceptId);
    const raw = new URL(request.url).searchParams.get("afterObservation");
    const after = raw === null ? null : parseId("event", raw);
    if (!concept.ok || (after !== null && !after.ok))
      throw validationError("Invalid mastery query identifier.");
    const repository = getMasteryRepository();
    if (repository === null)
      throw dependencyUnavailableError("Mastery persistence is unavailable.");
    const view = await getOwnedMasteryView(context, repository, {
      conceptId: concept.value,
      ...(after?.ok ? { afterObservationId: after.value } : {}),
    });
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(toErrorEnvelope(error, webTraceId(request)), {
      status:
        error instanceof Error && "code" in error && error.code === "unauthenticated"
          ? 401
          : toHttpStatus(error),
      headers: { "Cache-Control": "no-store" },
    });
  }
}
