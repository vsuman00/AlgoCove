# AlgoCove

AlgoCove is a guided workspace for learning data structures and algorithms through deliberate practice, useful feedback, and well-timed review. The repository is being implemented phase by phase from the approved architecture and design documents.

## Quick start

```sh
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

The web shell runs at `http://localhost:3000`. Liveness is available at `/api/health`; readiness remains unavailable until the local database has been bootstrapped and migrated.

### Clerk development setup

AlgoCove uses the Next.js Clerk variable names. Add the development instance
values to `.env` or `.env.local` before testing sign-in:

```sh
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

Both values are required together. A Vite-style `VITE_CLERK_PUBLISHABLE_KEY`
does not configure this Next.js app.

## Phase 1 database setup

The database uses PostgreSQL 17 with the pinned pgvector image from `compose.yaml`. Bootstrap the operator-owned roles first, then run migrations as the migration role:

```sh
pnpm db:start
pnpm db:roles
pnpm db:migrate
```

`DATABASE_OPERATOR_URL` is used only by role bootstrap. `DATABASE_ADMIN_URL` is the migration/schema-owner connection. `DATABASE_URL` is the runtime connection and cannot create schema or modify migration bookkeeping.

## Verification commands

```sh
pnpm verify
pnpm build
pnpm test:integration
pnpm exec playwright install chromium
pnpm test:a11y
pnpm security:audit
```

`pnpm test:integration` expects the Compose database to be running. `pnpm test:a11y` expects a production build and a locally installed Chromium browser. `pnpm test:all` runs unit/web/architecture tests, database integration tests, the production build, and browser accessibility tests.

## Repository map

- `apps/web`: Next.js delivery shell and route composition.
- `packages/domain`: dependency-free value primitives and authorization vocabulary.
- `packages/application`: request context and stable application error contracts.
- `packages/config`: fail-closed configuration parsing and secret redaction.
- `packages/db`: explicit SQL, role bootstrap, migrations, transactions, and readiness probes.
- `packages/observability`: allowlisted, bounded, privacy-safe telemetry contracts.
- `docs/architecture`: architecture contracts and phase evidence.
- `tasks`: implementation plan and task ledger.

Implementation through Phase 3 is complete for the current local scope. Phase 2 identity, onboarding, authorization, platform primitives, and telemetry contracts are locally validated with owner-verified Clerk account/profile use. Phase 3 governed-content implementation and browser evidence are complete, and Phase 4 transition work is authorized. Runnable content remains intentionally blocked until Task 23 proves isolated six-language execution; Phase 4 execution implementation has not been claimed yet.
