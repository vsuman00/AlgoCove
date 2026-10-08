# Phase 11 local operational policy

Status: implemented local policy `local-privacy.v1` and proposed reliability envelope `local-operational-targets.v1`, 2026-10-07. The owner explicitly authorized full Phase 11 implementation while setting aside the independent Phase 10 publication task. This authorizes local implementation and synthetic verification; it does not supply legal, regional, hosted-retention or production reliability approval. Task 4's hosted decisions remain prerequisites to Phase 12 real-learner deployment.

## Retention and deletion matrix

| Store | Local retention | Account deletion |
| --- | --- | --- |
| Current source/pseudocode drafts and explicit saved source revisions | Existing seven-day expiry; bounded retention sweeps respect unexpired legal/security holds | Purge with dependent artifacts |
| Attempts, sessions, observations, progress/mastery and review projections, schedules and external self reports | Account lifetime; no automatic destruction of learning evidence | Dependency-ordered purge across the explicit 37-table ownership inventory |
| Tutor requests, private retrieval evidence, saved answers and assistance | Account lifetime; request execution leases/timeouts remain separately bounded | Cancel pending work; delete responses/assistance before evidence/requests |
| Execution records and learner output held in the database | Account lifetime | Confirm cancellation at the execution relay before purge; new callbacks/writes are fenced |
| Identity mappings, profiles, active grants, budgets and operation breakers | Account lifetime | Unlink and purge; retain an immutable pseudonymous deleted-account tombstone |
| Private audit, delivery/outbox payloads, worker receipts and idempotency responses | Account lifetime | Remove references to owned identities before completion; public curriculum attribution may retain an unlinked identifier |
| Technical measurements | Seven days; identifiers are server correlation IDs and keyed session hashes | No raw code, prompt, response body, token or direct learner/session identity is collected; bounded expiry sweep |
| Registered database backups | Thirty-day local expiry inventory; actual destruction remains an operator action | Report latest expiry separately from primary completion; never claim a retained backup was erased |
| Minimal deletion ledger and tombstones | Must outlive every backup that can resurrect the account | Keep request/subject pseudonym and request time independently of database snapshots; reapply before restored traffic or workers |
| Browser recovery | Explicit learner opt-in under existing policy | Remove only the signed-in learner's recovery keys and set a local tombstone so stale open tabs cannot recreate recovery copies |

Export/deletion require the SDK's server-verified first-factor authentication within five minutes, exact same-origin POST, bounded input, and the literal deletion confirmation. A client-supplied `recentlyVerified`, learner ID or role cannot grant authority. Export is an owned repeatable-read snapshot with version explanations, limited to 10 MB and 10,000 rows per owned relation; oversized exports fail explicitly rather than silently truncate. Downloads and privacy status use `no-store`. A deleted subject can read its minimal status receipt without recreating its identity mapping.

Holds require an active server-verified `privacy_administrator` grant and recent verification. Holds have legal/security reason codes and a future expiry capped at 90 days; placement/release is audited and serialized with purge. A held account stays blocked. No browser role claim, runtime GUC or stale worker lease can authorize purge.

## Worker and operator setup

Apply migrations as the schema owner. Set a new strong-password `PRIVACY_WORKER_DATABASE_URL` and run `pnpm db:privacy-worker-role` with the operator connection. This provisions a new role and refuses to widen an existing role. Its privileges are limited to minimal deletion/cancellation/backup metadata, heartbeat updates and the scoped security-definer claim/ack/purge/retention functions. It has no direct draft or outbox-payload access. Never put worker/operator credentials in the web or learner execution environment.

`pnpm privacy:consume` processes one job. The CLI durably appends the minimal request to `PRIVACY_DELETION_LEDGER` before purge; its ignored local default is `.tmp/privacy-deletion-ledger/events.jsonl`. A ledger write/fsync or execution cancellation failure leaves the account blocked and the two-minute lease retryable. Schedule repeated bounded invocations to drain jobs. `pnpm privacy:consume --retention` additionally sweeps at most 100 expired records per category; this command is verified against disposable data, not run against real learner drafts during this phase. Preserve the ledger separately from snapshots and restrict file access. A hosted durable ledger store and its expiry/destruction policy require Phase 12 qualification.

Register each backup ID, creation time, checksum and expiry in `platform.privacy_backup`. After authorized actual removal, record `destroyed_at`; never set it merely because a date passed. The two existing local learner backups are registered and preserved. Historical environment copies remain private and are outside the synthetic drill cleanup.

## Reliability and alert envelope

The local evaluator uses 99% success within five seconds for each measured operation, with rejected input and learner cancellation excluded. No samples means null reliability. Workspace save, execution **admission**, roadmap commands, privacy commands and tutor **delivery** are measured at the HTTP boundary; these are not terminal compiler/runtime latency or provider billing metrics. Generated delivery and authored fallback have separate series; fallback is never counted as provider success. Learning observations and external self reports are aggregate product metrics, excluded from technical SLOs.

Request IDs and trace IDs use constrained server identifiers. Session correlation uses HMAC-SHA-256 with a server-only shared `TELEMETRY_CORRELATION_KEY` of at least 32 characters. With no valid key, a per-process random key safely reduces cross-process correlation. Never expose this key through public environment variables. Samples and logs use named projections and finite enums; unexpected fields, arbitrary labels and raw private diagnostic text are rejected/redacted. Collection failures emit a fixed diagnostic and do not discard successful learner work.

Run `pnpm ops:alerts` every minute under the deployment supervisor; exit 2 indicates an actionable symptom, unavailable database or truncated window. Definitions include owner, severity, runbook and degradation/rollback action. The implementation emits structured alerts; no hosted pager or outbound notification has been configured. Only an active operator can read `/api/admin/operations`. The [alert evaluator](../../ops/alerts/README.md) describes burn windows, heartbeat enablement and deletion backlog thresholds.

The [local restore drill](../../ops/restore/README.md) measures a synthetic snapshot and database recovery journey. Its RPO/RTO values are observed local timing, not approved hosted targets. Production builds are served with local test configuration during rollback; hosted TLS, identity, network isolation, load, durable monitoring, PITR and real-provider failure qualification remain Phase 12/Task 57 obligations.

SDK reference: [Clerk reverification](https://clerk.com/docs/guides/secure/reverification) and [useReverification](https://clerk.com/docs/nextjs/reference/hooks/use-reverification).
