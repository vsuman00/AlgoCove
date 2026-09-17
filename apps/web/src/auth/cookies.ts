import { LOCAL_SESSION_COOKIE } from "./local-adapter";

export function sessionTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${LOCAL_SESSION_COOKIE}=([^;]+)`));
  return match?.[1] ?? null;
}

export function setSessionCookie(response: Response, token: string): void {
  response.headers.append(
    "Set-Cookie",
    `${LOCAL_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800`,
  );
}

export function clearSessionCookie(response: Response): void {
  response.headers.append(
    "Set-Cookie",
    `${LOCAL_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
}
