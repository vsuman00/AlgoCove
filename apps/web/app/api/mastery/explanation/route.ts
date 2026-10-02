import type { NextResponse } from "next/server";
import {
  observeOwnedExplanation,
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
    const id = parseId("pseudocode", input.pseudocodeId);
    if (!id.ok || typeof input.revision !== "number")
      throw validationError("A saved pseudocode revision is required.");
    const runtime = getLearningRuntime();
    if (runtime === null) throw dependencyUnavailableError("Learning persistence is unavailable.");
    return learningResponse(
      await observeOwnedExplanation(ctx, runtime.reviews, runtime.ingestion, {
        pseudocodeId: id.value,
        revision: input.revision,
        confidence: input.confidence ?? null,
      }),
    );
  } catch (e) {
    return learningError(request, e);
  }
}
