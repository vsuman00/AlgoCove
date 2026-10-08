# AlgoCove

> A guided Data Structures and Algorithms mastery platform designed for students and job seekers. AlgoCove makes algorithmic thinking, mathematical invariants, and state transitions visible before rewarding code execution.

AlgoCove is built as a modular monolith adhering strictly to the [Design System Specification](DESIGN.md) and approved architectural decisions. It blends a calm, high-efficiency interface (Calm Computational Cove 2.0) with an interactive 3D spatial trace stage, structured invariant checkpoints, a multi-language editor, a capacity-constrained scheduler, and a spaced retrieval review queue.

The application code, authored pilot content, and published local database content have separate lifecycles. A route can be implemented while its library or review queue is empty until governed content is published and learner activity creates records. See the [codebase map](docs/development/codebase-map.md) to find each layer and the [phase ledger](tasks/plan.md) for current implementation status.

---

## Key Capabilities & User Experience

### 1. Interactive 3D Spatial Algorithmic Stages

- **Pedagogical Visualization:** Data structures (arrays, pointers, stacks) render as physical 3D elements suspended in an isometric coordinate space.
- **Camera Presets & Controls:** Instant switching between **Isometric 3D** (`-18°` angle, `24°` tilt), **Top-Down** (`0°`, `45°`), and **Front View** (`0°`, `0°`) with fine-grained rotation and tilt sliders.
- **Live State Arithmetic:** Floating computation callouts dynamically reflect algorithm state in real time (e.g. `Width = distance · Height = min(L, R) · Current Area = width × height` or two-sum convergence).
- **Dual-Pointer Illumination:** Jade (`L`, `#1A8F78`) and Coral (`R`, `#EA580C`) pointers project clear visual contrast onto active candidate elements.
- **Universal Fallback:** Seamlessly toggles to a clean, accessible 2D flat view and honors `@media (prefers-reduced-motion: reduce)`.

### 2. Guided Problem Workspace (`/learn/[problemId]`)

- **Focused Rail-Free Environment:** Maximizes screen real estate and minimizes distraction during complex problem solving.
- **5-Step Reasoning Stepper:** Guides learners sequentially through _Understand_ → _Pseudocode_ → _Trace_ → _Implement_ → _Validate_.
- **Structured Invariant Checkpoints:** Prompts learners to articulate loop invariants, state initialization, and time/space complexity before coding.
- **Multi-Language Code Editor:** Built-in support for **Python**, **JavaScript**, **TypeScript**, **Java**, **C++**, and **C** with 4-space Tab/Shift+Tab indentation and status bar metrics.
- **Durable Work Recovery:** Dual-layer persistence seamlessly saves local recovery to `localStorage` and syncs with durable server storage upon authentication.

### 3. Timeboxed Roadmap Planning (`/plan` & `/roadmap`)

- **Deterministic Capacity Scheduling:** Builds personalized study schedules based on declared daily minutes, study weekdays, and target role across 5 calendar horizons (1, 2, 3, 4, 6 months).
- **Prerequisite DAG Dependencies:** Displays structured learning dependency paths and workload distributions (study minutes vs. recovery buffers).
- **Optional AI Sequencing:** Explicit toggle for heuristic sequencing with deterministic fallback when AI services are offline or unconfigured.

### 4. Spaced Review Queue (`/review`)

- **Retention & Active Recall:** Schedules spaced retrieval practice based on elapsed UTC calendar windows and profile timezones.
- **Confidence Calibration:** Collects self-reported confidence (_Low_, _Medium_, _High_) alongside checked objective rubric answers without artificial vanity scores.

### 5. Learning Analytics & Progress Dashboard (`/progress`)

- **Multi-Dimensional Mastery Ledgers:** Tracks checked concept evidence, pending projections, and language-specific execution pass rates.
- **Timezone-Fenced Study Pauses:** Supports planned pauses (vacations, exam weeks) that preserve study consistency records without guilt or streak shaming.
- **External Practice Journal:** Logs learner-confirmed external practice (e.g., LeetCode, Codeforces) while maintaining strict separation from internal AlgoCove-observed evidence.

### 6. Phase 10 Pilot Curriculum (`/learn` & `/admin/pilot`)

- **Four Canonical Pattern Bundles:** Arrays & Hashing, Two Pointers, Sliding Window, and Monotonic Stack.
- **Author & Review Governance:** Checksum-bound review packets, manual accessibility audit manifests, and export pipelines.

---

## Tech Stack & Architecture

