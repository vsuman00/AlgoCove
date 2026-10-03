import { learningError as errorResponse } from "../../../src/mastery/learning-http";
import { NextResponse } from "next/server";
import { getLearnerProfile, saveLearnerProfile } from "@algocove/application";
import { getClerkIdentityStore } from "../../../src/auth/clerk-adapter";
import { authenticatedWebRequestContext } from "../../../src/auth/request-context";

export const dynamic = "force-dynamic";

async function contextFor(request: Request) {
  return authenticatedWebRequestContext(request);
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const context = await contextFor(request);
    const profile = await getLearnerProfile(context, getClerkIdentityStore());
    return NextResponse.json({ profile }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const context = await contextFor(request);
    const input: unknown = await request.json();
    const profile = await saveLearnerProfile(context, getClerkIdentityStore(), input);
    return NextResponse.json(
      { profile },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(request, error);
  }
}
