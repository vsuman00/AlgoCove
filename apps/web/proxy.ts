import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { isClerkConfigured } from "./src/auth/clerk-config";

/**
 * Clerk is enabled when both keys are configured. Keeping the no-key branch
 * explicit makes public liveness and local CI boot without pretending a user is
 * authenticated; protected handlers still call `auth()` at their boundary.
 */
const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const middleware = isClerkConfigured()
  ? clerkMiddleware({ publishableKey })
  : () => NextResponse.next();

export default function proxy(
  request: NextRequest,
  event: NextFetchEvent,
): Response | Promise<Response> {
  if (request.nextUrl.pathname === "/api/health") {
    return NextResponse.next();
  }

  return middleware(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
