import type { NextResponse } from "next/server";
import {
  recordOwnedExternalPractice,
  validationError,
  dependencyUnavailableError,
} from "@algocove/application";
import { parseId } from "@algocove/domain";
import { authenticatedWebRequestContext } from "../../../../src/auth/request-context";
import { getLearningRuntime } from "../../../../src/mastery/learning-runtime";
import {
  learningResponse,
  learningError,
  learningBody,
} from "../../../../src/mastery/learning-http";
export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const ctx = await authenticatedWebRequestContext(request);
    const input = await learningBody(request);
    const reference = parseId("externalReference", input.referenceId);
    if (
      !reference.ok ||
      typeof input.idempotencyKey !== "string" ||
      !["handoff_requested", "completed", "corrected"].includes(String(input.kind))
    )
      throw validationError("An eligible reference and journal action are required.");
    const runtime = getLearningRuntime();
    if (runtime === null) throw dependencyUnavailableError("Learning persistence is unavailable.");
    await recordOwnedExternalPractice(ctx, runtime.progress, {
      referenceId: reference.value,
      kind: input.kind as "handoff_requested" | "completed" | "corrected",
      idempotencyKey: input.idempotencyKey,
    });
    return learningResponse({ status: "recorded", provenance: "learner_reported" });
  } catch (e) {
    return learningError(request, e);
  }
}
