# Phase 2 implementation evidence

**Status:** Implementation slices complete; the Clerk CLI app link and local development-key setup are verified. F2 transition gate remains pending live Clerk account verification and owner authorization.

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
- Unit/web/architecture: 51 tests passed
- Isolated PostgreSQL/pgvector integration: 8 tests passed
- Browser accessibility: 6 deterministic anonymous tests passed
- Production build: pass
- Enabled-key liveness smoke: `/api/health` returned 200 with local development keys loaded
- Secret scan and high-severity dependency audit: pass

## Pending F2 evidence

The repository does not contain committed Clerk keys, and no Clerk test account has been provisioned for the browser suite. Therefore the following are intentionally not claimed as validated:

- live Clerk sign-in and sign-up;
- sign-out/session revocation against the provider;
- an authenticated browser journey that creates and updates a profile through Clerk.

The API and adapter tests use a verified-Clerk fixture boundary and cover forged-role/provider-metadata negatives. Use the locally configured development keys and a test account to run the authenticated browser journey before authorizing Phase 3.
