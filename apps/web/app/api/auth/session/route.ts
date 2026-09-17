import { NextResponse } from "next/server";
import { sessionTokenFromRequest } from "../../../../src/auth/cookies";
import { getLocalIdentityAdapter } from "../../../../src/auth/local-adapter";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const token = sessionTokenFromRequest(request);
  try {
    const actor = await getLocalIdentityAdapter().authenticate(token);
    return NextResponse.json(
      { authenticated: true, user: { id: actor.userId, roles: actor.roles } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { authenticated: false, error: { code: "unauthenticated" } },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
}
