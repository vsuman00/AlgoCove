/**
 * Clerk is usable only when both halves of the server/client configuration are
 * present. Empty values are treated as unset so copying `.env.example` keeps
 * the local shell usable without making the SDK initialize with an invalid key.
 */
export function isClerkConfigured(
  environment: Readonly<{
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string | undefined;
    CLERK_SECRET_KEY?: string | undefined;
  }> = {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  },
): boolean {
  const hasPublishableKey =
    typeof environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY === "string" &&
    environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.trim().length > 0;

  // CLERK_SECRET_KEY is server-only (not prefixed with NEXT_PUBLIC_), so it's
  // never available in the browser.  Only check it on the server to avoid
  // hydration mismatches caused by different return values on server vs client.
  const isServer = typeof window === "undefined";
  if (isServer) {
    return (
      hasPublishableKey &&
      typeof environment.CLERK_SECRET_KEY === "string" &&
      environment.CLERK_SECRET_KEY.trim().length > 0
    );
  }

  return hasPublishableKey;
}
