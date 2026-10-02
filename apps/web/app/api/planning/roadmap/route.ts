import type { NextResponse } from "next/server";
import {
  getOwnedRoadmap,
  buildOwnedRoadmap,
  commandOwnedRoadmap,
  dependencyUnavailableError,
  validationError,
  type PlanCommand,
} from "@algocove/application";
import { parseId } from "@algocove/domain";
import { authenticatedWebRequestContext } from "../../../../src/auth/request-context";
import { getRoadmapRepository } from "../../../../src/planning/runtime";
import {
  learningBody,
  learningResponse,
  learningError,
} from "../../../../src/mastery/learning-http";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const context = await authenticatedWebRequestContext(request),
      repository = getRoadmapRepository();
    if (!repository) throw dependencyUnavailableError("Planning persistence is unavailable.");
    return learningResponse(await getOwnedRoadmap(context, repository));
  } catch (error) {
    return learningError(request, error);
  }
}
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const context = await authenticatedWebRequestContext(request),
      body = await learningBody(request);
    if (
      typeof body.idempotencyKey !== "string" ||
      (body.expectedToken !== null && !parseId("event", body.expectedToken).ok)
    )
      throw validationError("A command key and expected active-version token are required.");
    const repository = getRoadmapRepository();
    if (!repository) throw dependencyUnavailableError("Planning persistence is unavailable.");
    if (body.action === "build") {
      if (body.scope !== "reviewed_pilot" && body.scope !== "full_dsa")
        throw validationError("Choose a supported scope.");
      // AI-off is the complete production path in Phase 7. Fixtures are injected only by tests.
      return learningResponse(
        await buildOwnedRoadmap(context, repository, {
          scope: body.scope,
          expectedToken: body.expectedToken as string | null,
          idempotencyKey: body.idempotencyKey,
        }),
      );
    }
    if (
      !["accept", "pause", "resume", "complete", "archive", "done", "missed", "reverse"].includes(
        String(body.action),
      )
    )
      throw validationError("Unsupported planning action.");
    if (body.action === "accept" && !parseId("event", body.candidateId).ok)
      throw validationError("A valid candidate identifier is required.");
    if (
      ["done", "missed", "reverse"].includes(String(body.action)) &&
      (typeof body.occurrenceId !== "string" || body.occurrenceId.length > 200)
    )
      throw validationError("A scheduled occurrence is required.");
    if (body.action === "reverse" && !parseId("event", body.reversesId).ok)
      throw validationError("A saved outcome identifier is required.");
    const command: PlanCommand = {
      action: body.action as PlanCommand["action"],
      expectedToken: body.expectedToken as string | null,
      idempotencyKey: body.idempotencyKey,
      ...(typeof body.candidateId === "string" ? { candidateId: body.candidateId } : {}),
      ...(typeof body.occurrenceId === "string" ? { occurrenceId: body.occurrenceId } : {}),
      ...(typeof body.reversesId === "string" ? { reversesId: body.reversesId } : {}),
    };
    return learningResponse(await commandOwnedRoadmap(context, repository, command));
  } catch (error) {
    return learningError(request, error);
  }
}
