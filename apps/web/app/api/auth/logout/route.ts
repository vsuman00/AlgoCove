import { NextResponse } from "next/server";
import { clearSessionCookie, sessionTokenFromRequest } from "../../../../src/auth/cookies";
import { getLocalIdentityAdapter } from "../../../../src/auth/local-adapter";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const token = sessionTokenFromRequest(request);
  await getLocalIdentityAdapter().logout(token);
  const response = NextResponse.json(
    { authenticated: false },
    { headers: { "Cache-Control": "no-store" } },
  );
  clearSessionCookie(response);
  return response;
}
