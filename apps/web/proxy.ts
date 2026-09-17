import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
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

export default middleware;

export const config = {
  matcher: ["/(api|trpc)(.*)", "/__clerk/(.*)"],
};
