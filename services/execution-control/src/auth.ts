import { timingSafeEqual } from "node:crypto";
import { err, ok, type Result } from "@algocove/domain";
import { controlFailure, type ControlFailure, type InternalPrincipal } from "./types.ts";

export type InternalAuthenticator = {
  readonly authenticate: (principal: InternalPrincipal, token: string) => boolean;
};

const REQUIRED_PRINCIPALS: readonly InternalPrincipal[] = [
  "application-relay",
  "execution-worker",
  "execution-operator",
];

function constantTimeEquals(left: string, right: string): boolean {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function createInternalAuthenticator(
  secrets: Readonly<Record<InternalPrincipal, string>>,
): InternalAuthenticator {
  for (const principal of REQUIRED_PRINCIPALS) {
    const secret = secrets[principal];
    if (typeof secret !== "string") {
      throw new Error(`Internal secret for ${principal} is required.`);
    }
    if (secret.trim().length < 16) {
      throw new Error(`Internal secret for ${principal} must contain at least 16 characters.`);
    }
  }
  return {
    authenticate(principal, token): boolean {
      const expected = secrets[principal];
      return typeof expected === "string" && constantTimeEquals(expected, token);
    },
  };
}

export function requireInternalAuthentication(
  authenticator: InternalAuthenticator,
  principal: InternalPrincipal,
  token: string,
): Result<undefined, ControlFailure> {
  return authenticator.authenticate(principal, token)
    ? ok(undefined)
    : err(
        controlFailure("internal_auth_failed", "Internal execution-control authentication failed."),
      );
}
