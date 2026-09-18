import { NextResponse } from "next/server";
import {
  getLearnerProfile,
  saveLearnerProfile,
  toErrorEnvelope,
  toHttpStatus,
} from "@algocove/application";
import { getClerkIdentityStore } from "../../../src/auth/clerk-adapter";
import { authenticatedWebRequestContext } from "../../../src/auth/request-context";

export const dynamic = "force-dynamic";

async function contextFor(request: Request) {
  return authenticatedWebRequestContext(request);
}

function errorResponse(error: unknown): NextResponse {
  const traceId = "req_0000000000000000";
  const status =
    error instanceof Error && "code" in error && error.code === "unauthenticated"
      ? 401
      : toHttpStatus(error);
  return NextResponse.json(toErrorEnvelope(error, traceId), {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const context = await contextFor(request);
    const profile = await getLearnerProfile(context, getClerkIdentityStore());
    return NextResponse.json({ profile }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
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
    return errorResponse(error);
  }
}
