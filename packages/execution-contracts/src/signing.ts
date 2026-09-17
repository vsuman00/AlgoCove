import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
  type KeyObject,
} from "node:crypto";
import { err, parseInstant, type Result } from "@algocove/domain";
import {
  canonicalizeExecutionResult,
  parseExecutionResult,
  type ExecutionResult,
} from "./result.ts";
import { canonicalizeRunDescriptor, parseRunDescriptor } from "./run-descriptor.ts";
import { contractFailure, type ContractFailure, type RunDescriptor } from "./types.ts";

export type SigningKeyPair = {
  readonly keyId: string;
  readonly privateKey: KeyObject;
  readonly publicKey: KeyObject;
};

export type VerificationKey = {
  readonly keyId: string;
  readonly publicKey: KeyObject;
  readonly status: "active" | "verification_only" | "revoked";
  readonly verificationUntil?: string;
};

export type SignedRunDescriptor = {
  readonly algorithm: "ed25519";
  readonly keyId: string;
  readonly payload: RunDescriptor;
  readonly signature: string;
};

export type SignedExecutionResult = {
  readonly algorithm: "ed25519";
  readonly keyId: string;
  readonly payload: ExecutionResult;
  readonly signature: string;
};

export type VerificationOptions = {
  readonly keys: ReadonlyMap<string, VerificationKey>;
  readonly now: string;
};

export type ResultVerificationOptions = VerificationOptions & {
  readonly expectedDescriptorDigest: string;
  readonly expectedRunId: RunDescriptor["runId"];
  readonly expectedAttemptId: RunDescriptor["attemptId"];
  readonly expectedReplayId: string;
  readonly expectedLeaseEpoch: number;
};

function isSafeKeyId(keyId: string): boolean {
  return keyId.length > 0 && keyId.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(keyId);
}

function signatureToBase64Url(signature: Buffer): string {
  return signature.toString("base64url");
}

function signatureFromBase64Url(signature: string): Buffer {
  return Buffer.from(signature, "base64url");
}

function signPayload(payload: string, key: SigningKeyPair): Result<string, ContractFailure> {
  if (!isSafeKeyId(key.keyId))
    return err(contractFailure("key_mismatch", "Signing key ID is invalid."));
  if (key.privateKey.type !== "private" || key.privateKey.asymmetricKeyType !== "ed25519") {
    return err(
      contractFailure(
        "key_mismatch",
        "Execution contracts require an Ed25519 private signing key.",
      ),
    );
  }
  try {
    return {
      ok: true,
      value: signatureToBase64Url(sign(null, Buffer.from(payload, "utf8"), key.privateKey)),
    };
  } catch {
    return err(contractFailure("signature_invalid", "Execution contract could not be signed."));
  }
}

function validateSignatureEnvelope(
  algorithm: string,
  keyId: string,
  expectedKeyId: string,
  signature: string,
): Result<undefined, ContractFailure> {
  if (algorithm !== "ed25519")
    return err(
      contractFailure("signature_invalid", "Only Ed25519 execution signatures are supported."),
    );
  if (keyId !== expectedKeyId)
    return err(
      contractFailure("key_mismatch", "Signature key ID does not match the signed payload."),
    );
  if (!/^[A-Za-z0-9_-]+$/.test(signature))
    return err(contractFailure("signature_invalid", "Signature encoding is invalid."));
  return { ok: true, value: undefined };
}

function acceptableVerificationKey(
  key: VerificationKey | undefined,
  keyId: string,
  now: string,
): Result<VerificationKey, ContractFailure> {
  if (
    key === undefined ||
    key.keyId !== keyId ||
    key.publicKey.type !== "public" ||
    key.publicKey.asymmetricKeyType !== "ed25519"
  ) {
    return err(
      contractFailure(
        "key_not_acceptable",
        "Verification key is unavailable or has the wrong algorithm.",
      ),
    );
  }
  if (key.status === "revoked")
    return err(contractFailure("key_not_acceptable", "Verification key has been revoked."));
  if (key.status === "verification_only") {
    const current = parseInstant(now);
    const verificationUntil = parseInstant(key.verificationUntil);
    if (
      !current.ok ||
      !verificationUntil.ok ||
      Date.parse(current.value) >= Date.parse(verificationUntil.value)
    ) {
      return err(
        contractFailure(
          "key_not_acceptable",
          "Verification-only key is outside its rotation window.",
        ),
      );
    }
  }
  return { ok: true, value: key };
}

function validateTemporalWindow(
  issuedAt: string,
  expiresAt: string,
  now: string,
): Result<undefined, ContractFailure> {
  const current = Date.parse(now);
  const issued = Date.parse(issuedAt);
  const expires = Date.parse(expiresAt);
  if (!Number.isFinite(current) || !Number.isFinite(issued) || !Number.isFinite(expires)) {
    return err(contractFailure("invalid_timestamp", "Signature verification time is invalid."));
  }
  if (current < issued)
    return err(contractFailure("not_yet_valid", "Signed contract is not valid yet."));
  if (current >= expires) return err(contractFailure("expired", "Signed contract has expired."));
  return { ok: true, value: undefined };
}

