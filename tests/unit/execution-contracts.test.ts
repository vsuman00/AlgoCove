import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CURRENT_EXECUTION_SCHEMA_VERSION,
  EXECUTION_PHASES,
  TERMINAL_CATEGORIES,
  createExecutionResult,
  createRunDescriptor,
  digestDescriptor,
  generateSigningKeyPair,
  parseRunDescriptor,
  signExecutionResult,
  signRunDescriptor,
  verifyExecutionResult,
  verifyRunDescriptor,
  type ExecutionLimits,
  type LearnerRunInput,
  type SignedRunDescriptor,
  type VerificationKey,
} from "@algocove/execution-contracts";
import {
  formatId,
  type ContentChecksum,
  type OpaqueId,
  type ProblemVersionId,
  type Result,
} from "@algocove/domain";

const now = "2026-09-17T10:00:00.000Z";
const later = "2026-09-17T10:00:30.000Z";
function must<T>(result: Result<T, unknown>): T {
  if (!result.ok) throw new Error("Unexpected test fixture failure.");
  return result.value;
}

const problemVersionId = must(formatId("problemVersion", "0000000000000001")) as ProblemVersionId;
const runId = must(formatId("codeRun", "0000000000000001")) as OpaqueId<"codeRun">;
const attemptId = must(formatId("attempt", "0000000000000001")) as OpaqueId<"attempt">;
const checksum =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as ContentChecksum;
const source = "function solve(input) { return input; }";

const limits: ExecutionLimits = {
  compileTimeoutMs: 5_000,
  runTimeoutMs: 2_000,
  memoryLimitMb: 256,
  cpuLimitMillis: 7_000,
  pidLimit: 32,
  outputLimitBytes: 65_536,
  sourceLimitBytes: 1_048_576,
};

const learnerInput: LearnerRunInput = { language: "javascript", source };

function descriptorInput() {
  return {
    learner: learnerInput,
    server: {
      runId,
      attemptId,
      replayId: "replay-0000000000000001",
      problemVersionId,
      manifestDigest: checksum,
      fixtureDigest: checksum,
      runtimeImageDigest: checksum,
      languageManifest: {
        language: "javascript" as const,
        starterTemplate: "function solve(input) {\n  return input;\n}",
        entrySignature: "function solve(input)",
        adapterId: "harness.javascript" as const,
        limitsProfile: { compileTimeoutMs: 5_000, runTimeoutMs: 2_000, memoryLimitMb: 256 },
        fixtureIds: ["sample-1"],
      },
      limits,
      phasePlan: ["run"] as const,
      policyVersion: 1,
      keyId: "exec-2026-09-a",
      leaseEpoch: 4,
      issuedAt: now,
      expiresAt: later,
    },
  };
}

function verificationKey(keyId: string, status: VerificationKey["status"] = "active") {
  const keyPair = generateSigningKeyPair(keyId);
  return {
    signing: keyPair,
    verification: { keyId, publicKey: keyPair.publicKey, status } satisfies VerificationKey,
  };
}

