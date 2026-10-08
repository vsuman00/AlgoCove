# Phase 2 implementation evidence

**Status:** Implementation slices and owner-provided live Clerk verification are complete. F2 is closed for the current local scope, and Phase 3 continuation was authorized by the owner. This record is closed for Phase 2; later execution work remains phase-owned.

## Implemented

- Clerk is the external authentication boundary. A verified Clerk subject maps to a deterministic internal `usr_...` learner ID. AlgoCove roles come from PostgreSQL grants, not provider metadata or browser payloads.
- Learner onboarding validates goal, target role, IANA time zone, daily capacity, planning horizon, accessibility settings, and the six supported language values. Profile writes use optimistic versions and owner checks.
- Roles and permissions are explicit. Authoring, technical review, pedagogical review, and publication are separate content responsibilities and cannot be assigned to one internal identity by the pure domain rule.
- Idempotency claims distinguish first claim, in-progress duplicate, completed replay, failed retry, and request-hash conflict.
- Audit payloads are bounded and redact source code, pseudocode, prompts, credentials, cookies, authorization headers, and token-shaped values. Audit rows are append-only in PostgreSQL.
- Outbox inserts use the same transaction boundary as state changes. Delivery remains at-least-once; no worker is claimed in Phase 2.
- Telemetry is an allowlisted contract retaining correlation, category, event, duration, status, retryability, dependency, and result fields only.

## Evidence run

- `clerk --version`: 3.3.0
- `clerk doctor --json`: pass with expected warnings for no production instance and no zsh completion
- `pnpm verify`: pass
- `pnpm test:all`: pass
- Unit/web/architecture: 70 tests passed
- Isolated PostgreSQL/pgvector integration: 8 tests passed
- Browser accessibility: 9 deterministic Chromium tests passed
- Production build: pass
- Enabled-key liveness smoke: `/api/health` returned 200 with local development keys loaded
- Secret scan and high-severity dependency audit: pass

## Owner manual verification

- The owner manually verified Clerk sign-up and sign-in in the local application.
- The owner verified that the authenticated profile flow works.
- The owner verified that the identity is present in the Clerk database/dashboard.
- The profile persistence boundary is implemented through the Clerk-backed application path and covered by isolated PostgreSQL tests. A separate live SQL inspection of the owner’s database row was not performed in this evidence run.

These observations close the live provider/account evidence for the current F2 local scope. Production deployment, production-key rotation, and hosted operational evidence remain outside this phase.

The API and adapter tests use a verified-Clerk fixture boundary and cover forged-role/provider-metadata negatives. The owner’s manual sign-in/profile verification complements those deterministic tests rather than replacing them.