function verifyPayload(payload: string, signature: string, key: VerificationKey): boolean {
  try {
    return verify(
      null,
      Buffer.from(payload, "utf8"),
      key.publicKey,
      signatureFromBase64Url(signature),
    );
  } catch {
    return false;
  }
}

export function generateSigningKeyPair(keyId: string): SigningKeyPair {
  if (!isSafeKeyId(keyId)) throw new Error("Signing key ID is invalid.");
  const keyPair = generateKeyPairSync("ed25519");
  return { keyId, privateKey: keyPair.privateKey, publicKey: keyPair.publicKey };
}

export function signRunDescriptor(
  descriptor: RunDescriptor,
  key: SigningKeyPair,
): Result<SignedRunDescriptor, ContractFailure> {
  if (descriptor.keyId !== key.keyId)
    return err(contractFailure("key_mismatch", "Descriptor key ID does not match signing key."));
  const parsed = parseRunDescriptor(descriptor);
  if (!parsed.ok) return parsed;
  const signature = signPayload(canonicalizeRunDescriptor(parsed.value), key);
  if (!signature.ok) return signature;
  return {
    ok: true,
    value: {
      algorithm: "ed25519",
      keyId: key.keyId,
      payload: parsed.value,
      signature: signature.value,
    },
  };
}

export function signExecutionResult(
  result: ExecutionResult,
  key: SigningKeyPair,
): Result<SignedExecutionResult, ContractFailure> {
  if (result.keyId !== key.keyId)
    return err(contractFailure("key_mismatch", "Result key ID does not match signing key."));
  const parsed = parseExecutionResult(result);
  if (!parsed.ok) return parsed;
  const signature = signPayload(canonicalizeExecutionResult(parsed.value), key);
  if (!signature.ok) return signature;
  return {
    ok: true,
    value: {
      algorithm: "ed25519",
      keyId: key.keyId,
      payload: parsed.value,
      signature: signature.value,
    },
  };
}

export function verifyRunDescriptor(
  signed: SignedRunDescriptor,
  options: VerificationOptions,
): Result<RunDescriptor, ContractFailure> {
  const parsed = parseRunDescriptor(signed.payload);
  if (!parsed.ok) return parsed;
  const envelope = validateSignatureEnvelope(
    signed.algorithm,
    signed.keyId,
    parsed.value.keyId,
    signed.signature,
  );
  if (!envelope.ok) return envelope;
  const key = acceptableVerificationKey(options.keys.get(signed.keyId), signed.keyId, options.now);
  if (!key.ok) return key;
  const temporal = validateTemporalWindow(
    parsed.value.issuedAt,
    parsed.value.expiresAt,
    options.now,
  );
  if (!temporal.ok) return temporal;
  if (!verifyPayload(canonicalizeRunDescriptor(parsed.value), signed.signature, key.value)) {
    return err(contractFailure("signature_invalid", "Run descriptor signature is invalid."));
  }
  return parsed;
}

export function verifyExecutionResult(
  signed: SignedExecutionResult,
  options: ResultVerificationOptions,
): Result<ExecutionResult, ContractFailure> {
  const parsed = parseExecutionResult(signed.payload);
  if (!parsed.ok) return parsed;
  const envelope = validateSignatureEnvelope(
    signed.algorithm,
    signed.keyId,
    parsed.value.keyId,
    signed.signature,
  );
  if (!envelope.ok) return envelope;
  const key = acceptableVerificationKey(options.keys.get(signed.keyId), signed.keyId, options.now);
  if (!key.ok) return key;
  const temporal = validateTemporalWindow(
    parsed.value.issuedAt,
    parsed.value.expiresAt,
    options.now,
  );
  if (!temporal.ok) return temporal;
  if (!verifyPayload(canonicalizeExecutionResult(parsed.value), signed.signature, key.value)) {
    return err(contractFailure("signature_invalid", "Execution result signature is invalid."));
  }
  if (parsed.value.descriptorDigest !== options.expectedDescriptorDigest) {
    return err(
      contractFailure(
        "descriptor_mismatch",
        "Execution result does not belong to the expected descriptor.",
      ),
    );
  }
  if (parsed.value.runId !== options.expectedRunId)
    return err(contractFailure("run_mismatch", "Execution result belongs to another run."));
  if (parsed.value.attemptId !== options.expectedAttemptId)
    return err(contractFailure("run_mismatch", "Execution result belongs to another attempt."));
  if (parsed.value.replayId !== options.expectedReplayId)
    return err(
      contractFailure(
        "replay_mismatch",
        "Execution result replay identity is stale or mismatched.",
      ),
    );
  if (parsed.value.leaseEpoch !== options.expectedLeaseEpoch)
    return err(contractFailure("lease_epoch_mismatch", "Execution result lease epoch is stale."));
  return parsed;
}

export function importSigningKeyPair(
  keyId: string,
  privateKey: string | Buffer,
  publicKey: string | Buffer,
): SigningKeyPair {
  return { keyId, privateKey: createPrivateKey(privateKey), publicKey: createPublicKey(publicKey) };
}