describe("signed execution contracts", () => {
  it("accepts only source and selected published language from the learner", () => {
    const result = createRunDescriptor(descriptorInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.sourceDigest).toBe(
      "sha256:83aef3af1ed0962139b43de9a8ed4ff1fb7c2886adaecf78cf913dc715371a3e",
    );
    expect(result.value.language).toBe("javascript");
    expect(result.value).not.toHaveProperty("source");
    expect(result.value).not.toHaveProperty("learner");
  });

  it("binds the descriptor to manifest, image, fixture, limits, expiry, and lease", () => {
    const result = createRunDescriptor(descriptorInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      schemaVersion: CURRENT_EXECUTION_SCHEMA_VERSION,
      runId,
      attemptId,
      problemVersionId,
      manifestDigest: checksum,
      fixtureDigest: checksum,
      runtimeImageDigest: checksum,
      limits,
      phasePlan: ["run"],
      leaseEpoch: 4,
      expiresAt: later,
    });
  });

  it("signs and verifies a descriptor, then rejects payload tampering", () => {
    const descriptor = createRunDescriptor(descriptorInput());
    expect(descriptor.ok).toBe(true);
    if (!descriptor.ok) return;
    const key = verificationKey("exec-2026-09-a");
    const signed = signRunDescriptor(descriptor.value, key.signing);

    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    expect(
      verifyRunDescriptor(signed.value, {
        keys: new Map([[key.verification.keyId, key.verification]]),
        now,
      }),
    ).toMatchObject({ ok: true });

    const tampered = {
      ...signed.value,
      payload: { ...signed.value.payload, leaseEpoch: 5 },
    } satisfies SignedRunDescriptor;
    expect(
      verifyRunDescriptor(tampered, {
        keys: new Map([[key.verification.keyId, key.verification]]),
        now,
      }),
    ).toMatchObject({ ok: false, error: { code: "signature_invalid" } });
  });

  it("rejects expired descriptors and supports old keys only in the rotation window", () => {
    const descriptor = createRunDescriptor({
      ...descriptorInput(),
      server: {
        ...descriptorInput().server,
        keyId: "exec-2026-09-old",
        expiresAt: "2026-09-17T10:00:10.000Z",
      },
    });
    expect(descriptor.ok).toBe(true);
    if (!descriptor.ok) return;
    const key = verificationKey("exec-2026-09-old", "verification_only");
    const signed = signRunDescriptor(descriptor.value, key.signing);
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;

    expect(
      verifyRunDescriptor(signed.value, {
        keys: new Map([
          [
            key.verification.keyId,
            { ...key.verification, verificationUntil: "2026-09-17T10:01:00.000Z" },
          ],
        ]),
        now: "2026-09-17T10:00:05.000Z",
      }),
    ).toMatchObject({ ok: true });
    expect(
      verifyRunDescriptor(signed.value, {
        keys: new Map([
          [
            key.verification.keyId,
            { ...key.verification, verificationUntil: "2026-09-17T10:00:04.000Z" },
          ],
        ]),
        now: "2026-09-17T10:00:05.000Z",
      }),
    ).toMatchObject({ ok: false, error: { code: "key_not_acceptable" } });
    expect(
      verifyRunDescriptor(signed.value, {
        keys: new Map([
          [
            key.verification.keyId,
            { ...key.verification, verificationUntil: "2026-09-17T10:01:00.000Z" },
          ],
        ]),
        now: "2026-09-17T10:00:11.000Z",
      }),
    ).toMatchObject({ ok: false, error: { code: "expired" } });
  });

  it("classifies terminal results and fences stale lease epochs and replays", () => {
    const descriptor = createRunDescriptor(descriptorInput());
    expect(descriptor.ok).toBe(true);
    if (!descriptor.ok) return;
    const key = verificationKey("exec-2026-09-a");
    const result = createExecutionResult({
      descriptor: descriptor.value,
      resultId: "result-0000000000000001",
      terminalCategory: "wrong_answer",
      phase: "run",
      issuedAt: now,
      expiresAt: "2026-09-17T10:05:00.000Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.classification).toBe("learner_failure");
    const signed = signExecutionResult(result.value, key.signing);
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;

    const options = {
      keys: new Map([[key.verification.keyId, key.verification]]),
      now,
      expectedDescriptorDigest: digestDescriptor(descriptor.value),
      expectedRunId: runId,
      expectedAttemptId: attemptId,
      expectedReplayId: descriptor.value.replayId,
      expectedLeaseEpoch: 4,
    };
    expect(verifyExecutionResult(signed.value, options)).toMatchObject({ ok: true });
    expect(
      verifyExecutionResult(signed.value, { ...options, expectedLeaseEpoch: 3 }),
    ).toMatchObject({
      ok: false,
      error: { code: "lease_epoch_mismatch" },
    });
    expect(
      verifyExecutionResult(signed.value, { ...options, expectedReplayId: "replay-other" }),
    ).toMatchObject({ ok: false, error: { code: "replay_mismatch" } });

    const infrastructure = createExecutionResult({
      descriptor: descriptor.value,
      resultId: "result-0000000000000002",
      terminalCategory: "infrastructure_error",
      phase: "run",
      issuedAt: now,
      expiresAt: "2026-09-17T10:05:00.000Z",
    });
    expect(infrastructure.ok).toBe(true);
    if (infrastructure.ok)
      expect(infrastructure.value.classification).toBe("infrastructure_failure");

    const cancelled = createExecutionResult({
      descriptor: descriptor.value,
      resultId: "result-0000000000000004",
      terminalCategory: "cancelled",
      phase: "run",
      issuedAt: now,
      expiresAt: "2026-09-17T10:05:00.000Z",
    });
    expect(cancelled.ok).toBe(true);
    if (cancelled.ok) expect(cancelled.value.classification).toBe("control_plane");
  });

  it("rejects unsupported schema versions and invalid terminal classifications", () => {
    const descriptor = createRunDescriptor(descriptorInput());
    expect(descriptor.ok).toBe(true);
    if (!descriptor.ok) return;
    expect(parseRunDescriptor({ ...descriptor.value, schemaVersion: 999 })).toMatchObject({
      ok: false,
      error: { code: "unsupported_schema_version" },
    });
    expect(
      createExecutionResult({
        descriptor: descriptor.value,
        resultId: "result-0000000000000003",
        terminalCategory: "pass",
        classification: "infrastructure_failure",
        phase: "run",
        issuedAt: now,
        expiresAt: "2026-09-17T10:05:00.000Z",
      }),
    ).toMatchObject({ ok: false, error: { code: "classification_mismatch" } });
    expect(EXECUTION_PHASES).toEqual(["compile", "run"]);
    expect(TERMINAL_CATEGORIES).toContain("cancelled");
  });

  it("does not accept a mismatched generated signing key", () => {
    const descriptor = createRunDescriptor(descriptorInput());
    expect(descriptor.ok).toBe(true);
    if (!descriptor.ok) return;
    const other = generateKeyPairSync("ed25519");
    const signed = signRunDescriptor(descriptor.value, {
      keyId: "different-key",
      privateKey: other.privateKey,
      publicKey: other.publicKey,
    });
    expect(signed).toMatchObject({ ok: false, error: { code: "key_mismatch" } });
  });
});
