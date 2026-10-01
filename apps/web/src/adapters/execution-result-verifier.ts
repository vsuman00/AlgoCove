import { createPublicKey } from "node:crypto";
import {
  digestDescriptor,
  verifyExecutionResult,
  verifyRunDescriptor,
  type SignedRunDescriptor,
  type SignedExecutionResult,
  type VerificationKey,
  type ExecutionResult,
} from "@algocove/execution-contracts";
import type { CodeRunRecord } from "@algocove/application";

/** Public keys only: the web process cannot issue descriptors or verdicts. */
export function executionVerificationKeys(
  serialized: string | undefined,
): ReadonlyMap<string, VerificationKey> {
  if (serialized === undefined || serialized.length > 16384)
    throw new Error("Execution verification keys unavailable.");
  const entries: unknown = JSON.parse(serialized);
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > 8)
    throw new Error("Execution verification keys invalid.");
  const keys = new Map<string, VerificationKey>();
  for (const entry of entries) {
    if (
      !isRecord(entry) ||
      typeof entry.keyId !== "string" ||
      typeof entry.publicKey !== "string" ||
      !/^[A-Za-z0-9._:-]{1,128}$/.test(entry.keyId) ||
      keys.has(entry.keyId)
    )
      throw new Error("Execution verification key invalid.");
    const publicKey = createPublicKey(entry.publicKey);
    if (publicKey.asymmetricKeyType !== "ed25519")
      throw new Error("Execution verification key invalid.");
    keys.set(entry.keyId, { keyId: entry.keyId, publicKey, status: "active" });
  }
  return keys;
}

export function verifyCommittedExecutionResult(
  signed: SignedExecutionResult,
  dispatch: unknown,
  run: CodeRunRecord,
  keys: ReadonlyMap<string, VerificationKey>,
  now: string,
): ExecutionResult {
  if (
    !isRecord(dispatch) ||
    dispatch.topic !== "execution.run.requested" ||
    !isRecord(dispatch.descriptor) ||
    !isRecord(dispatch.descriptor.payload)
  )
    throw new Error("Committed execution descriptor unavailable.");
  const envelope = dispatch.descriptor as unknown as SignedRunDescriptor;
  const descriptor = verifyRunDescriptor(envelope, {
    keys,
    now: String(envelope.payload.issuedAt),
  });
  if (!descriptor.ok) throw new Error(descriptor.error.message);
  const expected = descriptor.value;
  if (
    expected.runId !== run.runId ||
    expected.attemptId !== run.attemptId ||
    expected.problemVersionId !== run.problemVersionId ||
    expected.language !== run.language ||
    expected.sourceDigest !== run.sourceChecksum ||
    expected.replayId !== dispatch.dispatchKey
  )
    throw new Error("Committed execution binding mismatch.");
  const verified = verifyExecutionResult(signed, {
    keys,
    now,
    expectedDescriptorDigest: digestDescriptor(expected),
    expectedRunId: expected.runId,
    expectedAttemptId: expected.attemptId,
    expectedReplayId: expected.replayId,
    expectedLeaseEpoch: expected.leaseEpoch,
  });
  if (!verified.ok) throw new Error(verified.error.message);
  return verified.value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
