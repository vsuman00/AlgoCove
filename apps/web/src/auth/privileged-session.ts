import { authorizationError } from "@algocove/application";
import { isPrivilegedRole, type Role } from "@algocove/domain";

/** Signed Clerk factor ages, never request headers or profile metadata. */
export function requireHostedPrivilegedSession(
  roles: readonly Role[],
  factorVerificationAge: unknown,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): void {
  const hosted =
    environment.VERCEL === "1" ||
    environment.DEPLOYMENT_ENVIRONMENT === "staging" ||
    environment.DEPLOYMENT_ENVIRONMENT === "production";
  if (!hosted || !roles.some(isPrivilegedRole)) return;
  if (
    !Array.isArray(factorVerificationAge) ||
    factorVerificationAge.length !== 2 ||
    !factorVerificationAge.every(
      (age: unknown) => typeof age === "number" && Number.isFinite(age) && age >= 0 && age < 5,
    )
  ) {
    throw authorizationError(
      "Privileged access requires both sign-in factors verified within five minutes. Enable MFA and sign in again.",
    );
  }
}
