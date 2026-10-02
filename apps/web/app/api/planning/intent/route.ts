import type { NextResponse } from "next/server";
import {
  getOwnedPlanningContext,
  saveOwnedRoadmapIntent,
  dependencyUnavailableError,
  validationError,
} from "@algocove/application";
import { parseId, type OpaqueId } from "@algocove/domain";
import { authenticatedWebRequestContext } from "../../../../src/auth/request-context";
import { getRoadmapIntentRepository } from "../../../../src/planning/runtime";
import {
  learningBody,
  learningResponse,
  learningError,
} from "../../../../src/mastery/learning-http";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const context = await authenticatedWebRequestContext(request);
    const repository = getRoadmapIntentRepository();
    if (repository === null)
      throw dependencyUnavailableError("Planning persistence is unavailable.");
    return learningResponse({
      ...(await getOwnedPlanningContext(context, repository)),
      asOf: context.now,
    });
  } catch (error) {
    return learningError(request, error);
  }
}
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const context = await authenticatedWebRequestContext(request),
      body = await learningBody(request);
    let planId: OpaqueId<"roadmapPlan"> | null = null;
    if (body.planId !== null) {
      const parsed = parseId("roadmapPlan", body.planId);
      if (!parsed.ok) throw validationError("A valid plan identifier or null is required.");
      planId = parsed.value;
    }
    if (
      typeof body.idempotencyKey !== "string" ||
      (body.expectedVersion !== null && typeof body.expectedVersion !== "number")
    )
      throw validationError("A save key and expected version are required.");
    const repository = getRoadmapIntentRepository();
    if (repository === null)
      throw dependencyUnavailableError("Planning persistence is unavailable.");
    return learningResponse(
      await saveOwnedRoadmapIntent(context, repository, {
        planId,
        expectedVersion: body.expectedVersion as number | null,
        idempotencyKey: body.idempotencyKey,
        preferences: body.preferences,
      }),
    );
  } catch (error) {
    return learningError(request, error);
  }
}
