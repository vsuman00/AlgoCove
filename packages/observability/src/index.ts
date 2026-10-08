export const TELEMETRY_CATEGORIES = {
  request: "request",
  dependency: "dependency",
  security: "security",
  domain: "domain",
} as const;

export type TelemetryCategory = (typeof TELEMETRY_CATEGORIES)[keyof typeof TELEMETRY_CATEGORIES];

export type TelemetryResult = "success" | "failure" | "timeout" | "retry";

export type TelemetryEventInput = {
  readonly traceId?: string;
  readonly requestId?: string;
  readonly category: TelemetryCategory;
  readonly event: string;
  readonly durationMs?: number;
  readonly status?: number;
  readonly retryable?: boolean;
  readonly dependency?: string;
  readonly result?: TelemetryResult;
};

export type TelemetryEvent = {
  readonly traceId: string;
  readonly requestId: string;
  readonly category: TelemetryCategory;
  readonly event: string;
  readonly durationMs?: number;
  readonly status?: number;
  readonly retryable?: boolean;
  readonly dependency?: string;
  readonly result?: TelemetryResult;
};

const SAFE_ID = /^(?:req|request|trace)[_-][0-9a-hjkmnp-tv-z]{8,64}$/;
const SAFE_LABELS = new Set([
  "profile.updated",
  "auth.rejected",
  "dependency.timeout",
  "request.completed",
  "request.failed",
  "dependency.failed",
  "worker.retry",
  "privacy.requested",
  "privacy.completed",
  "postgres",
  "execution",
  "tutor",
  "worker",
]);

function boundedId(value: string | undefined): string {
  return value !== undefined && SAFE_ID.test(value) ? value : "unknown";
}

function boundedLabel(value: string, fallback: string): string {
  return SAFE_LABELS.has(value) ? value : fallback;
}

function boundedDuration(value: number | undefined): number | undefined {
  return value !== undefined && Number.isInteger(value) && value >= 0 && value <= 600_000
    ? value
    : undefined;
}

function boundedStatus(value: number | undefined): number | undefined {
  return value !== undefined && Number.isInteger(value) && value >= 100 && value <= 599
    ? value
    : undefined;
}

/**
 * Redact arbitrary diagnostic values before a logger receives them. Structured
 * telemetry below does not accept arbitrary fields, but this helper protects
 * adapter-specific error context when a caller needs to summarize a value.
 */
export function redactTelemetryValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[redacted]";
  if (typeof value === "string") {
    return [
      "success",
      "failure",
      "timeout",
      "retry",
      "denied",
      "cancelled",
      "unknown",
      "unavailable",
    ].includes(value)
      ? value
      : "[redacted]";
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : "[invalid-number]";
  if (typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value))
    return value.slice(0, 32).map((item) => redactTelemetryValue(item, depth + 1));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) =>
          ["outcome", "result", "status", "durationMs", "retryable", "count"].includes(key),
        )
        .slice(0, 32)
        .map(([key, nested]) => [key, redactTelemetryValue(nested, depth + 1)]),
    );
  }
  return "[unsupported]";
}

export function createTelemetryEvent(input: TelemetryEventInput): TelemetryEvent {
  const durationMs = boundedDuration(input.durationMs);
  const status = boundedStatus(input.status);
  return {
    traceId: boundedId(input.traceId),
    requestId: boundedId(input.requestId),
    category: Object.values(TELEMETRY_CATEGORIES).includes(input.category)
      ? input.category
      : "security",
    event: boundedLabel(input.event, "unknown"),
    ...(durationMs === undefined ? {} : { durationMs }),
    ...(status === undefined ? {} : { status }),
    ...(typeof input.retryable === "boolean" ? { retryable: input.retryable } : {}),
    ...(input.dependency === undefined
      ? {}
      : { dependency: boundedLabel(input.dependency, "unknown") }),
    ...(["success", "failure", "timeout", "retry"].includes(input.result ?? "")
      ? { result: input.result }
      : {}),
  };
}

/** Serialize only the stable telemetry allowlist; unknown fields are dropped. */
export function serializeTelemetryEvent(input: TelemetryEventInput): string {
  return JSON.stringify(createTelemetryEvent(input));
}
export * from "./telemetry.ts";
