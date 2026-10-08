import { PostgresPrivacyOperationsRepository } from "@algocove/db";
import {
  authenticationRequired,
  dependencyUnavailableError,
  validationError,
} from "@algocove/application";
import { auth, reverificationErrorResponse } from "../../../../src/auth/clerk-server";
import { isClerkConfigured } from "../../../../src/auth/clerk-config";
import { authenticatedWebRequestContext } from "../../../../src/auth/request-context";
import { getPracticeRuntime } from "../../../../src/practice/runtime";
import {
  boundedLearningBody,
  learningError,
  learningResponse,
} from "../../../../src/mastery/learning-http";
export async function POST(request: Request): Promise<Response> {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin)
      throw validationError("Same-origin request required.");
    if (!isClerkConfigured()) throw authenticationRequired();
    const session = await auth();
    if (!session.isAuthenticated) throw authenticationRequired();
    const verification = { level: "first_factor", afterMinutes: 5 } as const;
    if (!session.has({ reverification: verification }))
      return reverificationErrorResponse(verification);
    const ctx = await authenticatedWebRequestContext(request),
      body = await boundedLearningBody(request),
      runtime = getPracticeRuntime();
    if (!runtime) throw dependencyUnavailableError("Privacy persistence unavailable.");
    if (!["hold", "release_hold"].includes(body.action as string))
      throw validationError("Invalid privacy administration action.");
    await new PostgresPrivacyOperationsRepository(runtime.pool).hold(ctx, {
      learnerId: body.learnerId,
      reason: body.reason,
      expiresAt: body.expiresAt,
      release: body.action === "release_hold",
    });
    return learningResponse({ applied: true });
  } catch (error) {
    return learningError(request, error);
  }
}
