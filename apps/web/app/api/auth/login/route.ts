import { NextResponse } from "next/server";
import { setSessionCookie } from "../../../../src/auth/cookies";
import { getLocalIdentityAdapter } from "../../../../src/auth/local-adapter";

export const dynamic = "force-dynamic";

type LoginBody = { readonly principal?: unknown };

export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.LOCAL_IDENTITY_ENABLED === "false") {
    return NextResponse.json({ error: { code: "identity_disabled" } }, { status: 503 });
  }

  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: { code: "invalid_request" } }, { status: 400 });
  }

  try {
    const result = await getLocalIdentityAdapter().login(body.principal);
    const response = NextResponse.json(
      { authenticated: true, user: { id: result.actor.userId, roles: result.actor.roles } },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
    setSessionCookie(response, result.token);
    return response;
  } catch {
    return NextResponse.json({ error: { code: "authentication_failed" } }, { status: 401 });
  }
}
