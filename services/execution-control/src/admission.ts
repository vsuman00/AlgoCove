import { err, ok, parseInstant, type Result } from "@algocove/domain";
import { controlFailure, type AdmissionQuota, type ControlFailure } from "./types.ts";

export const MAX_LEASE_DURATION_MS = 60_000;

function boundedToken(value: string, maximum: number): boolean {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    /^[A-Za-z0-9._:-]+$/.test(value)
  );
}

export function validateDispatchKey(dispatchKey: string): Result<undefined, ControlFailure> {
  return boundedToken(dispatchKey, 200)
    ? ok(undefined)
    : err(controlFailure("invalid_request", "Dispatch key is not a bounded safe identifier."));
}

export function validateWorkerId(workerId: string): Result<undefined, ControlFailure> {
  return boundedToken(workerId, 128)
    ? ok(undefined)
    : err(controlFailure("invalid_request", "Worker ID is not a bounded safe identifier."));
}

export function validateQuota(quota: AdmissionQuota): Result<undefined, ControlFailure> {
  if (typeof quota !== "object" || quota === null) {
    return err(controlFailure("invalid_request", "Quota must be an object."));
  }
  if (!boundedToken(quota.quotaKey, 200) || !boundedToken(quota.profileId, 128)) {
    return err(controlFailure("invalid_request", "Quota and profile identifiers are invalid."));
  }
  if (
    !Number.isSafeInteger(quota.maxConcurrent) ||
    quota.maxConcurrent < 1 ||
    quota.maxConcurrent > 32
  ) {
    return err(controlFailure("invalid_request", "Concurrent quota must be between 1 and 32."));
  }
  return ok(undefined);
}

export function validateControlTime(now: string): Result<undefined, ControlFailure> {
  return parseInstant(now).ok
    ? ok(undefined)
    : err(controlFailure("invalid_request", "Execution-control time must be a UTC instant."));
}

export function validateLeaseDuration(leaseDurationMs: number): Result<undefined, ControlFailure> {
  return Number.isSafeInteger(leaseDurationMs) &&
    leaseDurationMs > 0 &&
    leaseDurationMs <= MAX_LEASE_DURATION_MS
    ? ok(undefined)
    : err(
        controlFailure("invalid_request", "Lease duration is outside the bounded service window."),
      );
}
