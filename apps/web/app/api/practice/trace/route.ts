import { validatePilotTrace, pilotWalkthrough, validateWalkthrough } from "@algocove/visualizer";
import { learningError } from "../../../../src/mastery/learning-http";
import { NextResponse } from "next/server";
import {
  dependencyUnavailableError,
  notFoundError,
  revealAuthoredHint,
  validationError,
} from "@algocove/application";
import { parseId, PILOT_CATALOG, pilotIdentity } from "@algocove/domain";
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
    if (attempt === null) throw notFoundError("Reviewed trace is unavailable.");
    const pilot = PILOT_CATALOG.map((p) => pilotIdentity(p.slug)!).find(
      (p) => p.problemVersionId === attempt.problemVersionId,
    );
    let trace: unknown = CONTAINER_REFERENCE_TRACE;
    let walkthrough: unknown;
    if (pilot) {
      const result = await runtime.pool.query(
        `SELECT p.reference_trace FROM content.pilot_bundle p JOIN content.content_version v USING(content_version_id) WHERE p.problem_version_id=$1 AND v.status='published' AND v.payload_status='available' AND (v.rights_expires_at IS NULL OR v.rights_expires_at>now())`,
        [attempt.problemVersionId],
      );
      if (!result.rows[0]) throw notFoundError("Reviewed trace is unavailable.");
      trace = validatePilotTrace(result.rows[0].reference_trace);
      walkthrough = pilotWalkthrough(trace);
    } else if (attempt.problemVersionId !== "prb_dddddddddddddddd") {
      const released = (
        await runtime.pool.query(
          "SELECT r.walkthrough FROM content.learning_release r JOIN content.content_version v USING(content_version_id) WHERE r.problem_version_id=$1 AND v.status='published' AND v.payload_status='available' AND (v.rights_expires_at IS NULL OR v.rights_expires_at>now())",
          [attempt.problemVersionId],
        )
      ).rows[0];
      if (!released?.walkthrough) throw notFoundError("Reviewed trace is unavailable.");
      const synchronized = validateWalkthrough(released.walkthrough);
      trace = synchronized.trace;
      walkthrough = synchronized;
    }
    // The canonical scan reveals strategy: conservatively count scaffold-tier assistance.
    const hint =
      attempt.problemVersionId === "prb_dddddddddddddddd"
        ? { hint_id: "hint-arrays-4" }
        : (
            await runtime.pool.query(
              "SELECT hint_id FROM content.problem_hint WHERE problem_version_id=$1 AND tier=4",
              [attempt.problemVersionId],
            )
          ).rows[0];
    const receipt = await revealAuthoredHint(context, runtime.hints, {
      attemptId: id.value,
      hintId: hint?.hint_id ?? `${pilot?.hintPrefix ?? "hint-arrays"}-4`,
      requestedTier: 4,
      idempotencyKey: `reference-trace-${id.value}`,
    });
    return NextResponse.json(
      { trace, ...(walkthrough ? { walkthrough } : {}), exposure: receipt.exposure },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return learningError(request, error);
  }
}
