import { createHmac, randomBytes } from "node:crypto";
import type { RequestContext } from "@algocove/application";
import { PostgresOperationalRepository } from "@algocove/db";
import {
  serializeOperationalMeasurement,
  type Operation,
  type Outcome,
} from "@algocove/observability";
import { getPracticeRuntime } from "../practice/runtime";
const contexts = new WeakMap<Request, RequestContext>();
const configuredKey = process.env.TELEMETRY_CORRELATION_KEY?.trim();
const correlationKey =
  configuredKey && configuredKey.length >= 32 ? configuredKey : randomBytes(32).toString("hex");
export function rememberTelemetryContext(request: Request, context: RequestContext): void {
  contexts.set(request, context);
}
export async function recordRouteMeasurement(
  request: Request,
  operation: Operation,
  outcome: Outcome,
  durationMs: number,
): Promise<void> {
  const context = contexts.get(request);
  const traceId = context?.traceId ?? `trace_${randomBytes(16).toString("hex")}`;
  const sample = {
    operation,
    outcome,
    durationMs: Math.min(600000, Math.max(0, Math.round(durationMs))),
    traceId,
    requestId: context?.requestId ?? traceId,
    observedAt: new Date().toISOString(),
    ...(context
      ? {
          sessionCorrelation: `corr_${createHmac("sha256", correlationKey).update(context.actor.sessionId).digest("hex")}`,
        }
      : {}),
  };
  process.stdout.write(serializeOperationalMeasurement(sample) + "\n");
  try {
    const runtime =
      context && !["rejected", "cancelled"].includes(outcome) ? getPracticeRuntime() : null;
    if (runtime) await new PostgresOperationalRepository(runtime.pool).record(sample);
  } catch {
    process.stderr.write('{"event":"telemetry.write_failed"}\n');
  }
}
export async function observeRequest<T extends Response>(
  request: Request,
  operation: Operation,
  handle: () => Promise<T>,
): Promise<T> {
  const started = performance.now();
  try {
    const response = await handle();
    await recordRouteMeasurement(
      request,
      operation,
      response.status >= 500 ? "failure" : response.status >= 400 ? "rejected" : "success",
      performance.now() - started,
    );
    return response;
  } catch (error) {
    await recordRouteMeasurement(request, operation, "failure", performance.now() - started);
    throw error;
  }
}
