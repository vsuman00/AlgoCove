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
  return (
    typeof environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY === "string" &&
    environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.trim().length > 0 &&
    typeof environment.CLERK_SECRET_KEY === "string" &&
    environment.CLERK_SECRET_KEY.trim().length > 0
  );
}
