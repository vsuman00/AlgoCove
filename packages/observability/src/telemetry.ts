export const OPERATIONS = [
  "workspace",
  "privacy",
  "privacy_export",
  "privacy_deletion",
  "code_execution",
  "roadmap",
  "database",
  "tutor_provider",
  "tutor_authored",
] as const;
export type Operation = (typeof OPERATIONS)[number];
export const OUTCOMES = [
  "success",
  "failure",
  "timeout",
  "cancelled",
  "rejected",
  "fallback",
] as const;
export type Outcome = (typeof OUTCOMES)[number];
export type OperationalMeasurement = {
  operation: Operation;
  outcome: Outcome;
  durationMs: number;
  traceId: string;
  requestId: string;
  sessionCorrelation?: string;
  language?: string;
  observedAt: string;
};
/** Named projection and runtime checks protect against casts and unknown fields. */
export function operationalMeasurement(value: OperationalMeasurement): OperationalMeasurement {
  if (
    !OPERATIONS.includes(value.operation) ||
    !OUTCOMES.includes(value.outcome) ||
    !Number.isSafeInteger(value.durationMs) ||
    value.durationMs < 0 ||
    value.durationMs > 600000 ||
    !Number.isFinite(Date.parse(value.observedAt))
  )
    throw Error("Invalid operational measurement.");
  const safeId = (id: string) =>
    /^(?:req|request|trace)[_-][0-9a-hjkmnp-tv-z]{8,64}$/.test(id) ? id : "unknown";
  return {
    operation: value.operation,
    outcome: value.outcome,
    durationMs: value.durationMs,
    traceId: safeId(value.traceId),
    requestId: safeId(value.requestId),
    observedAt: new Date(value.observedAt).toISOString(),
    ...(value.sessionCorrelation && /^corr_[a-f0-9]{64}$/.test(value.sessionCorrelation)
      ? { sessionCorrelation: value.sessionCorrelation }
      : {}),
    ...(value.language &&
    ["python", "javascript", "typescript", "java", "cpp", "c"].includes(value.language)
      ? { language: value.language }
      : {}),
  };
}
export function serializeOperationalMeasurement(value: OperationalMeasurement): string {
  return JSON.stringify(operationalMeasurement(value));
}
export type SloWindow = {
  total: number;
  bad: number;
  successRate: number | null;
  burnRate: number | null;
  p95Ms: number | null;
};
export function calculateSlo(
  samples: readonly OperationalMeasurement[],
  operation: Operation,
  now: number,
  windowMs: number,
  target = 0.99,
  latencyMs = 5000,
): SloWindow {
  if (!Number.isFinite(now) || windowMs <= 0 || target <= 0 || target >= 1 || latencyMs <= 0)
    throw Error("Invalid SLO configuration.");
  const rows = samples.filter(
    (s) =>
      s.operation === operation &&
      Date.parse(s.observedAt) <= now &&
      Date.parse(s.observedAt) > now - windowMs &&
      !["rejected", "cancelled"].includes(s.outcome),
  );
  const bad = rows.filter((s) => s.outcome !== "success" || s.durationMs > latencyMs).length;
  const durations = rows.map((s) => s.durationMs).sort((a, b) => a - b);
  return {
    total: rows.length,
    bad,
    successRate: rows.length ? 1 - bad / rows.length : null,
    burnRate: rows.length ? bad / rows.length / (1 - target) : null,
    p95Ms: durations.length ? durations[Math.ceil(durations.length * 0.95) - 1]! : null,
  };
}
export const ALERT_DEFINITIONS = {
  "request-burn": {
    owner: "platform-operator",
    severity: "page",
    runbook: "ops/runbooks/service-degradation.md",
    action:
      "Disable optional work; retain core learning and investigate database/execution symptoms.",
  },
  "provider-burn": {
    owner: "ai-operator",
    severity: "warning",
    runbook: "ops/runbooks/provider-failure.md",
    action: "Roll back the active provider configuration to authored.off.v1.",
  },
  "worker-heartbeat": {
    owner: "platform-operator",
    severity: "page",
    runbook: "ops/runbooks/worker-recovery.md",
    action: "Stop optional admission, restart the approved worker and reconcile fenced claims.",
  },
  "privacy-backlog": {
    owner: "privacy-administrator",
    severity: "page",
    runbook: "ops/runbooks/privacy-incident.md",
    action: "Keep affected accounts blocked, restore cancellation dependencies and retry deletion.",
  },
} as const;
export type OperationalAlert = {
  id: keyof typeof ALERT_DEFINITIONS;
  owner: string;
  severity: string;
  runbook: string;
  action: string;
  operation?: Operation;
};
export function evaluateOperationalAlerts(input: {
  samples: readonly OperationalMeasurement[];
  now: number;
  workerEnabled: boolean;
  lastHeartbeat: number | null;
  oldestPendingDeletion: number | null;
}): OperationalAlert[] {
  const ids: { id: keyof typeof ALERT_DEFINITIONS; operation?: Operation }[] = [];
  for (const [operation, id] of [
    ["workspace", "request-burn"],
    ["code_execution", "request-burn"],
    ["roadmap", "request-burn"],
    ["privacy", "request-burn"],
    ["database", "request-burn"],
    ["tutor_provider", "provider-burn"],
  ] as const) {
    const short = calculateSlo(input.samples, operation, input.now, 5 * 60 * 1000),
      long = calculateSlo(input.samples, operation, input.now, 60 * 60 * 1000);
    if (
      short.total >= 20 &&
      long.total >= 20 &&
      (short.burnRate ?? 0) >= 14.4 &&
      (long.burnRate ?? 0) >= 14.4
    )
      ids.push({ id, operation });
  }
  if (
    input.workerEnabled &&
    (input.lastHeartbeat === null || input.now - input.lastHeartbeat > 120000)
  )
    ids.push({ id: "worker-heartbeat" });
  if (
    input.oldestPendingDeletion !== null &&
    input.now - input.oldestPendingDeletion > 24 * 60 * 60 * 1000
  )
    ids.push({ id: "privacy-backlog" });
  return ids.map(({ id, operation }) => ({
    id,
    ...ALERT_DEFINITIONS[id],
    ...(operation ? { operation } : {}),
  }));
}