- **Web Application:** [Next.js 16](https://nextjs.org/) (App Router), [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/)
- **Design System:** Calm Computational Cove 2.0 (`--color-ocean-*`, `--color-jade-*`, `--color-coral-*`, `--color-tide-*`, `--color-sand-*`) with custom design token generators ([`tokens.ts`](apps/web/src/styles/tokens.ts))
- **Database & Storage:** PostgreSQL 17 + [`pgvector`](https://github.com/pgvector/pgvector) with strict privilege separation (`operator`, `admin`, `app`)
- **Authentication:** [Clerk](https://clerk.com/) with resilient offline fallback handling (structured HTTP 503 retryable envelopes)
- **Execution Sandbox:** Pinned container profiles and [gVisor](https://gvisor.dev/) (`runsc`) security boundaries for hostile learner code
- **Background Worker:** Outbox relay and asynchronous mastery event processing
- **Testing & Verification:** [Vitest](https://vitest.dev/) (unit, web, architecture, adversarial), [Playwright](https://playwright.dev/) (E2E, accessibility, execution browser audits), and [Axe-core](https://www.deque.com/axe/)

---

## Quick Start

### Prerequisites

- **Node.js**: `>=22.18.0` (see [`.nvmrc`](.nvmrc))
- **pnpm**: `12.4.2` (enforced via `packageManager` in [`package.json`](package.json))
- **Docker**: For running PostgreSQL 17 + pgvector

### 1. Install Dependencies

```sh
npx --yes pnpm@12.4.2 install --frozen-lockfile
```

### 2. Configure Environment

Copy the example environment file once at the repository root:

```sh
cp .env.example .env
```

Use root `.env` for local base settings and optional root `.env.local` for overrides. The web app reads only its allowlisted settings from these files, including for local production builds. An `apps/web/.env.local` copy is unnecessary. If testing Clerk authentication, set the development instance keys in the root file:

```sh
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

### 3. Start Database & Run Migrations

Launch the local PostgreSQL 17 container, bootstrap operator roles, and run schema migrations:

```sh
pnpm db:start
pnpm db:roles
pnpm db:migrate
pnpm db:seed:practice
```

### 4. Start Development Server

```sh
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. System liveness is verified at `/api/health`.

---

## Verification & Testing Commands

AlgoCove maintains comprehensive automated quality gates:

```sh
# Run full static analysis and verification
pnpm verify

# Type checking across root, web, and worker
pnpm typecheck

# Code formatting and token parity
pnpm format:check
pnpm tokens:check

# Unit, architecture, web, retrieval-evaluation, and adversarial tests
pnpm test

# Database integration tests (requires pnpm db:start)
pnpm test:integration

# Build optimized production bundle
pnpm build

# Automated WCAG 2.1 AA accessibility checks via Playwright + Axe-core
pnpm test:a11y

# End-to-end browser test suite
pnpm test:e2e

# Sandboxed execution browser tests
pnpm test:execution-browser

# Dedicated 14-page full browser UI audit
pnpm exec playwright test tests/e2e/all-pages-browser-audit.spec.ts --config tests/e2e/playwright.config.ts
```

---

## Repository Map

The [codebase map](docs/development/codebase-map.md) explains ownership, entry points, local configuration, and what creates runtime data. The root README is the project entry point; the READMEs inside `docs/architecture` and `docs/adr` index those specific collections.

```
AlgoCove/
├── apps/
│   ├── web/app/                # Next.js routes, pages, layouts, and API handlers
│   ├── web/src/                # Reusable UI, adapters, and web-side features
│   └── worker/src/             # Background job and privacy consumers
├── packages/
│   ├── domain/                 # Pure TypeScript domain logic, types, and policies
│   ├── application/            # Use cases, application contracts, and error envelopes
│   ├── content/                # Curriculum definitions and pattern bundles
│   ├── visualizer/             # 2D/3D state trace engine and validation rules
│   ├── tutor/                  # Progressive hint logic and roadmap proposals
│   ├── retrieval/              # Hybrid search and concept mapping
│   ├── db/                     # SQL migrations, repositories, and connection pools
│   ├── config/                 # Fail-closed environment configuration
│   ├── observability/          # Structured telemetry and audit logging
│   └── execution-contracts/    # Host/runner execution message contracts
├── services/
│   ├── execution-control/      # Dispatch, leases, and result reconciliation
│   ├── execution-host/         # Isolated gVisor container runner
│   └── execution-images/       # Verified multi-language runtime profiles
├── content/                    # Authored pilot bundles and collections
├── ops/                        # Alerts, restore drills, and runbooks
├── tests/
│   ├── accessibility/          # Axe-core Playwright accessibility specifications
│   ├── e2e/                    # Playwright end-to-end browser journeys
│   ├── execution-browser/      # Browser test execution runner audits
│   ├── integration/            # PostgreSQL integration tests
│   ├── language-conformance/   # 6-language execution conformance suite
│   └── unit/                   # Vitest unit tests
├── docs/
│   ├── architecture/           # System contracts, design boundaries, runbooks
│   ├── adr/                    # Architectural Decision Records (ADRs)
│   ├── evidence/               # Dated phase records, audits, raw receipts
│   └── development/            # Codebase navigation and setup guidance
├── scripts/                    # Repo checks and local workflows
├── DESIGN.md                   # Canonical visual design system and UX specification
└── tasks/                      # Implementation roadmap, plan, and task ledgers
```

---

## Design System & Accessibility Commitments

- **Calm Computational Cove 2.0:** High-legibility typography ([Instrument Sans](https://github.com/frekyll/instrument-sans), [Fraunces](https://fraunces.undercase.xyz/), [JetBrains Mono](https://www.jetbrains.com/lp/mono/)), calm translucent surfaces, and subtle coastal palette.
- **Universal Visible Focus:** Every interactive control features a high-contrast `2px` focus outline with a `2px` offset (`--action-primary` on light shells, `--color-jade-400` on deep workspaces) adhering to `DESIGN.md` Section 12.1.
- **Zero Ambiguous Iconography:** Every navigation rail row and action button pairs icons with explicit text labels.
- **Motion Safety:** All animations and 3D camera transforms respect `@media (prefers-reduced-motion: reduce)`.
- **Honest Attribution:** External practice references explicitly declare learner confirmation and never claim false live synchronization.
