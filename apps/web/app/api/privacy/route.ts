import { observeRequest } from "../../../src/operations/telemetry";
import { NextResponse } from "next/server";
import {
  authenticationRequired,
  dependencyUnavailableError,
  exportPrivateData,
  requestPrivateDeletion,
  LOCAL_PRIVACY_POLICY,
  validationError,
} from "@algocove/application";
import { PostgresPrivacyRepository } from "@algocove/db";
import { authenticatedWebRequestContext } from "../../../src/auth/request-context";
import { auth, reverificationErrorResponse } from "../../../src/auth/clerk-server";
import { isClerkConfigured } from "../../../src/auth/clerk-config";
import { getPracticeRuntime } from "../../../src/practice/runtime";
import {
  boundedLearningBody,
  learningError,
  learningResponse,
} from "../../../src/mastery/learning-http";
export const dynamic = "force-dynamic";
const verification = {
  level: "first_factor",
  afterMinutes: LOCAL_PRIVACY_POLICY.reauthenticationMinutes,
} as const;
function repository(): PostgresPrivacyRepository {
  const runtime = getPracticeRuntime();
  if (!runtime) throw dependencyUnavailableError("Privacy persistence is unavailable.");
  return new PostgresPrivacyRepository(runtime.pool);
}
export async function GET(request: Request): Promise<Response> {
  try {
    if (!isClerkConfigured()) throw authenticationRequired();
    const session = await auth();
    if (!session.isAuthenticated || !session.userId) throw authenticationRequired();
    return learningResponse(await repository().statusForVerifiedSubject(`clerk:${session.userId}`));
  } catch (error) {
    return learningError(request, error);
  }
}
async function handlePOST(request: Request): Promise<Response> {
  try {
    // Same-origin commands cannot be submitted by an unrelated site.
    const origin = request.headers.get("origin");
    if (origin !== new URL(request.url).origin)
      throw validationError("A same-origin privacy request is required.");
    if (!isClerkConfigured()) throw authenticationRequired();
    const session = await auth();
    if (!session.isAuthenticated) throw authenticationRequired();
    if (!session.has({ reverification: verification })) {
      const response = reverificationErrorResponse(verification);
      response.headers.set("Cache-Control", "no-store");
      return response;
    }
    const context = await authenticatedWebRequestContext(request);
    const body = await boundedLearningBody(request);
    if (body.action === "export") {
      const data = await exportPrivateData(context, repository(), { recentlyVerified: true });
      return NextResponse.json(data, {
        headers: {
          "Cache-Control": "no-store",
          "Content-Disposition": "attachment; filename=algocove-private-data.json",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (body.action === "delete")
      return learningResponse(
        await requestPrivateDeletion(
          context,
          repository(),
          { recentlyVerified: true },
          body.confirmation,
        ),
      );
    throw validationError("Choose export or delete.");
  } catch (error) {
    return learningError(request, error);
  }
}

export async function POST(request: Request): Promise<Response> {
  return observeRequest(request, "privacy", () => handlePOST(request));
}
