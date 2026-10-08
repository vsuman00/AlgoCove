import type { Pool } from "pg";
import { operationalMeasurement, type OperationalMeasurement } from "@algocove/observability";
import { withTransaction } from "./transaction.ts";
export type OperationalSnapshot = {
  samples: OperationalMeasurement[];
  lastHeartbeat: number | null;
  oldestPendingDeletion: number | null;
  privacy: { pending: number; held: number };
  learning: { observations: number; self_reports: number; classification: string };
  truncated: boolean;
};
export class PostgresOperationalRepository {
  private readonly pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }
  async record(input: OperationalMeasurement): Promise<void> {
    const sample = operationalMeasurement(input);
    await withTransaction(
      this.pool,
      (tx) =>
        tx.query(
          `INSERT INTO platform.operational_sample(operation,outcome,duration_ms,trace_id,request_id,session_correlation,language,observed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(request_id,operation,outcome) DO NOTHING`,
          [
            sample.operation,
            sample.outcome,
            sample.durationMs,
            sample.traceId,
            sample.requestId,
            sample.sessionCorrelation ?? null,
            sample.language ?? null,
            sample.observedAt,
          ],
        ),
      { statementTimeoutMs: 100 },
    );
  }
  async snapshot(): Promise<OperationalSnapshot> {
    return withTransaction(
      this.pool,
      async (tx) => {
        const rows = (
          await tx.query<{
            operation: OperationalMeasurement["operation"];
            outcome: OperationalMeasurement["outcome"];
            duration_ms: number;
            trace_id: string;
            request_id: string;
            session_correlation: string | null;
            language: string | null;
            observed_at: Date;
          }>(
            "SELECT * FROM platform.operational_sample WHERE observed_at>clock_timestamp()-interval '6 hours' ORDER BY observed_at DESC LIMIT 50000",
          )
        ).rows;
        const heartbeat = (
          await tx.query<{ observed_at: Date }>(
            "SELECT observed_at FROM platform.service_heartbeat WHERE service='content-worker'",
          )
        ).rows[0];
        const privacy = (
          await tx.query<{ oldest: Date | null; pending: number; held: number }>(
            "SELECT min(requested_at) FILTER(WHERE state IN ('pending','purging')) AS oldest,count(*) FILTER(WHERE state IN ('pending','purging'))::int AS pending,count(*) FILTER(WHERE state='held')::int AS held FROM platform.privacy_deletion",
          )
        ).rows[0]!;
        const learning = (
          await tx.query<{ observations: number; self_reports: number }>(
            "SELECT (SELECT count(*)::int FROM practice.learning_observation) AS observations,(SELECT count(*)::int FROM practice.external_practice_event WHERE kind='completed') AS self_reports",
          )
        ).rows[0]!;
        return {
          samples: rows.map((r) =>
            operationalMeasurement({
              operation: r.operation,
              outcome: r.outcome,
              durationMs: r.duration_ms,
              traceId: r.trace_id,
              requestId: r.request_id,
              observedAt: r.observed_at.toISOString(),
              ...(r.session_correlation ? { sessionCorrelation: r.session_correlation } : {}),
              ...(r.language ? { language: r.language } : {}),
            }),
          ),
          lastHeartbeat: heartbeat?.observed_at.getTime() ?? null,
          oldestPendingDeletion: privacy.oldest?.getTime() ?? null,
          privacy: { pending: privacy.pending, held: privacy.held },
          learning: {
            ...learning,
            classification: "learning aggregates; excluded from technical SLOs",
          },
          truncated: rows.length === 50000,
        };
      },
      { isolationLevel: "repeatable read", readOnly: true, statementTimeoutMs: 2000 },
    );
  }
}
