import { describe, expect, it } from "vitest";
import { evaluateSandboxCapability } from "../../../ops/environments/vercel-hobby/sandbox-capability.ts";

const expected = { pythonVersion: "3.14.7", maxMemoryBytes: 128 * 1024 * 1024, maxPids: 8 };
const baseline = {
  normal: true,
  pythonVersion: "3.14.7",
  uid: 65532,
  externalBlocked: true,
  metadataBlocked: true,
  credentialEnvAbsent: true,
  dockerSocketAbsent: true,
  memoryMax: String(expected.maxMemoryBytes),
  pidsMax: "8",
  sudoAvailable: false,
};

describe("managed Sandbox discovery gate", () => {
  it("rejects the observed default image instead of treating a microVM as qualified", () => {
    expect(
      evaluateSandboxCapability(
        {
          ...baseline,
          pythonVersion: "3.14.4",
          uid: 1000,
          memoryMax: "2147483648",
          pidsMax: "max",
          sudoAvailable: true,
        },
        expected,
      ).blockers,
    ).toEqual([
      "runtime_version_mismatch",
      "learner_privilege_escalation",
      "memory_limit_unqualified",
      "pid_limit_unqualified",
    ]);
  });
  it("never approves production from discovery alone", () => {
    expect(evaluateSandboxCapability(baseline, expected)).toMatchObject({
      productionQualified: false,
      blockers: [],
    });
    expect(evaluateSandboxCapability(baseline, expected).remainingChecks.length).toBeGreaterThan(0);
  });
  it.each(["max", "unavailable", "9999999999999999999999999999999999"])(
    "rejects an unenforced or oversized PID bound %s",
    (pidsMax) => {
      expect(evaluateSandboxCapability({ ...baseline, pidsMax }, expected).blockers).toContain(
        "pid_limit_unqualified",
      );
    },
  );
  it("rejects open networking, secrets and privilege escalation", () => {
    expect(
      evaluateSandboxCapability(
        { ...baseline, uid: 0, externalBlocked: false, credentialEnvAbsent: false },
        expected,
      ).blockers,
    ).toEqual([
      "learner_privilege_escalation",
      "network_probe_failed",
      "sensitive_boundary_failed",
    ]);
  });
  it("rejects incomplete or injected observations without reflecting unknown values", () => {
    for (const value of [
      {},
      { ...baseline, memoryMax: "-1" },
      { ...baseline, privateField: "PRIVATE_CANARY" },
    ]) {
      expect(evaluateSandboxCapability(value, expected).blockers).toEqual([
        "invalid_probe_or_limits",
      ]);
      expect(JSON.stringify(evaluateSandboxCapability(value, expected))).not.toContain(
        "PRIVATE_CANARY",
      );
    }
  });
  it("rejects invalid operator limits", () => {
    expect(
      evaluateSandboxCapability(baseline, { ...expected, maxPids: Infinity }).blockers,
    ).toEqual(["invalid_probe_or_limits"]);
  });
});
