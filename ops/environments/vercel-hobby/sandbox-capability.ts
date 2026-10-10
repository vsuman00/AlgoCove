import { z } from "zod";

const limit = z.string().regex(/^(?:[1-9][0-9]*|max|unavailable)$/);
export const sandboxObservationSchema = z
  .object({
    normal: z.boolean(),
    pythonVersion: z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+$/),
    uid: z.number().int().nonnegative(),
    externalBlocked: z.boolean(),
    metadataBlocked: z.boolean(),
    credentialEnvAbsent: z.boolean(),
    dockerSocketAbsent: z.boolean(),
    memoryMax: limit,
    pidsMax: limit,
    sudoAvailable: z.boolean(),
  })
  .strict();

export function evaluateSandboxCapability(
  observation: unknown,
  expected: { pythonVersion: string; maxMemoryBytes: number; maxPids: number },
): { productionQualified: false; blockers: readonly string[]; remainingChecks: readonly string[] } {
  const parsed = sandboxObservationSchema.safeParse(observation);
  const blockers: string[] = [];
  if (
    !parsed.success ||
    !/^[0-9]+\.[0-9]+\.[0-9]+$/.test(expected.pythonVersion) ||
    !Number.isSafeInteger(expected.maxMemoryBytes) ||
    expected.maxMemoryBytes <= 0 ||
    !Number.isSafeInteger(expected.maxPids) ||
    expected.maxPids <= 0
  )
    blockers.push("invalid_probe_or_limits");
  else {
    const value = parsed.data;
    if (!value.normal) blockers.push("normal_fixture_failed");
    if (value.pythonVersion !== expected.pythonVersion) blockers.push("runtime_version_mismatch");
    if (value.uid === 0 || value.sudoAvailable) blockers.push("learner_privilege_escalation");
    if (!value.externalBlocked || !value.metadataBlocked) blockers.push("network_probe_failed");
    if (!value.credentialEnvAbsent || !value.dockerSocketAbsent)
      blockers.push("sensitive_boundary_failed");
    const bounded = (text: string, maximum: number): boolean =>
      /^[1-9][0-9]*$/.test(text) && BigInt(text) <= BigInt(maximum);
    if (!bounded(value.memoryMax, expected.maxMemoryBytes))
      blockers.push("memory_limit_unqualified");
    if (!bounded(value.pidsMax, expected.maxPids)) blockers.push("pid_limit_unqualified");
  }
  // Discovery observations cannot establish hard enforcement, all network targets or teardown.
  return {
    productionQualified: false,
    blockers,
    remainingChecks: [
      "immutable_runtime_identity",
      "cpu_wall_file_disk_input_output_enforcement",
      "application_database_control_network_denial",
      "hostile_limits_cancellation_residue_teardown",
      "external_comparator_signed_results",
    ],
  };
}
