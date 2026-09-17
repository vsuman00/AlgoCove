import { describe, expect, it } from "vitest";
import {
  createTelemetryEvent,
  redactTelemetryValue,
  serializeTelemetryEvent,
  TELEMETRY_CATEGORIES,
} from "@algocove/observability";

describe("observability contract", () => {
  it("keeps stable correlation and outcome fields", () => {
    const event = createTelemetryEvent({
      traceId: "trace_12345678",
      requestId: "req_12345678",
      category: TELEMETRY_CATEGORIES.request,
      event: "profile.updated",
      durationMs: 42,
      status: 200,
      result: "success",
    });

    expect(event).toMatchObject({
      traceId: "trace_12345678",
      requestId: "req_12345678",
      category: "request",
      event: "profile.updated",
      durationMs: 42,
      status: 200,
      result: "success",
    });
  });

  it("does not serialize source, prompts, tokens, or arbitrary fields", () => {
    const canary = "CANARY_PRIVATE_SOURCE_DO_NOT_LOG";
    const serialized = serializeTelemetryEvent({
      traceId: "trace_12345678",
      requestId: "req_12345678",
      category: TELEMETRY_CATEGORIES.security,
      event: "auth.rejected",
      // Runtime callers may still pass extra fields through an adapter cast.
      ...( { source: canary, prompt: canary, token: canary } as unknown as Record<string, never>),
    });
    expect(serialized).not.toContain(canary);
    expect(JSON.parse(serialized)).toEqual({
      traceId: "trace_12345678",
      requestId: "req_12345678",
      category: "security",
      event: "auth.rejected",
    });
    expect(redactTelemetryValue({ source: canary, outcome: "denied" })).toEqual({ outcome: "denied" });
  });

  it("bounds invalid telemetry values instead of leaking them", () => {
    const event = createTelemetryEvent({
      traceId: "secret token",
      requestId: "short",
      category: TELEMETRY_CATEGORIES.dependency,
      event: "dependency.timeout",
      durationMs: 999_999,
      status: 700,
      dependency: "postgresql://private",
    });
    expect(event).toEqual({
      traceId: "unknown",
      requestId: "unknown",
      category: "dependency",
      event: "dependency.timeout",
      dependency: "unknown",
    });
  });
});
