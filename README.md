# AlgoCove

AlgoCove is a guided workspace for learning data structures and algorithms through deliberate practice, useful feedback, and well-timed review. The repository is being implemented phase by phase from the approved architecture and design documents.

## Quick start

```sh
npx --yes pnpm@12.4.2 install --frozen-lockfile
cp .env.example .env
pnpm dev
```

Use Node.js 22 (see `.nvmrc`) and the exact pnpm version in `package.json` for installs and lockfile updates. If your global pnpm is older, use `npx --yes pnpm@12.4.2 <command>`. pnpm 12 records its package-manager dependencies in a separate lockfile document; older pnpm versions can remove that document and break frozen CI installs. CI reads the version from `package.json` and checks that installation leaves the lockfile unchanged.

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

## Local mastery evidence (Phase 6)

After updating an existing database, rerun `pnpm db:roles` before `pnpm db:migrate` to create the mastery schema and grants. `pnpm mastery:consume --limit=100` processes a bounded batch of persisted assessment events using `DATABASE_URL`. `pnpm mastery:rebuild <learnerId> <conceptId>` rebuilds the default projection using `DATABASE_ADMIN_URL`. The consumer is an explicit local command. The [Phase 6 evidence record](docs/architecture/phase6-evidence.md) describes current sources, pending projection responses and remaining work.

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

Phase 4 execution contracts, six-language conformance, and the gVisor candidate matrix have recorded technical evidence. On 2026-09-26, the security owner approved gVisor `runsc` for the dedicated hostile-code execution plane. Phase 5 has completed the localhost guided workspace, isolated host/relay integration, and six-language end-to-end and failure/resume gates. Repository environment files retain learner execution disabled; isolated test composition enables it explicitly. No live deployment is part of the current validation scope. See the [task ledger](tasks/todo.md) for current status.
