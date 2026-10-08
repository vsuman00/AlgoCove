import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  calculateSlo,
  evaluateOperationalAlerts,
  serializeOperationalMeasurement,
  type OperationalMeasurement,
} from "../../packages/observability/src/telemetry.ts";
const now = Date.parse("2026-10-07T12:00:00Z");
const sample = (
  outcome: OperationalMeasurement["outcome"] = "success",
  operation: OperationalMeasurement["operation"] = "workspace",
): OperationalMeasurement => ({
  operation,
  outcome,
  durationMs: 20,
  traceId: "trace-12345678",
  requestId: "request-12345678",
  observedAt: new Date(now - 1000).toISOString(),
});
describe("safe operational telemetry and alerts", () => {
  it("drops raw code, prompts, sessions, errors, and unexpected fields", () => {
    const data = serializeOperationalMeasurement({
      ...sample(),
      ...({
        source: "PRIVATE_SOURCE",
        prompt: "PRIVATE_PROMPT",
        sessionId: "PRIVATE_SESSION",
        error: "PRIVATE_BODY",
        traceId: "PRIVATE_TRACE",
        requestId: "PRIVATE_REQUEST",
        sessionCorrelation: "PRIVATE_CORRELATION",
      } as object),
    });
    expect(data).not.toMatch(/PRIVATE|source|prompt|sessionId|error/);
  });
  it("does not count fallback as successful provider generation", () => {
    const samples = [sample("fallback", "tutor_provider"), sample("success", "tutor_authored")];
    expect(calculateSlo(samples, "tutor_provider", now, 60000).successRate).toBe(0);
    expect(calculateSlo(samples, "tutor_authored", now, 60000).successRate).toBe(1);
    expect(calculateSlo([], "workspace", now, 60000).successRate).toBeNull();
  });
  it("excludes learner cancellations/rejections and counts slow service success against latency", () => {
    expect(
      calculateSlo(
        [sample("cancelled"), sample("rejected"), { ...sample(), durationMs: 6000 }],
        "workspace",
        now,
        60000,
      ),
    ).toMatchObject({ total: 1, bad: 1, p95Ms: 6000 });
  });
  it("fires actionable burn, heartbeat and privacy alerts only for enabled symptoms", () => {
    const samples = Array.from({ length: 20 }, () => sample("failure"));
    const alerts = evaluateOperationalAlerts({
      samples,
      now,
      workerEnabled: true,
      lastHeartbeat: null,
      oldestPendingDeletion: now - 86400001,
    });
    expect(alerts.map((a) => a.id)).toEqual([
      "request-burn",
      "worker-heartbeat",
      "privacy-backlog",
    ]);
    expect(alerts.every((a) => a.owner && a.severity && a.runbook && a.action)).toBe(true);
    expect(alerts.every((a) => existsSync(resolve(import.meta.dirname, "../..", a.runbook)))).toBe(
      true,
    );
    expect(
      evaluateOperationalAlerts({
        samples: [],
        now,
        workerEnabled: false,
        lastHeartbeat: null,
        oldestPendingDeletion: null,
      }),
    ).toEqual([]);
  });
});
