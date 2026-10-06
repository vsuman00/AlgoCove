import type { NextResponse } from "next/server";
import {
  dependencyUnavailableError,
  getOwnedExternalPreparation,
  gradeOwnedExternalPreparation,
  requestOwnedExternalPractice,
  validationError,
} from "@algocove/application";
import { parseId } from "@algocove/domain";
import { authenticatedWebRequestContext } from "../../../../src/auth/request-context";
import { getPracticeRuntime } from "../../../../src/practice/runtime";
import {
  boundedLearningBody,
  learningError,
  learningResponse,
} from "../../../../src/mastery/learning-http";
export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const context = await authenticatedWebRequestContext(request),
      body = await boundedLearningBody(request);
    const id = parseId("attempt", body.attemptId);
    if (
      !id.ok ||
      Object.keys(body).some(
        (k) => !["attemptId", "action", "answers", "idempotencyKey"].includes(k),
      )
    )
      throw validationError("An owned attempt and preparation action are required.");
    const runtime = getPracticeRuntime();
    if (!runtime) throw dependencyUnavailableError("Learning persistence is unavailable.");
    if (body.action === "view")
      return learningResponse(
        await getOwnedExternalPreparation(context, runtime.companion, id.value),
      );
    if (body.action === "grade") {
      if (typeof body.answers !== "object" || body.answers === null || Array.isArray(body.answers))
        throw validationError("Select offered preparation answers.");
      return learningResponse(
        await gradeOwnedExternalPreparation(context, runtime.companion, {
          attemptId: id.value,
          answers: body.answers as Record<string, string>,
        }),
      );
    }
    if (
      !["open", "completed", "corrected"].includes(String(body.action)) ||
      typeof body.idempotencyKey !== "string"
    )
      throw validationError("Choose an external journal action with an idempotency key.");
    return learningResponse(
      await requestOwnedExternalPractice(context, runtime.companion, {
        attemptId: id.value,
        action: body.action as "open" | "completed" | "corrected",
        idempotencyKey: body.idempotencyKey,
      }),
    );
  } catch (error) {
    return learningError(request, error);
  }
}
