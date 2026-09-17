import { err, ok, type Result } from "@algocove/domain";
import {
  verifyRunDescriptor,
  type SignedRunDescriptor,
  type VerificationKey,
} from "@algocove/execution-contracts";
import { validateDispatchKey, validateQuota } from "./admission.ts";
import { controlFailure, type AdmissionQuota, type ControlFailure } from "./types.ts";

export const EXECUTION_DISPATCH_TOPIC = "execution.run.requested" as const;

export type ExecutionDispatchMessage = {
  readonly topic: typeof EXECUTION_DISPATCH_TOPIC;
  readonly dispatchKey: string;
  readonly descriptor: SignedRunDescriptor;
  readonly quota: AdmissionQuota;
};

export type DispatchMessageFailure = ControlFailure;

/**
 * Create the only payload the execution relay is allowed to publish. The
 * learner source is deliberately not part of this shape; the signed descriptor
 * carries its digest and the worker obtains no application-table access.
 */
export function createExecutionDispatchMessage(input: {
  readonly dispatchKey: string;
  readonly descriptor: SignedRunDescriptor;
  readonly quota: AdmissionQuota;
  readonly now: string;
  readonly verificationKeys: ReadonlyMap<string, VerificationKey>;
}): Result<ExecutionDispatchMessage, DispatchMessageFailure> {
  const dispatchKey = validateDispatchKey(input.dispatchKey);
  if (!dispatchKey.ok) return dispatchKey;
  const quota = validateQuota(input.quota);
  if (!quota.ok) return quota;
  const descriptor = verifyRunDescriptor(input.descriptor, {
    keys: input.verificationKeys,
    now: input.now,
  });
  if (!descriptor.ok) {
    return err(controlFailure("invalid_descriptor", descriptor.error.message));
  }
  return ok({
    topic: EXECUTION_DISPATCH_TOPIC,
    dispatchKey: input.dispatchKey,
    descriptor: cloneJson(input.descriptor),
    quota: { ...input.quota },
  });
}

/** Parse an outbox payload without accepting arbitrary fields or learner data. */
export function parseExecutionDispatchMessage(
  value: unknown,
  input: {
    readonly now: string;
    readonly verificationKeys: ReadonlyMap<string, VerificationKey>;
  },
): Result<ExecutionDispatchMessage, DispatchMessageFailure> {
  if (!isRecord(value)) {
    return err(controlFailure("invalid_request", "Execution dispatch payload must be an object."));
  }
  const allowed = new Set(["topic", "dispatchKey", "descriptor", "quota"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    return err(
      controlFailure("invalid_request", "Execution dispatch payload contains an unknown field."),
    );
  }
  if (value.topic !== EXECUTION_DISPATCH_TOPIC) {
    return err(controlFailure("invalid_request", "Execution dispatch topic is not supported."));
  }
  if (!isRecord(value.quota) || !isRecord(value.descriptor)) {
    return err(
      controlFailure("invalid_request", "Execution dispatch descriptor and quota are required."),
    );
  }
  if (typeof value.dispatchKey !== "string") {
    return err(controlFailure("invalid_request", "Execution dispatch key must be a string."));
  }
  return createExecutionDispatchMessage({
    dispatchKey: value.dispatchKey,
    descriptor: value.descriptor as unknown as SignedRunDescriptor,
    quota: value.quota as unknown as AdmissionQuota,
    now: input.now,
    verificationKeys: input.verificationKeys,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJson<TValue>(value: TValue): TValue {
  return JSON.parse(JSON.stringify(value)) as TValue;
}
