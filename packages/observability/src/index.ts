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

const SAFE_ID = /^[A-Za-z0-9._-]{8,128}$/;
const SAFE_LABEL = /^[a-z][a-z0-9._-]{1,79}$/;

function boundedId(value: string | undefined): string {
  return value !== undefined && SAFE_ID.test(value) ? value : "unknown";
}

function boundedLabel(value: string, fallback: string): string {
  return SAFE_LABEL.test(value) ? value : fallback;
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
export function redactTelemetryValue(value: unknown): unknown {
  if (typeof value === "string") {
    if (
      /(bearer\s+|token|secret|password|cookie|authorization|postgres(?:ql)?:\/\/|-----begin)/i.test(
        value,
      )
    ) {
      return "[redacted]";
    }
    return value.length > 500 ? `${value.slice(0, 499)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return typeof value === "number" && !Number.isFinite(value) ? "[invalid-number]" : value;
  }
  if (Array.isArray(value)) return value.slice(0, 32).map(redactTelemetryValue);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            !/(token|secret|password|cookie|authorization|source|code|prompt|body)/i.test(key),
        )
        .slice(0, 32)
        .map(([key, nested]) => [key, redactTelemetryValue(nested)]),
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
    category: input.category,
    event: boundedLabel(input.event, "unknown"),
    ...(durationMs === undefined ? {} : { durationMs }),
    ...(status === undefined ? {} : { status }),
    ...(input.retryable === undefined ? {} : { retryable: input.retryable }),
    ...(input.dependency === undefined
      ? {}
      : { dependency: boundedLabel(input.dependency, "unknown") }),
    ...(input.result === undefined ? {} : { result: input.result }),
  };
}

/** Serialize only the stable telemetry allowlist; unknown fields are dropped. */
export function serializeTelemetryEvent(input: TelemetryEventInput): string {
  return JSON.stringify(createTelemetryEvent(input));
}
