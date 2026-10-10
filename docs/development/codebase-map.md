# Codebase map

AlgoCove is a pnpm workspace with a Next.js web app, a background worker, shared packages, and an isolated code-execution boundary. Start at the [root README](../../README.md) for setup, the [current plan](../../tasks/plan.md) and [task ledger](../../tasks/todo.md) for status, and the [architecture index](../architecture/README.md) for system boundaries. The [ADR index](../adr/README.md) explains decisions. Dated verification and release records live in [evidence](../evidence/README.md); those records do not themselves publish content or authorize a hosted release.

## Where code lives

| If you are changing... | Start here | Responsibility |
|---|---|---|
| A URL, page, layout, or HTTP endpoint | [`apps/web/app`](../../apps/web/app) | Next.js App Router file-based routes. `page.tsx` maps to a page and `api/**/route.ts` maps to an API endpoint. |
| A reusable web component | [`apps/web/src/components`](../../apps/web/src/components) | UI grouped by `shell`, `account`, `home`, `learning`, `practice`, `planning`, `readiness`, `staff`, and `tutor`. |
| Web-side feature logic | [`apps/web/src`](../../apps/web/src) | Auth, adapters, content, drafts, mastery, planning, practice, tutor, operations, and styles. |
| A learning or business rule | [`packages/domain`](../../packages/domain), [`packages/application`](../../packages/application) | Pure policy and use cases shared across entry points. |
| Content and persistence | [`content`](../../content), [`packages/content`](../../packages/content), [`packages/db`](../../packages/db) | Authored bundles, validation/publication rules, SQL migrations, and repositories. |
| Trace, retrieval, tutor, or logging | [`packages/visualizer`](../../packages/visualizer), [`packages/retrieval`](../../packages/retrieval), [`packages/tutor`](../../packages/tutor), [`packages/observability`](../../packages/observability) | Shared capabilities behind application contracts. |
| Background work | [`apps/worker/src`](../../apps/worker/src) | Durable consumers, including privacy jobs. |
| Learner-code execution | [`services/execution-control`](../../services/execution-control), [`services/execution-host`](../../services/execution-host), [`services/execution-images`](../../services/execution-images), [`packages/execution-contracts`](../../packages/execution-contracts) | Dispatch and leases, isolated runner, pinned language images, and message contracts. |
| Operational workflows | [`ops`](../../ops), [`scripts`](../../scripts) | Alerts, restore drills, staging preflight, security/documentation checks, and local verification. |
| Hosted configuration and deployment | [`packages/config`](../../packages/config), [`ops/environments/staging`](../../ops/environments/staging), [staging guide](../deployment/staging.md) | Hosted web admission, read-only environment checks, deployment decisions and qualification status. |
| Tests | [`tests`](../../tests) | Unit/web, architecture, integration, browser, accessibility, conformance, and sandbox checks. |
| CI or old experiments | [`.github/workflows`](../../.github/workflows), [`spikes`](../../spikes) | Automation definitions and recorded execution-boundary investigations; spikes are not runtime code. |

`apps/web/app` and `apps/web/src` are both needed: the first is Next.js routing convention, while the second holds code reused by those routes. For example, [`/learn`](../../apps/web/app/learn/page.tsx) composes a learning component from [`src/components/learning`](../../apps/web/src/components/learning); catalog queries go through [`/api/learning/problems`](../../apps/web/app/api/learning/problems/route.ts), web practice adapters, and the database repositories. Follow this path when debugging an empty page before changing its UI.

## Files that look similar

- Root [`README.md`](../../README.md) is the repository entry point. [`docs/architecture/README.md`](../architecture/README.md) and [`docs/adr/README.md`](../adr/README.md) are indexes for their respective document sets; the [evidence index](../evidence/README.md) maps verification records.
- Root [`.env.example`](../../.env.example) is the tracked template. Root `.env` holds local base settings; root `.env.local` may override them. Both are ignored by Git. The development server and [build wrapper](../../scripts/build-web.mjs) read only web-owned keys from the root files, with already injected environment variables taking precedence. `next start` uses explicitly injected production settings. Do not duplicate local env files inside `apps/web`. Operator, admin, and privacy-worker credentials are not copied into the web process.
- Authored definitions under `content/` and implementation under `packages/` do not equal published database rows. Curriculum and sheets require governed publication; Review needs an authenticated learner and eligible activity. Check the relevant API/database state before treating an empty page as a missing feature.
- `node_modules/` and `.next/` are generated dependency/build output. Playwright results and one-off analysis output belong under ignored `.tmp/`, not at the repository root. These files are not part of the source layout.

## Verification

Run `pnpm verify` for formatting, lint, types, tokens, core tests, links, and secret checks. Use `pnpm test:integration` with a local database, `pnpm build` for the production web bundle, and `pnpm test:e2e` or `pnpm test:a11y` when routes or UI behavior change. The root [`package.json`](../../package.json) lists the exact commands.
