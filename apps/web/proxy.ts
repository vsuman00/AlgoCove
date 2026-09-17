import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Clerk is enabled when both keys are configured. Keeping the no-key branch
 * explicit makes public liveness and local CI boot without pretending a user is
 * authenticated; protected handlers still call `auth()` at their boundary.
 */
const middleware =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== undefined &&
  process.env.CLERK_SECRET_KEY !== undefined
    ? clerkMiddleware()
    : () => NextResponse.next();

export default middleware;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
