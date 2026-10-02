import type { NextResponse } from "next/server";
import {
  listOwnedReviews,
  answerOwnedReview,
  deferOwnedReview,
  validationError,
  dependencyUnavailableError,
} from "@algocove/application";
import { parseId, parseInstant } from "@algocove/domain";
import { authenticatedWebRequestContext } from "../../../src/auth/request-context";
import { getLearningRuntime } from "../../../src/mastery/learning-runtime";
import { learningResponse, learningError, learningBody } from "../../../src/mastery/learning-http";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const ctx = await authenticatedWebRequestContext(request);
    const runtime = getLearningRuntime();
    if (runtime === null) throw dependencyUnavailableError("Learning persistence is unavailable.");
    return learningResponse({
      reviews: await listOwnedReviews(ctx, runtime.reviews),
      asOf: ctx.now,
      policyVersion: 1,
    });
  } catch (e) {
    return learningError(request, e);
  }
}
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const ctx = await authenticatedWebRequestContext(request);
    const input = await learningBody(request);
    const review = parseId("event", input.reviewId);
    if (!review.ok) throw validationError("Invalid review identifier.");
    const runtime = getLearningRuntime();
    if (runtime === null) throw dependencyUnavailableError("Learning persistence is unavailable.");
    if (input.action === "defer") {
      const until = parseInstant(input.until);
      if (!until.ok) throw validationError("Invalid defer date.");
      await deferOwnedReview(ctx, runtime.reviews, { reviewId: review.value, until: until.value });
      return learningResponse({ status: "deferred" });
    }
    if (
      input.action !== "answer" ||
      typeof input.exerciseId !== "string" ||
      typeof input.answers !== "object" ||
      input.answers === null ||
      Array.isArray(input.answers)
    )
      throw validationError("Review answers are required.");
    return learningResponse(
      await answerOwnedReview(ctx, runtime.reviews, runtime.ingestion, {
        reviewId: review.value,
        exerciseId: input.exerciseId,
        answers: input.answers as Record<string, string>,
        confidence: input.confidence ?? null,
      }),
    );
  } catch (e) {
    return learningError(request, e);
  }
}
