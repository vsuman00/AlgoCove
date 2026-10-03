import { learningError } from "../../../../src/mastery/learning-http";
import { NextResponse } from "next/server";
import {
  dependencyUnavailableError,
  notFoundError,
  revealAuthoredHint,
  validationError,
} from "@algocove/application";
import { parseId } from "@algocove/domain";
import { authenticatedWebRequestContext } from "../../../../src/auth/request-context";
import { getPracticeRuntime } from "../../../../src/practice/runtime";
import { CONTAINER_REFERENCE_TRACE } from "../../../../src/practice/container-trace";

export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const context = await authenticatedWebRequestContext(request);
    const input = (await request.json()) as { attemptId?: unknown };
    const id = parseId("attempt", input?.attemptId);
    if (!id.ok) throw validationError("Attempt identifier is invalid.");
    const runtime = getPracticeRuntime();
    if (runtime === null) throw dependencyUnavailableError("Practice persistence is unavailable.");
    const attempt = await runtime.practice.getAttempt(id.value, context.actor.userId);
    if (attempt === null || attempt.problemVersionId !== "prb_dddddddddddddddd")
      throw notFoundError("Reviewed trace is unavailable.");
    // The canonical scan reveals strategy: conservatively count scaffold-tier assistance.
    const receipt = await revealAuthoredHint(context, runtime.hints, {
      attemptId: id.value,
      hintId: "hint-arrays-4",
      requestedTier: 4,
      idempotencyKey: `reference-trace-${id.value}`,
    });
    return NextResponse.json(
      { trace: CONTAINER_REFERENCE_TRACE, exposure: receipt.exposure },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return learningError(request, error);
  }
}
