import { authorizationError, validationError } from "./errors.ts";
import type { RequestContext } from "./request-context.ts";

/** Local operational defaults, not a legal/hosted retention approval. */
export const LOCAL_PRIVACY_POLICY = Object.freeze({
  version: "local-privacy.v1",
  reauthenticationMinutes: 5,
  telemetryDays: 7,
  backupDays: 30,
  exportMaxBytes: 10_000_000,
});

export type PrivacyAuthorization = {
  /** Supplied by the verified authentication adapter, never the request body. */
  readonly recentlyVerified: boolean;
};
export type PrivacyStatus = {
  readonly state: "active" | "suspended" | "deletion_pending" | "deleted";
  readonly requestId: string | null;
  readonly deletionState: "pending" | "purging" | "completed" | "held" | null;
  readonly backupExpiry: string | null;
};
export type PrivacyRepository = {
  status(context: RequestContext): Promise<PrivacyStatus>;
  exportOwned(context: RequestContext): Promise<unknown>;
  requestDeletion(context: RequestContext): Promise<PrivacyStatus>;
};
export function requirePrivacyReauthentication(authorization: PrivacyAuthorization): void {
  if (authorization.recentlyVerified !== true)
    throw authorizationError("Verify your identity again before exporting or deleting data.");
}
export async function exportPrivateData(
  context: RequestContext,
  repository: PrivacyRepository,
  authorization: PrivacyAuthorization,
): Promise<unknown> {
  requirePrivacyReauthentication(authorization);
  return repository.exportOwned(context);
}
export async function requestPrivateDeletion(
  context: RequestContext,
  repository: PrivacyRepository,
  authorization: PrivacyAuthorization,
  confirmation: unknown,
): Promise<PrivacyStatus> {
  requirePrivacyReauthentication(authorization);
  if (confirmation !== "DELETE MY DATA")
    throw validationError("Type DELETE MY DATA to confirm account data deletion.");
  return repository.requestDeletion(context);
}
