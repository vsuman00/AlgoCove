import { NextResponse } from "next/server";
import { getClerkIdentityAdapter } from "../../../../src/auth/clerk-adapter";
import { auth } from "../../../../src/auth/clerk-server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const clerkAuth = await auth();
    const actor = await getClerkIdentityAdapter().authenticate({
      isAuthenticated: clerkAuth.isAuthenticated,
      userId: clerkAuth.userId,
      sessionId: clerkAuth.sessionId,
    });
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
