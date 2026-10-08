# Operational alert evaluator

Run `pnpm ops:alerts` using the restricted runtime database connection. It records a bounded database probe, evaluates persisted measurements, and emits only aggregate SLO windows and actionable alerts. Exit 0 means no evaluated symptom; exit 2 means an alert, truncated window or unavailable database. Missing measurements produce null reliability, never a green success rate.

The canonical definitions and thresholds live in `packages/observability/src/telemetry.ts`. A five-minute and one-hour burn of at least 14.4 with twenty samples in both windows raises a request/provider symptom. Content-worker heartbeat is required only with `WORKER_CONTENT_ENABLED=true` and expires after two minutes. A deletion older than 24 hours pages the privacy administrator; held jobs are counted separately. Each alert includes an owner, severity, runbook and recovery action.

A deployment supervisor should invoke this check every minute and route its structured output to the approved alert receiver. This local phase implements and tests the evaluator; it does not configure a hosted pager or send notifications. `/api/admin/operations` offers the same aggregate view to a server-verified, currently granted operator.
