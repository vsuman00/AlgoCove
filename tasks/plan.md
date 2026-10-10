**Current phase (2026-10-10):** The owner authorized Phase 12: “now go to phase 12, I approved”. Task 55 is in progress. Vercel project `algocove` now has a protected Singapore Preview deployment with passing web health, database readiness, Clerk form and signed-out authorization smoke checks. The owner uploaded the prepared web environment manually. Neon Free Singapore is provisioned with 40 migrations and restricted runtime/TLS qualification within the approved $0 budget. Execution/worker infrastructure, environment security review, authenticated lifecycle and hosted policy/assurance decisions remain pending. [Staging implementation](../docs/deployment/staging.md) and [exact deployment evidence](../docs/evidence/phases/phase12-evidence.md) separate web smoke verification from full pilot qualification. Phase 11 remains complete for local engineering; earlier preparation notes below are historical.

**Version-control publication (2026-10-08):** The owner authorized committing and pushing all accumulated project changes to GitHub and running the CI pipeline. This supersedes earlier keep-local/uncommitted instructions for repository publication. Independent curriculum publication, live AI, and hosted deployment remain separate gates. GitHub Actions records remote verification for the pushed revision.

# AlgoCove phased implementation plan

**Current release preparation (2026-10-07):** Owner approval for Phase 11 preparation is recorded. The persistent local database is backed up, migrated through 0038 and verified with restricted runtime access. Actual independent publication remains pending authenticated staff assignments and checksum-bound reviews; see [release readiness](../docs/evidence/phases/phase10-release-readiness.md).

**Phase 10 extension authorization (2026-10-07):** The owner instructed completion of the newly added Phase 10 tasks before Phase 11 and authorized building against the updated architecture. Tasks 45b–45g and 50a–50c are now authorized local implementation scope. Follow the [bounded work cards](../docs/architecture/work-cards/phase10-platform-extension.md) and [shared learning contract](../docs/architecture/shared-learning-contract.md). Keep existing local work uncommitted/unpushed; live AI, independent publication signatures, Phase 11 and hosted deployment remain separate. Historical proposal-only notes below describe the earlier documentation update, not the current authorization. [Completion evidence](../docs/evidence/phases/phase10-platform-extension-evidence.md) closes C1–C10 and Tasks 45b–45g/50a–50c for local engineering; independent publication and later-phase work remain separate.

**Historical journey coverage expansion (2026-10-07):** The [website journey contract](../docs/architecture/website-journeys-and-coverage.md) maps 19 feature journeys and 19 edge/exit cases to tasks. Additional proposed work covers shell/auth return, authoring preflight, recovery, private/shared sheets and broader interviews. This is documentation-only scope. Existing approvals and implementation evidence are unchanged.

**Documentation revision (2026-10-07):** The owner requested architecture/build-document changes only. Tasks 45b–45e, 50a–50b and Phase 14 are proposed additions from the [learning platform design](../docs/architecture/learning-platform-evolution-2026-10-07.md). This published proposal does not itself authorize implementation. Local Phase 10 authorization and completion records below take precedence over the earlier unchecked F9 gate; Task 45a live activation remains pending.

**Latest authorized repair (2026-10-03):** The owner reviewed the diagnosis and authorized Ponytail repairs. [Runtime repair evidence](../docs/evidence/audits/runtime-repair-evidence-2026-10-03.md) records configuration, authenticated session recovery, workspace synchronization, published-content withdrawal, diagnostics and CI corrections. Repair commit `2803c23` passed all three CI jobs including both mandatory actual Linux learning-loop scenarios. Application repair commit `0f8b7a5` also passed all three jobs in CI run 37104114731, with both real Linux scenarios and fresh isolation evidence. U4/U6/U8 are complete for this repair scope; historical manual/design approvals remain separate. No deployment is authorized.

**Current implementation evidence:** [Real product and 3D UI record](../docs/evidence/phases/phase7-production-ui-evidence-2026-10-03.md) supplements the historical audit with persisted content administration, release identity persistence and the new mandatory Linux guided-loop gate. Final CI status is recorded there.

**Current work (owner approval, 2026-10-06):** Phase 9 is approved for entry into Phase 10. Implement Tasks 46–50 with AI-off; credentials may follow later. [Phase 10 implementation and review evidence](../docs/evidence/phases/phase10-evidence.md) separates automated technical results from pending human publication, outbound-mapping and manual assistive-technology reviews. Phase 11 preparation was subsequently authorized on 2026-10-07; hosted deployment remains outside the approved scope.

**Cumulative audit (2026-10-03):** [The through-Phase-7 audit](../docs/evidence/audits/through-phase7-audit-2026-10-03.md) records fresh passing technical gates, every named test, Phase 0 approval gaps, unreconciled Phase 1–5 plan checkboxes, open UI fidelity/manual accessibility and the two current-head real-host skips. Technical phase closure must not be read as complete governance or full design validation.

**Status:** Phase 7 Tasks 34–37 and 51 have recorded local technical implementation evidence as of 2026-10-03. The subsequent authorized GUI/execution repairs are complete for their recorded scope; see the runtime repair evidence. Historical manual/design approvals remain separate. The reviewed pilot is explicit; insufficient breadth returns a reasoned rejection. The owner authorized Phase 8 implementation on 2026-10-06; Tasks 38–40 are complete locally with connected review-scheduling, bypass, telemetry and visual real-link evidence; Phase 9 was authorized on 2026-10-06; Tasks 41–45 are complete locally for worker infrastructure, governed index candidates, hybrid retrieval/evidence, validated tutor delivery with authored fallback and versioned evaluation/promotion gates; Task 45a now has locally implemented and synthetic-verified gateway composition, opt-in, promotion/budget gates and preserved baseline/acceptance; live activation remains pending the named provider/data-policy decision. The owner subsequently approved Phase 10; Tasks 46–50 have local technical implementation and automated verification, with F10 human reviews still open. No hosted deployment is authorized.
**Prepared:** 2026-09-17  
**Scope:** Phase 10 Tasks 46–50 implementation and verification are authorized. Phase 9 publication was completed separately. Human publication reviews, live AI approval, Phase 11 and hosted deployment remain separate gates.
**Task ledger:** `tasks/todo.md`

## 1. Outcome

Build AlgoCove incrementally from an empty repository into a validated hosted pilot without implementing the whole platform at once. Every phase must leave a coherent, testable system and pass a human checkpoint before the next phase begins.

The implementation must preserve these non-negotiable boundaries:

- Python, JavaScript, TypeScript, Java, C++, and C are first-class learner languages.
- The core is a modular monolith; hostile code execution is a separate trust boundary.
- PostgreSQL is the source of truth; pgvector is the initial dense-search extension.
- Learning policy, hint ceilings, mastery, publication, rights, and roadmap validation are deterministic application logic.
- AI proposes and explains; it does not authorize, publish, score, or verify external work.
- LeetCode and similar sites are outbound-only practice destinations. AlgoCove stores source links and learner-confirmed journal entries, not provider credentials or synchronized submissions.
- Core learning remains usable with reviewed authored content when AI is unavailable.

Detailed edge-case behavior is normative in [implementation contracts](../docs/architecture/implementation-contracts.md); the review and remaining validation risks are in [review findings](../docs/architecture/review-findings.md). Approved visual direction comes from [DESIGN.md](../DESIGN.md).

Task IDs are stable identifiers, not execution order. Follow document order and dependencies, including suffix tasks. Task 51 intentionally moves before live AI. Large content/runtime tasks are work packages: before coding, record one bounded subcard per runtime or problem, exact files, fixtures, failure cases, and acceptance evidence. No broad directory is permission to implement the whole package in one go.

## 2. Delivery milestones

| Milestone | End phase | Demonstrable result |
|---|---:|---|
| M0: Approved build contract | 0 | Product scope, local contracts, provider-decision deadlines, privacy baseline, runtime candidates and quality commands are approved |
| M1: Safe local foundation | 3 | Authenticated profile plus reviewed draft content and one complete six-language contract; runnable publication waits for Phase 4 conformance |
| M2: Learning kernel | 5 | Learner can plan, code, run, visualize, use bounded hints, and submit one internal problem in any supported language |
| M3: Adaptive practice companion | 8 | Learner receives a timeboxed plan, completes internal readiness, opens the source LeetCode link, and records self-reported follow-through |
| M4: Grounded learning product | 10 | Tutor/RAG, four initial pattern packs, reviews, accessibility, and evaluation gates work against reviewed content |
| M5: Hosted pilot candidate | 12 | Privacy, hosted identity, restore, security, load, SLO, runbook, rollout, and rollback evidence pass for a scoped four-pattern pilot |
| M6: Coverage-qualified course | 13 | Approved DSA track breadth and truthful sheet coverage support the offered plans; learning claims require learner evidence |
| M7: DSA interview preparation (proposed) | 14 | Reviewed timed DSA sessions and evidence-based debriefs pass their own release gate |
| M8: Broader interview preparation (proposed) | 15 | Separately reviewed code review, LLD and system design modes pass scope-specific gates |

## 3. Dependency graph

```text
Phase 0 decisions and approval
  -> Phase 1 repository foundation
    -> Phase 2 identity and platform primitives
      -> Phase 3 governed curriculum/content contracts
        -> Phase 4 isolated six-language execution
          -> Phase 5 guided internal learning loop
            -> Phase 6 mastery, review, progress
              -> Phase 7 timeboxed roadmap planning
                -> Phase 8 outbound external practice handoff
                  -> Phase 9 grounded tutor and retrieval
                    -> Phase 10 pilot curriculum and accessibility
                      -> Phase 11 privacy and operations
                        -> Phase 12 hosted pilot assurance
                          -> Phase 13 approved curriculum expansion and coverage-qualified release
                            -> Phase 14 DSA interview preparation (proposed; separate owner gate)
                              -> Phase 15 broader interviews (proposed; separate owner gate)
```

Safe parallel work begins only after contracts are frozen:

- Runtime images can be implemented in parallel after Task 20.
- Renderer work can run beside attempt-domain work after Task 24.
- Individual content problem bundles can run in parallel after Tasks 45c/45e and the first Task 46 bundle establish the shared contract.
- Infrastructure preparation can begin beside assurance work only after Task 52, but rollout remains sequential.

## 4. Planned repository and command contract

The target layout follows the architecture source of truth:

```text
apps/web
apps/worker                       introduced only when durable jobs require it
services/execution-control
services/execution-images
packages/domain
packages/application
packages/db
packages/config
packages/content
packages/execution-contracts
packages/visualizer
packages/retrieval
packages/tutor
packages/observability
tests/architecture
tests/integration
tests/e2e
tests/language-conformance
tests/sandbox-security
tasks
```

The commands below are implemented in the root package manifest. Their existence alone is not passing-test evidence; dated phase records and the cumulative audit record their results. Phase 0's formal toolchain approval remains open in the ledger. The command surface is:

```text
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:architecture
pnpm test:integration
pnpm test:e2e
pnpm test:conformance
pnpm test:sandbox
pnpm test:retrieval-eval
pnpm test:adversarial
pnpm test:accessibility
pnpm build
pnpm docs:check
```

If a different package manager or test runner is approved, change these names once in Task 2 and keep the semantic gates unchanged.

## 5. Definition of done for every implementation task

A task is complete only when:

- its acceptance criteria are demonstrated;
- focused tests pass, then the relevant phase gate passes;
- lint, formatting, types, and architecture boundaries remain clean;
- authorization, validation, idempotency, privacy, accessibility, telemetry, and failure behavior are handled where applicable;
- documentation and contract fixtures are updated in the same change;
- no deferred behavior is described as implemented or validated;
- the phase is reported complete only after its human checkpoint is approved;
- changed screens comply with DESIGN.md, including keyboard, narrow-screen, reduced-motion, loading, empty, error and recovery states.

Review the evidence after every two or three task slices. Replan if assumptions fail; do not add features merely to fill a phase.

## Phase 0: Resolve gates and freeze the build contract

### Task 1: Approve product semantics and launch slice

**Description:** Resolve A0-A2 and P0-P4 items that materially change implementation: learner audience, individual-only versus organizations, minors, initial modes, four initial patterns, external handoff semantics, and first hosted-pilot boundary.

**Acceptance criteria:**
- [ ] Architecture and product gate checklists record accepted, revised, deferred, or rejected outcomes.
- [ ] V1/pilot scope and explicit non-goals are unambiguous.
- [ ] ADR-0001 through ADR-0014 have deliberate statuses.

**Verification:**
- [ ] `pnpm docs:check` after Task 2 establishes the command; before then run local Markdown link/fence checks.
- [ ] Manual review confirms no unresolved decision is silently assumed by Phase 1.

**Dependencies:** None  
**Files likely touched:** `docs/architecture/README.md`, `docs/architecture/product-plan-and-closure-matrix.md`, `docs/adr/README.md`  
**Estimated scope:** Medium

### Task 2: Freeze the development toolchain and command surface

**Description:** Approve the package manager, supported Node runtime, Next.js/TypeScript baseline, test runners, database migration approach, SQL access strategy, formatting/linting, browser-test tooling, and dependency-update policy. Prefer a plain pnpm workspace and avoid orchestration tooling until measured need.

**Acceptance criteria:**
- [ ] One decision record lists the selected tools, supported runtime range, upgrade policy, and rejected alternatives.
- [ ] Every planned quality command has one owner and one intended purpose.
- [ ] No framework or ORM type is allowed to enter domain contracts.

**Verification:**
- [ ] Toolchain decision is reviewed against ADR-0001 and ADR-0003.
- [ ] Planned command names in this document are updated if needed.

**Dependencies:** Task 1  
**Files likely touched:** `docs/adr/0015-development-toolchain.md`, `tasks/plan.md`, `tasks/todo.md`  
**Estimated scope:** Small

### Task 3: Define local adapter contracts and provider decision deadlines

**Description:** Freeze local substitutes, identity/model ports and runtime candidates. Record named decision owners and deadlines: sandbox choice before Task 19, runtime pins before Task 22, model/data policy before live Task 44, hosted identity and infrastructure before Task 55. Do not require a cloud purchase to begin local work.

**Acceptance criteria:**
- [ ] Sandbox decision criteria address isolation, language support, latency, cost, region, observability, and provider exit.
- [ ] Every runtime/compiler version has a patch and retirement policy.
- [ ] Provider credentials and SDK types terminate at adapters.

**Verification:**
- [ ] Security review maps the choice to ADR-0011 controls.
- [ ] A proof-of-capability checklist exists for all six languages.

**Dependencies:** Tasks 1-2  
**Files likely touched:** `docs/adr/0016-provider-and-runtime-baseline.md`, `docs/architecture/security-reliability-operations.md`  
**Estimated scope:** Medium

### Task 4: Freeze privacy, retention, budgets, and pilot targets

**Description:** Decide safe local retention and synthetic-data policy now; assign deadlines before real learner data for hosted retention, deletion, region/privacy regime and recruiter-facing scope. Set proposed AI/execution budgets and SLO/RPO/RTO targets. Unresolved hosted choices block hosted work, not fixture-only local work.

**Acceptance criteria:**
- [ ] Retention matrix covers attempts, code, conversations, execution output, telemetry, audit, and backups.
- [ ] AI/execution budgets have learner, daily, environment, and global limits.
- [ ] Pilot targets are labelled proposals until measured.

**Verification:**
- [ ] Privacy and reliability owner review is recorded.
- [ ] No hosted-pilot task depends on an unresolved legal or retention decision.

**Dependencies:** Tasks 1 and 3  
**Files likely touched:** `docs/architecture/security-reliability-operations.md`, `docs/architecture/data-and-ai-architecture.md`, `docs/adr/0017-pilot-policy-baseline.md`  
**Estimated scope:** Medium

### Checkpoint G0: Build authorization

- [ ] Tasks 1-4 are approved.
- [ ] A0-A2 and P0-P4 are accepted or explicitly narrowed.
- [ ] Human owner authorizes Phase 1 only.

## Phase 1: Establish the repository foundation

### Task 5: Create root workspace and quality manifests

**Description:** Initialize Git if still absent, then create the pnpm workspace, root TypeScript configuration, formatting/linting configuration, package scripts, environment example, contribution instructions, and a basic pull-request CI workflow without adding business behavior.

**Acceptance criteria:**
- [ ] Fresh install is deterministic from the lockfile.
- [ ] Format, lint, typecheck, test, build, and docs commands exist.
- [ ] Baseline CI runs the quality commands plus secret/dependency checks; secrets and generated files are excluded safely.

**Verification:**
- [ ] Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm test`.
- [ ] Fresh-clone setup instructions are manually followed in a temporary directory.

**Dependencies:** Checkpoint G0  
**Files likely touched:** `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.github/workflows/ci.yml`  
**Estimated scope:** Medium

### Task 6: Create the minimal web application shell

**Description:** Add the Next.js application shell with health/readiness routes, accessible base layout, error boundary, and no product-specific features.

**Acceptance criteria:**
- [ ] App starts locally and renders an accessible shell.
- [ ] Health and readiness have distinct semantics.
- [ ] No database, AI, or execution dependency is required for the health endpoint.

**Verification:**
- [ ] Run focused web tests and `pnpm build`.
- [ ] Manually verify keyboard navigation and failure boundary.

**Dependencies:** Task 5  
**Files likely touched:** `apps/web/package.json`, `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`, `apps/web/app/api/health/route.ts`, `apps/web/app/error.tsx`  
**Estimated scope:** Medium

### Task 6a: Integrate approved design tokens and page-shell contracts

**Description:** Extract the approved DESIGN.md tokens, typography, icons and page-shell rules without redesigning its visual direction. Build only assets needed by the next screen.

**Acceptance criteria:**
- [ ] Home, Workspace and Roadmap references have a traceable token/component checklist.
- [ ] No production asset is assumed to exist; missing assets are tracked, not silently substituted.

**Verification:**
- [ ] Compare shell states to approved references at desktop and narrow widths; run keyboard/contrast checks.

**Dependencies:** Task 6  
**Files likely touched:** `apps/web/src/styles/`, `apps/web/src/components/ui/`, `tests/accessibility/design-shell.spec.ts`  
**Estimated scope:** Small to medium; split if it exceeds one testable vertical slice

### Task 7: Create package boundaries and architecture tests

**Description:** Establish domain, application, adapter, and shared-contract packages with dependency rules that enforce `delivery -> application -> domain`.

**Acceptance criteria:**
- [ ] Domain imports no Next.js, database, provider, or telemetry package.
- [ ] Application depends on owned ports, never concrete adapters.
- [ ] Architecture tests fail on a deliberately invalid dependency fixture.

**Verification:**
- [ ] Run `pnpm test:architecture` and `pnpm typecheck`.
- [ ] Review package dependency graph.

**Dependencies:** Task 5  
**Files likely touched:** `packages/domain/package.json`, `packages/application/package.json`, `tests/architecture/import-boundaries.test.ts`, `tsconfig.base.json`  
**Estimated scope:** Medium

### Task 8: Implement validated configuration and request primitives

**Description:** Add fail-closed environment parsing, typed IDs/time/duration values, request context, clock port, stable error envelope, and redaction-safe configuration display.

**Acceptance criteria:**
- [ ] Missing or invalid required configuration fails clearly.
- [ ] Server-controlled UTC time and actor context are mandatory for use cases.
- [ ] Error output contains stable codes and no secret/internal details.

**Verification:**
- [ ] Run unit and property tests for configuration, time, IDs, and error serialization.
- [ ] Run a secret-shaped fixture through logging/error tests.

**Dependencies:** Tasks 5 and 7  
**Files likely touched:** `packages/config/src/index.ts`, `packages/domain/src/primitives.ts`, `packages/application/src/request-context.ts`, `packages/application/src/errors.ts`  
**Estimated scope:** Medium

### Task 9: Establish PostgreSQL, pgvector, migrations, and integration harness

**Description:** Add local PostgreSQL+pgvector development configuration, separate migration/runtime roles, migration runner, transaction helper, and isolated integration-test database lifecycle.

**Acceptance criteria:**
- [ ] Migrations apply from empty and are repeatable in test setup.
- [ ] Runtime role cannot run migrations or bypass schema ownership.
- [ ] Integration tests reset without sharing state across cases.

**Verification:**
- [ ] Run `pnpm test:integration` against a fresh database.
- [ ] Apply migrations from zero and verify pgvector availability.

**Dependencies:** Tasks 5 and 8  
**Files likely touched:** `packages/db/package.json`, `packages/db/src/transaction.ts`, `packages/db/migrations/0001_platform.sql`, `compose.yaml`, `tests/integration/db-lifecycle.test.ts`  
**Estimated scope:** Medium

### Checkpoint F1: Foundation

- [ ] All root quality commands pass.
- [ ] Architecture tests enforce import direction.
- [ ] Web shell builds and database migrations pass from empty.
- [ ] Human owner authorizes Phase 2.

## Phase 2: Identity, authorization, and durable platform primitives

### Task 10: Integrate Clerk identity and actor context

**Description:** Integrate Clerk as the hosted authentication boundary while keeping AlgoCove's internal opaque learner IDs, server-owned roles, and actor context behind an application port. Clerk owns sign-in, sign-out, session rotation, and revocation; AlgoCove never trusts browser-submitted roles, IDs, or provider metadata for authorization.

**Acceptance criteria:**
- [ ] A verified Clerk session maps to one internal opaque learner ID.
- [ ] Actor roles/scopes are loaded server-side and cannot be submitted by the browser or Clerk public metadata.
- [ ] Clerk sign-in/sign-out/session behavior is exposed through the approved Next.js integration and has adapter/route fixtures.

**Verification:**
- [ ] Run authentication integration tests including forged-role negatives.
- [ ] Manually verify login, logout, and revoked-session behavior.

**Dependencies:** Checkpoint F1  
**Files likely touched:** `apps/web/proxy.ts`, `apps/web/src/auth/clerk-adapter.ts`, `apps/web/app/sign-in/[[...sign-in]]/page.tsx`, `packages/application/src/request-context.ts`, `tests/unit/contracts/clerk-auth.test.ts`
**Estimated scope:** Medium

### Task 11: Deliver learner onboarding and profile preferences

**Description:** Implement the first vertical slice: authenticated learner records goals, timezone, capacity, accessibility settings, and one or more preferred languages.

**Acceptance criteria:**
- [ ] Only the owner can read/update the profile.
- [ ] Language, timezone, capacity, and horizon-related fields validate at the boundary.
- [ ] Updates preserve version/audit metadata.

**Verification:**
- [ ] Run unit, integration, and one browser journey for onboarding.
- [ ] Test invalid timezone, unsupported language, and cross-user access.

**Dependencies:** Tasks 9-10  
**Files likely touched:** `packages/domain/src/learner-profile.ts`, `packages/application/src/profile-use-cases.ts`, `packages/db/migrations/0002_identity.sql`, `apps/web/app/onboarding/page.tsx`, `tests/e2e/onboarding.spec.ts`  
**Estimated scope:** Medium

### Task 12: Implement privileged roles and authorization matrix

**Description:** Add author, technical reviewer, pedagogical reviewer, publisher, evaluator, operator, and privacy-administrator role checks with resource ownership and separation-of-duty tests.

**Acceptance criteria:**
- [ ] Every privileged command has an explicit permission and negative test.
- [ ] Learners cannot enumerate or mutate another learner's resources.
- [ ] Privileged access is audited and never inferred from email domain.

**Verification:**
- [ ] Run authorization matrix unit/integration tests.
- [ ] Review every command in the interface catalog for an owner.

**Dependencies:** Task 10  
**Files likely touched:** `packages/domain/src/authorization.ts`, `packages/application/src/authorize.ts`, `packages/db/migrations/0003_roles.sql`, `tests/integration/authorization.test.ts`  
**Estimated scope:** Medium

### Task 13: Implement idempotency, audit, and transactional outbox foundations

**Description:** Add reusable database-backed idempotency claims, append-only safe audit events, outbox event creation, and reconciliation queries. Do not deploy a worker yet.

**Acceptance criteria:**
- [ ] Same key and payload replays one result; changed payload conflicts.
- [ ] State change and outbox record commit atomically.
- [ ] Audit serialization excludes secrets and raw learner code.

**Verification:**
- [ ] Run duplicate/concurrent idempotency integration tests.
- [ ] Simulate rollback and prove no orphaned event is published.

**Dependencies:** Tasks 8-9 and 12  
**Files likely touched:** `packages/db/migrations/0004_platform.sql`, `packages/application/src/idempotency.ts`, `packages/application/src/audit.ts`, `packages/application/src/outbox.ts`, `tests/integration/platform-primitives.test.ts`  
**Estimated scope:** Medium

### Task 13a: Establish privacy-safe observability before service integration

**Description:** Add correlation IDs, allowlisted error/log fields and source/prompt redaction before execution or provider traffic.

**Acceptance criteria:**
- [ ] No source, pseudocode, token, cookie or model body appears in default telemetry.
- [ ] Synthetic failures retain useful stable error categories and correlation.

**Verification:**
- [ ] Inject sensitive canary strings across API, worker and adapter errors and assert absence from serialized telemetry.

**Dependencies:** Tasks 8 and 13  
**Files likely touched:** `packages/observability/src/redaction.ts`, `tests/integration/log-redaction.test.ts`  
**Estimated scope:** Small to medium; split if it exceeds one testable vertical slice

### Checkpoint F2: Identity and platform integrity

- [ ] Onboarding works end to end.
- [ ] Cross-user and privilege negative tests pass.
- [ ] Idempotency/audit/outbox concurrency fixtures pass.
- [ ] Human owner authorizes Phase 3.

## Phase 3: Governed curriculum, problems, and external references

### Task 14: Implement versioned concept and curriculum graph

**Description:** Add stable concepts, immutable curriculum versions, prerequisite edges, objectives, and cycle-safe publication validation.

**Acceptance criteria:**
- [ ] Published graph versions are immutable and acyclic.
- [ ] Required, recommended, and related edges remain distinguishable.
- [ ] Historical sessions can resolve their pinned graph version.

**Verification:**
- [ ] Run graph unit/property tests, including cycle and version fixtures.
- [ ] Run migration integration tests.

**Dependencies:** Checkpoint F2  
**Files likely touched:** `packages/domain/src/curriculum.ts`, `packages/db/migrations/0005_curriculum.sql`, `packages/application/src/curriculum-use-cases.ts`, `tests/unit/curriculum.test.ts`  
**Estimated scope:** Medium

### Task 15: Implement immutable content/problem lifecycle and provenance

**Description:** Add stable content/problem identities, immutable versions, provenance/license metadata, checksums, review records, and draft-to-retired lifecycle policy.

**Acceptance criteria:**
- [ ] Publication fails without provenance, technical review, pedagogical review, and validation.
- [ ] Published payload cannot be edited; changes create a version.
- [ ] Rights withdrawal blocks new use and preserves safe historical references.

**Verification:**
- [ ] Run lifecycle transition and authorization tests.
- [ ] Test original, licensed, expired-rights, and rejected-content fixtures.

**Dependencies:** Tasks 12-14  
**Files likely touched:** `packages/domain/src/content.ts`, `packages/db/migrations/0006_content.sql`, `packages/application/src/content-use-cases.ts`, `tests/integration/content-lifecycle.test.ts`  
**Estimated scope:** Medium

### Task 16: Define six-language problem manifests and semantic fixtures

**Description:** Implement versioned language profiles, problem-language manifests, starter/signature contracts, shared semantic fixture IDs, limits profiles, and publication completeness validation.

**Acceptance criteria:**
- [ ] Stable IDs are exactly `python`, `javascript`, `typescript`, `java`, `cpp`, and `c`.
- [ ] One semantic fixture set maps to six explicit harness adapters.
- [ ] Missing language support is visible and blocks general publication.

**Verification:**
- [ ] Run schema/fixture contract tests for all six languages.
- [ ] Test that TypeScript and JavaScript, and C and C++, remain distinct profiles.

**Dependencies:** Task 15  
**Files likely touched:** `packages/execution-contracts/src/languages.ts`, `packages/content/src/problem-manifest.ts`, `packages/db/migrations/0007_language_manifests.sql`, `tests/language-conformance/manifest-contract.test.ts`  
**Estimated scope:** Medium

### Task 17: Implement external references and collection deduplication

**Description:** Add provider references, reviewed HTTPS URLs, attribution, link status, collection membership, and canonical deduplication across Blind-, NeetCode-, Top Interview-, Grind-, and Striver-style lists.

**Acceptance criteria:**
- [ ] External records contain link metadata, not copied protected content.
- [ ] Only allowlisted providers and reviewed canonical URLs can be published.
- [ ] One reference may belong to several collections without duplicating required work.

**Verification:**
- [ ] Run URL/redirect/domain validation tests with malicious fixtures.
- [ ] Run collection overlap/deduplication tests.

**Dependencies:** Task 15  
**Files likely touched:** `packages/domain/src/external-practice.ts`, `packages/db/migrations/0008_external_references.sql`, `packages/application/src/external-reference-use-cases.ts`, `tests/integration/external-references.test.ts`  
**Estimated scope:** Medium

### Task 18: Deliver content author/review/publish vertical slice

**Description:** Build the smallest administration flow that creates a draft, records separate reviews, validates metadata, exercises publication/retirement with fixtures, and previews one original internal problem plus one outbound source reference.

**Acceptance criteria:**
- [ ] Role separation and lifecycle blockers are visible in the UI.
- [ ] Only fixture publication is permitted now; real runnable publication requires Task 23 conformance. All candidates resolve exact version/checksum/provenance.
- [ ] Retired content disappears from new recommendations but retains historical metadata; rights/security tombstones prevent forbidden payload rendering.

**Verification:**
- [ ] Run content lifecycle E2E and negative-role tests.
- [ ] Run `pnpm build` and accessibility smoke checks.

**Dependencies:** Tasks 14-17  
**Files likely touched:** `apps/web/app/admin/content/page.tsx`, `apps/web/app/admin/content/[id]/page.tsx`, `apps/web/src/content/operations.ts`, `packages/db/src/content-repository.ts`, `tests/integration/content-operations.test.ts`, `tests/accessibility/content-operations.spec.ts`
**Estimated scope:** Medium

### Checkpoint F3: Governed content foundation

- [ ] One original problem candidate has complete rights/reviews; runnable publication remains blocked until Task 23.
- [ ] Six-language manifest completeness and external-link boundaries pass.
- [ ] No third-party statement, solution, test, or credential is stored.
- [ ] Human owner authorizes Phase 4.

## Phase 4: Prove isolated six-language execution

### Task 19: Complete the sandbox selection spike

**Description:** Prove the approved gVisor-class, microVM-class, or managed execution option using one hostile fixture and one normal fixture per language family before building the control plane.

**Acceptance criteria:**
- [ ] Network, credentials, host mounts, runtime sockets, and metadata access are absent.
- [ ] CPU, wall time, memory, PID, filesystem, and output limits are enforceable.
- [ ] Startup latency, concurrency, cost, patching, and observability are measured.

**Verification:**
- [ ] Produce a versioned spike report with commands and results.
- [ ] Security owner approves, rejects, or narrows the sandbox choice.

**Dependencies:** Tasks 3 and 16; Checkpoint F3  
**Files likely touched:** `spikes/execution-sandbox/README.md`, `spikes/execution-sandbox/fixtures/`, `docs/adr/0016-provider-and-runtime-baseline.md`  
**Estimated scope:** Medium

### Task 20: Implement signed execution contracts

**Description:** Define server-owned run descriptor, limits, compile/run phases, terminal categories, cancellation, signed result, and schema-version compatibility.

**Acceptance criteria:**
- [ ] Learner-controlled fields are limited to source and selected published language.
- [ ] Descriptor binds run, manifest, image digest, source checksum, limits, and expiry.
- [ ] Results distinguish learner failures from infrastructure failures; key rotation, expiry and lease epochs reject stale/forged outcomes.

**Verification:**
- [ ] Run schema, signature, expiry, replay, and tamper tests.
- [ ] Compatibility fixture covers current and rejected versions.

**Dependencies:** Tasks 8, 16, and 19  
**Files likely touched:** `packages/execution-contracts/src/run-descriptor.ts`, `packages/execution-contracts/src/result.ts`, `packages/execution-contracts/src/signing.ts`, `tests/unit/execution-contracts.test.ts`  
**Estimated scope:** Medium

### Task 21: Implement execution-control admission and lifecycle

**Description:** Add the separate execution-control service with internal authentication, per-user/profile quotas, idempotent admission, bounded scheduling, cancellation, terminal-result correlation, and orphan reconciliation. Activate the application-owned PostgreSQL relay now using signed fixture descriptors; execution control keeps a separate run/lease journal with no application-table access.

**Acceptance criteria:**
- [ ] Browser cannot call execution control directly.
- [ ] Duplicate dispatch has deduplicated terminal effects and fenced leases; do not promise exactly-once physical execution.
- [ ] Lost-host uncertainty reaches a terminal infrastructure error within a bounded reconciliation deadline; no replacement starts while the old job may still execute.

**Verification:**
- [ ] Run service contract and concurrency tests.
- [ ] Fault-inject cancellation, lost response, duplicate result, and teardown failure.

**Dependencies:** Tasks 13, 13a and 20  
**Files likely touched:** `services/execution-control/src/server.ts`, `services/execution-control/src/admission.ts`, `services/execution-control/src/lifecycle.ts`, `tests/integration/execution-control.test.ts`, `apps/worker/src/outbox-relay.ts`  
**Estimated scope:** Medium

### Task 22: Build pinned runtime images for all six languages

**Description:** Create minimal immutable profiles for Python, JavaScript, TypeScript, Java, C++, and C with direct argument-vector commands, approved libraries, non-root users, read-only roots, SBOM/provenance, and exact diagnostics.

**Acceptance criteria:**
- [ ] Each profile records compiler/runtime version and immutable digest.
- [ ] TypeScript has a distinct type-check/transpile phase.
- [ ] No profile permits package installation, network access, or learner-selected flags.

**Verification:**
- [ ] Build, scan, sign, and smoke-test every image.
- [ ] Run representative compile/syntax/runtime failure fixtures per profile.

**Dependencies:** Tasks 3, 19, and 20  
**Files likely touched:** `services/execution-images/python/`, `services/execution-images/javascript-typescript/`, `services/execution-images/java/`, `services/execution-images/c-cpp/`  
**Estimated scope:** Parent package; mandatory bounded subcards 22-Python, 22-JS-TS, 22-Java and 22-C-CPP, each with its own build/scan/compile/runtime/limit evidence. TypeScript and C remain distinct conformance targets.

### Task 23: Prove semantic conformance across six languages

**Description:** Execute one original internal problem's shared fixture set through all six manifests and prove equivalent pass/fail meaning, normalized diagnostics, limits, and result lineage.

**Acceptance criteria:**
- [ ] All six harnesses use the same semantic fixture IDs.
- [ ] Equivalent correct/incorrect solutions produce equivalent outcome categories.
- [ ] Every result resolves manifest, harness, limits, image, and policy versions. A trusted judge outside the sandbox compares outputs; no candidate verdict is accepted.
- [ ] Numeric width, Unicode, mutation, ordering, float tolerance and serialization semantics are explicit; limits are calibrated by runtime.
- [ ] The first runnable content version can publish only after this report and all reviews pass.

**Verification:**
- [ ] Run `pnpm test:conformance` from clean images.
- [ ] Review an equivalence report with per-language differences; test spoofed verdicts, malformed output and expected-value isolation.

**Dependencies:** Tasks 16 and 20-22  
**Files likely touched:** `tests/language-conformance/fixtures/`, `tests/language-conformance/solutions/`, `tests/language-conformance/conformance.test.ts`, `packages/content/fixtures/seed-problem/`  
**Estimated scope:** Medium

### Task 24: Pass sandbox abuse and execution-port contract gates

**Description:** Add escape, egress, metadata, fork/thread bomb, memory/CPU/disk/output flood, path traversal, symlink, residue, signal, cancellation, and teardown fixtures; test the execution port using fixture-owned descriptors only. Real attempt/editor integration belongs to Task 25a after its domain exists.

**Acceptance criteria:**
- [ ] Abuse fixtures cause bounded safe terminal outcomes with no escape, egress, or residue.
- [ ] The adapter verifies signed results, source/run correlation and cancellation/fencing without requiring future attempt tables.
- [ ] Infrastructure errors never create negative mastery evidence.

**Verification:**
- [ ] Run `pnpm test:sandbox`, `pnpm test:conformance`, and execution integration tests.
- [ ] Run correct and failing fixture submissions in each language.

**Dependencies:** Tasks 21-23  
**Files likely touched:** `tests/sandbox-security/`, `packages/execution-contracts/src/execution-port.ts`, `apps/web/src/adapters/execution-client.ts`, `tests/integration/code-run.test.ts`  
**Estimated scope:** Medium

### Checkpoint F4: Execution safety

- [ ] Six-language conformance is green.
- [ ] Sandbox security and teardown gates are green.
- [ ] No learner code runs in Next.js, worker, browser origin, or database host.
- [ ] Human security review authorizes Phase 5.

## Phase 5: Deliver the guided internal learning loop

**Evidence alignment (2026-10-01):** Checked criteria below refer to the recorded [localhost Phase 5 evidence](../docs/evidence/phases/phase5-evidence.md) and [task ledger](todo.md). Automated browser suites cover reasoning revision, reduced motion/transcripts and result categories; the original manual checks remain unchecked, including a human screen-reader pass. No hosted deployment is claimed. CI run [36894660888](https://github.com/vsuman00/AlgoCove/actions/runs/36894660888) exposed a missing pnpm 12 package-manager lockfile document and an independent Java gVisor spike failure. The repair preserves frozen installs, bounds Java JVM sizing, aligns the PID ceiling with the approved host (128 rather than 32 after intermittent exit 2 with successful TypeScript boundary output), repeats the full probe three times and adds failure diagnostics; Linux CI revalidation passed in run [36903686854](https://github.com/vsuman00/AlgoCove/actions/runs/36903686854) on `95dd267`: quality (178 tests, 21 PostgreSQL tests, build, 16 accessibility checks and audit), execution images/conformance/abuse, and gVisor (36 repeated normal/hostile cases plus six concurrent startups). Two opt-in real-host integration scenarios remain skipped in ordinary CI; their separate localhost evidence is linked above.

### Task 25: Implement learning-session and attempt state machines

**Description:** Add learning sessions, version-pinned attempts, language/mode selection, meaningful attempt events, optimistic concurrency, abandon/expire behavior, and owner-only history.

**Acceptance criteria:**
- [x] Attempt transitions are monotonic and version-pinned.
- [x] Changing language creates an explicit new attempt/reset path.
- [x] Keystrokes are not retained; saved/final snapshots are policy-controlled.

**Verification:**
- [x] Run state-machine/property and ownership integration tests.
- [x] Test concurrent submit/abandon/run races.

**Dependencies:** Tasks 11, 15-16, and 24  
**Files likely touched:** `packages/domain/src/practice.ts`, `packages/db/migrations/0009_practice.sql`, `packages/application/src/practice-use-cases.ts`, `tests/integration/practice.test.ts`  
**Estimated scope:** Medium

### Task 25a: Connect real attempts to durable execution and trusted results

**Description:** Wire owned attempts and saved source to the existing execution relay; integrate trusted result ingestion and explicit Run versus Submit behavior.

**Acceptance criteria:**
- [x] Submission consumes a result for the exact source checksum, problem, language and manifest version.
- [x] Commit the immutable assessment observation and outbox atomically; begin transaction before row locks.
- [x] Cancellation, stale lease, duplicate result and lost response do not duplicate credit or leak quota.

**Verification:**
- [x] Race run/submit/abandon/edit operations; kill relay and execution host and reconcile.
- [x] Run a correct, wrong and infrastructure-failing attempt in each language.

**Dependencies:** Tasks 21, 24 and 25  
**Files likely touched:** `packages/application/src/code-run-use-cases.ts`, `apps/web/src/adapters/execution-client.ts`, `tests/integration/code-run.test.ts`  
**Estimated scope:** Small to medium; split if it exceeds one testable vertical slice

### Task 25b: Implement recoverable source and pseudocode drafts

**Description:** Implement replaceable debounced current drafts, explicit saved revisions, optimistic revision conflicts and truthful save-state indicators.

**Acceptance criteria:**
- [x] Reload/session expiry does not silently discard confirmed saves; conflicts never overwrite newer drafts.
- [x] No keystroke history; drafts have limits/TTL and private ownership.
- [x] Optional local recovery is learner-scoped and cleared on logout/deletion; shared-device users can disable it.

**Verification:**
- [x] Browser-test two tabs, offline/reconnect, lost save response, expired session and language switch.

**Dependencies:** Tasks 6a, 25 and 25a  
**Files likely touched:** `packages/application/src/save-draft.ts`, `apps/web/src/components/practice/draft-status.tsx`, `tests/e2e/draft-recovery.spec.ts`
**Estimated scope:** Small to medium; split if it exceeds one testable vertical slice

### Task 26: Implement structured pseudocode and readiness evidence

**Description:** Add versioned learner pseudocode fields for inputs, state, initialization, invariant, loop/recurrence, termination, output, and complexity plus explain-back evidence.

**Acceptance criteria:**
- [x] Pseudocode is separate from executable code and supports append-only saved revisions.
- [x] Readiness uses authored structured answer keys and verified runs, not nonempty prose or model opinion. Free-form pseudocode/explain-back feedback is advisory unless human reviewed.
- [x] Tutor access cannot silently rewrite learner artifacts.

**Verification:**
- [x] Run rubric, ownership, version, and privacy tests.
- [ ] Manually complete and revise one pseudocode artifact.

**Dependencies:** Tasks 25 and 25b  
**Files likely touched:** `packages/domain/src/pseudocode.ts`, `packages/db/migrations/0010_pseudocode.sql`, `apps/web/app/learn/[problemId]/pseudocode.tsx`, `tests/integration/pseudocode.test.ts`  
**Estimated scope:** Medium

### Task 27: Implement trace protocol and accessible renderer

**Description:** Implement bounded trace authoring/editing and step replay alongside reviewed canonical traces; label provenance and distinguish schema validity from algorithm correctness. Canonical trace disclosure counts as assistance where it reveals strategy. Arbitrary source-level tracing across six languages is not promised. Add versioned trace events, deterministic reducer, textual transcript, prediction checkpoints, keyboard controls, reduced motion, and initial array/two-pointer renderer.

**Acceptance criteria:**
- [x] Same trace produces deterministic visual and text states.
- [x] Unknown/invalid events fail safely.
- [x] Critical controls work without pointer, color, animation, or sound; unsupported arbitrary learner-code traces fall back to the reviewed reference trace instead of fabricated states.

**Verification:**
- [x] Run reducer/property, snapshot, keyboard, and accessibility tests.
- [ ] Manually verify reduced-motion and screen-reader transcript.

**Dependencies:** Tasks 15-16  
**Files likely touched:** `packages/visualizer/src/trace-schema.ts`, `packages/visualizer/src/reducer.ts`, `packages/visualizer/src/transcript.ts`, `apps/web/src/components/practice/visualizer.tsx`, `tests/unit/visualizer.test.ts`
**Estimated scope:** Medium

### Task 28: Implement deterministic hint ladder and authored fallback

**Description:** Add mode-aware hint ceilings, append-only reveals, authored hint tiers, solution-review gate, and stable refusal/fallback behavior without AI.

**Acceptance criteria:**
- [x] Requested tier above the ceiling is rejected or capped deterministically.
- [x] Assistance is persisted before display and cumulative across retries, language switches and new attempts on the same problem version; client bundles never preload locked hints/solutions.
- [x] Full solution review requires the approved attempt/gate state.

**Verification:**
- [x] Run hint policy table and concurrency/idempotency tests.
- [x] Run adversarial requests for premature final solutions.

**Dependencies:** Tasks 15 and 25  
**Files likely touched:** `packages/domain/src/hint-policy.ts`, `packages/application/src/reveal-hint.ts`, `apps/web/src/components/tutor/hint-panel.tsx`, `tests/unit/hint-policy.test.ts`
**Estimated scope:** Medium

### Task 29: Complete the first end-to-end internal problem workspace

**Description:** Combine topic/pattern learning, pseudocode, prediction, visualization, six-language editor/run, bounded hints, submission, and explicit result categories for one original problem.

**Acceptance criteria:**
- [x] The full guided path works in every supported language.
- [x] Reload/resume preserves committed state without false completion.
- [x] AI outage is irrelevant because this slice uses authored content.

**Verification:**
- [x] Run `pnpm test:e2e`, `pnpm test:conformance`, and accessibility checks.
- [ ] Manually exercise correct, wrong, compile-error, timeout, and infrastructure-error paths.

**Dependencies:** Tasks 6a, 25-28, 25a and 25b  
**Files likely touched:** `apps/web/app/learn/[problemId]/page.tsx`, `apps/web/src/components/practice/problem-workspace.tsx`, `packages/application/src/problem-workspace.ts`, `tests/e2e/guided-problem.spec.ts`
**Estimated scope:** Medium

### Checkpoint F5: Learning kernel milestone M2

- [x] One original problem completes the entire internal learning loop in six languages.
- [x] Hint, visualization, pseudocode, execution, and resume failure cases pass.
- [x] Accessibility critical path passes.
- [x] Human owner authorizes Phase 6 — authorized in this task on 2026-10-02; no hosted deployment is authorized.

## Phase 6: Mastery, review, recommendation, and progress

**Phase 6 document review (2026-10-02):** The plan and its relevant contracts were checked against the architecture overview, system/data/interface/security documents, implementation contracts, quality traceability, product closure matrix, ADR-0008, ADR-0009 and ADR-0014, plus the Phase 5 evidence and current practice/outbox code. The architecture ERD requires `PROBLEM_CONCEPT`, but Task 14’s implementation has no persisted problem-to-concept relation; Task 30 therefore starts by closing that prerequisite with an immutable mapping on the exact problem version. The assessment event now carries the cumulative assistance snapshot required by the interface contract, committed atomically with the immutable observation. The v1 scoring policy must preserve source facts and explain reason codes; no unsupported confidence or delayed-transfer evidence may be fabricated.

### Task 30: Implement append-only mastery evidence and projection v1

**Description:** Consume practice-owned observations through a deduplicated mastery-owned handler; expose pending projections and evidence watermarks. Concept mastery and language proficiency are separate, and model-advisory or self-reported events cannot become verified evidence. Store deduplicated evidence for correctness, assistance, explanation, confidence, delay, and transfer; derive an interpretable versioned mastery band with replay support. Preserve the source class for each fact, and only project confidence or delayed-transfer evidence when a reviewed, persisted source exists.

**Acceptance criteria:**
- [x] Historical evidence is never rewritten by projection changes.
- [x] Full-solution completion cannot equal independent delayed transfer.
- [x] Projection rebuild produces deterministic watermarks and reason codes.

**Verification:**
- [x] Run evidence dedupe, replay, and policy-version comparison tests.
- [x] Rebuild a learner projection from an empty read model.

**Dependencies:** Tasks 13, 14, 25, and 29
**Files likely touched:** `packages/domain/src/mastery.ts`, `packages/db/migrations/0018_problem_concept_mapping.sql`, `packages/db/migrations/0019_assessment_assistance.sql`, `packages/db/migrations/0020_mastery.sql`, `packages/application/src/mastery-projection.ts`, `tests/integration/mastery-replay.test.ts`
**Estimated scope:** Medium

**Completion (2026-10-02):** All source dimensions now have canonical persisted paths: code correctness/cumulative assistance, reviewed saved explanation checks, learner-reported confidence, and delayed recall/independent transfer reviews. Migration 0021 retains real source types, immutable source facts, review/history, captured-timezone activity, prospective pauses and external self-report events. Draft mapping authoring requires authenticated author ownership and invalidates prior review/validation. Deterministic replay, policy comparison, atomic outbox delivery, pending states and all Phase 6 pages are verified. See [Phase 6 evidence](../docs/evidence/phases/phase6-evidence.md) for policies, commands, results, fixture boundaries and cleanup.

### Task 31: Implement spaced review and transfer scheduling

**Description:** Create due windows from qualifying evidence, delayed transfer tasks, UTC storage with learner-timezone presentation, overdue recovery, and idempotent rescheduling.

**Acceptance criteria:**
- [x] DST/timezone changes do not duplicate or lose reviews.
- [x] Overdue items remain recoverable and do not reset mastery/streak automatically.
- [x] Same evidence watermark cannot create duplicate review items.

**Verification:**
- [x] Run clock/property tests across DST and timezone fixtures.
- [x] Run retry/concurrency scheduling tests.

**Dependencies:** Task 30  
**Files likely touched:** `packages/domain/src/review-schedule.ts`, `packages/application/src/review-use-cases.ts`, `apps/web/app/review/page.tsx`, `tests/unit/review-schedule.test.ts`  
**Estimated scope:** Medium

### Task 32: Implement explainable next-action recommendation

**Description:** Recommend one calm next action using prerequisites, due reviews, mastery uncertainty, learner goal, language availability, and diversity, with alternatives and reason codes.

**Acceptance criteria:**
- [x] Every recommendation has machine-readable and learner-readable reasons.
- [x] Cold start uses diagnostic/intro content, never fabricated personalization.
- [x] Retired or unavailable content is never recommended.

**Verification:**
- [x] Run deterministic scenario/property tests.
- [x] Manually inspect cold-start, overdue-review, and language-unavailable cases.

**Dependencies:** Tasks 14-17 and 30-31  
**Files likely touched:** `packages/domain/src/recommendation.ts`, `packages/application/src/get-learner-home.ts`, `apps/web/app/home/page.tsx`, `tests/unit/recommendation.test.ts`  
**Estimated scope:** Medium

### Task 33: Implement separate progress and consistency views

**Description:** Show internal mastery, external-practice journal, plan adherence, review health, and consistency separately. Define learner-local streak semantics, pause/grace behavior, and no misleading blended mastery score.

**Acceptance criteria:**
- [x] Self-reported and server-observed measures are visually distinct.
- [x] Streak calculation is versioned and timezone-safe.
- [x] Progress views expose `asOf` time and policy version.

**Verification:**
- [x] Run streak/calendar and read-model tests.
- [x] Accessibility and misleading-label content review passes.

**Dependencies:** Tasks 11 and 30-32  
**Files likely touched:** `packages/domain/src/consistency.ts`, `packages/application/src/progress-read-model.ts`, `apps/web/app/progress/page.tsx`, `tests/unit/consistency.test.ts`  
**Estimated scope:** Medium

### Checkpoint F6: Evidence-driven learning

- [x] Mastery is reproducible from evidence.
- [x] Reviews and recommendations are deterministic and explainable.
- [x] Progress does not confuse activity with mastery.
- [x] Human owner authorizes Phase 7 — explicitly approved in this chat on 2026-10-02; local testing and GitHub publication are authorized, with no live deployment.

## Phase 7: Configurable roadmap planning

**Entry review (2026-10-02):** Task 34 begins from the accepted F6 handoff. Roadmap data/state, calendar and publication contracts, interfaces, data architecture and the product closure matrix were reviewed. Plan acceptance remains explicit and cannot trust a browser-supplied validation verdict. Live AI remains reserved for Task 45a.

**Phase 7 closure (2026-10-03):** Tasks 34–37 and 51 are verified against the roadmap/data/calendar/interface/closure contracts. Work covers schedule persistence/lifecycle, scheduler/validator, missed-session and changed-goal/language previews, optional-operation budgets and fixture-only proposals, plus the complete learner UI. The [evidence record](../docs/evidence/phases/phase7-evidence.md) maps files, tests, policy choices and operational limits. F7 technical gates pass; the owner authorized Phase 8 implementation on 2026-10-06.

### Task 34: Implement roadmap intent and immutable plan versions

**Description:** Add plan horizon, target, capacity, language, collection, status, item, pause, completion, and supersession state machines.

**Task 34 closure:** Private versioned intent, validated candidates, immutable accepted schedules, kind-specific targets, atomic expected-active-token acceptance, lifecycle and append-only adherence/corrections are implemented. Replans pin past/completed occurrences and their original timezone/language. See [Phase 7 evidence](../docs/evidence/phases/phase7-evidence.md).

**Acceptance criteria:**
- [x] Supported horizons are 1, 2, 3, 4, and 6 months unless Gate P2 changes them.
- [x] Accepted plan versions are immutable. Explicit acceptance atomically checks the expected active-version token; only one primary plan is active.
- [x] Replanning preserves prior adherence and completed evidence. PlanItem kind determines its nullable target FK; buffer items require no problem.

**Verification:**
- [x] Run state-machine and version-history tests.
- [x] Run ownership and cross-plan isolation tests.

**Dependencies:** Tasks 11, 14, 17, and 31-33  
**Files likely touched:** `packages/domain/src/roadmap.ts`, `packages/db/migrations/0012_roadmap.sql`, `packages/application/src/roadmap-use-cases.ts`, `tests/integration/roadmap.test.ts`  
**Estimated scope:** Medium

### Task 35: Implement deterministic baseline scheduler

**Description:** Produce daily/weekly schedules from capacity, prerequisite order, mastery, due reviews, buffers, required core, reinforcement, and optional extension items.

**Acceptance criteria:**
- [x] Required workload never exceeds declared capacity.
- [x] Reviews and configurable buffer days are reserved before optional extensions.
- [x] Infeasible goals or insufficient reviewed curriculum return scoped alternatives, not padded repeated work or an impossible full-DSA promise.

**Verification:**
- [x] Run property tests over horizons, capacities, missed days, and sparse content.
- [x] Snapshot representative 1-, 2-, 3-, 4-, and 6-month plans; test month-end clamping, leap year, timezone changes, reviews after plan end and indivisible sessions per implementation contracts.

**Dependencies:** Task 34  
**Files likely touched:** `packages/domain/src/roadmap-scheduler.ts`, `packages/application/src/build-baseline-plan.ts`, `tests/unit/roadmap-scheduler.test.ts`, `tests/fixtures/roadmaps/`  
**Estimated scope:** Medium

### Task 36: Implement plan validator and replan policy

**Description:** Validate prerequisites, duplicates, language availability, rights, external link health, review spacing, dates, buffers, and AI proposal changes; implement missed-day and changed-goal replanning.

**Acceptance criteria:**
- [x] Duplicate collection membership does not duplicate required work.
- [x] Invalid language/content/link items block publication with reason codes.
- [x] Replan previews moved/removed/added items and requires acceptance; completed/past items remain fixed. Pause and resume do not silently extend deadlines.

**Verification:**
- [x] Run invalid-plan fixtures for every closure-matrix case.
- [x] Replay old versus new plans and compare preserved history.

**Dependencies:** Tasks 17, 34-35  
**Files likely touched:** `packages/domain/src/roadmap-validator.ts`, `packages/application/src/replan-roadmap.ts`, `tests/unit/roadmap-validator.test.ts`, `tests/integration/replan.test.ts`  
**Estimated scope:** Medium

### Task 51: Implement budgets, quotas, rate limits, and circuit breakers

**Description:** This prerequisite runs before live AI calls; Task 53 later verifies production behavior. Enforce atomic reservations and caps for AI and code execution; define evaluation hooks for Task 41; add per-operation circuit breakers and documented graceful degradation.

**Acceptance criteria:**
- [x] Concurrent requests cannot exceed the configured bounded allowance.
- [x] Budget denial produces authored fallback or clear refusal, not a generic error.
- [x] Core content and attempt writes remain available when optional work is shed.

**Verification:**
- [x] Run concurrency, exhaustion, retry, and load-shedding fixtures.
- [x] Verify recovery after breaker cooldown/administrative reset.

**Dependencies:** Tasks 13, 21 and 36  
**Files likely touched:** `packages/domain/src/budget.ts`, `packages/application/src/rate-limit.ts`, `packages/application/src/circuit-breaker.ts`, `tests/integration/budget.test.ts`  
**Estimated scope:** Medium

### Task 37: Add bounded AI plan proposal and learner plan UI

**Description:** Put AI plan explanation/sequencing behind a provider-neutral port. Use fixture-only model adapters in this phase; live AI activation is Task 45a. Validate every proposal, fall back to the baseline, and provide create/review/accept/pause/replan UI.

**Acceptance criteria:**
- [x] AI cannot publish a plan or introduce unapproved content/links.
- [x] Provider failure/budget denial returns the deterministic baseline.
- [x] Learner sees workload, assumptions, reasons, and editable preferences before acceptance.

**Verification:**
- [x] Run malformed, injected, over-capacity, timeout, and budget fixtures.
- [x] Run E2E journeys for create, accept, miss, pause, and replan.

**Dependencies:** Tasks 35-36 and 51  
**Files likely touched:** `packages/application/src/plan-proposal-port.ts`, `packages/tutor/src/plan-proposal-adapter.ts`, `apps/web/app/plan/page.tsx`, `tests/e2e/roadmap.spec.ts`  
**Estimated scope:** Medium

### Checkpoint F7: Adaptive roadmap

- [x] Every supported horizon produces a feasible, explainable plan or reasoned rejection.
- [x] AI-off mode remains complete.
- [x] Replanning preserves history and avoids catch-up overload.
- [x] Human owner authorizes Phase 8 (2026-10-06).

## Phase 8: Outbound LeetCode practice handoff

**Phase 8 implementation closure (2026-10-06):** Tasks 38–40 are complete locally. Governed readiness policies, server grading, safe outbound admission, and reversible learner-confirmed journals are connected through PostgreSQL and the learner/staff UI. All automated checks pass; see [Phase 8 evidence](../docs/evidence/phases/phase8-evidence.md). No production rubric has been published or user database migrated. Task 40 now records connected review-scheduling evidence, browser bypass rejection, runtime telemetry inspection and a visual real-link check in native Safari; The owner authorized Phase 9 on 2026-10-06.

### Task 38: Implement readiness gate and explicit practice bypass

**Description:** Evaluate the configured internal readiness categories and expose the outbound action only when ready, with bypass disabled by default unless Task 1 explicitly approves it. If approved, the learner must explicitly select practice-mode bypass.

**Acceptance criteria:**
- [x] Confidence alone cannot satisfy the gate.
- [x] Bypass remains disabled because no product approval exists; bypass requests fail closed and create no mastery evidence.
- [x] Gate reasons are understandable and versioned.

**Verification:**
- [x] Run readiness decision-table tests.
- [x] Test bypass, missing evidence, and stale content versions.

**Dependencies:** Tasks 26-33 and 37  
**Files likely touched:** `packages/domain/src/readiness-gate.ts`, `packages/application/src/evaluate-readiness.ts`, `apps/web/src/components/readiness/external-readiness.tsx`, `tests/unit/readiness-gate.test.ts`
**Estimated scope:** Medium

### Task 39: Implement outbound opening and learner-confirmed journal

**Description:** Open the reviewed canonical provider URL in a safe new context, record an idempotent navigation request, not proof the external page opened, and optionally append a clearly self-reported external completion.

**Acceptance criteria:**
- [x] No provider credential, cookie, submission, or profile data is accessed.
- [x] Navigation uses allowlisted HTTPS URLs and safe referrer/opener controls.
- [x] Confirmation is labelled learner-confirmed everywhere; corrections append journal reversals. Popup or journal failure preserves a safe normal-link action.

**Verification:**
- [x] Run URL, idempotency, authorization, and rendering-security tests.
- [x] Browser test verifies actual navigation target without automation on LeetCode.

**Dependencies:** Tasks 17, 33, and 38  
**Files likely touched:** `packages/application/src/external-companion.ts`, `packages/db/src/external-companion-repository.ts`, `packages/db/migrations/0027_external_companion.sql`, `apps/web/src/components/readiness/external-readiness.tsx`, `tests/e2e/companion-journey.spec.ts`
**Estimated scope:** Medium

### Task 40: Prove the companion journey end to end

**Description:** Demonstrate plan item -> internal learning -> readiness -> source link -> learner return/confirmation -> review scheduling, including broken-link and bypass variants.

**Acceptance criteria:**
- [x] No copied external problem content appears in the internal experience.
- [x] Broken/quarantined links never open silently.
- [x] External confirmation affects follow-through metrics, not server-observed mastery.

**Verification:**
- [x] Run companion E2E with provider-link stubs, browser bypass rejection and scheduled-review rendering. The PostgreSQL companion journey consumes its actual trusted assessment into review scheduling and renders that same SQL-backed queue after external confirmation/correction.
- [x] Complete a visual real-link check in native Safari: canonical HTTPS URL loads the expected problem title and redirects to its HTTPS description page. Agent-operated read-only check; no login, run or submission.
- [x] Inspect captured browser request URLs/referrer headers and actual runtime error-log writes: provider/API URLs carry no learner query data, provider navigation carries no referrer, and private source/reasoning markers do not enter logs.

**Dependencies:** Tasks 37-39  
**Files likely touched:** `tests/e2e/companion-journey.spec.ts`, `tests/fixtures/external-links/`, `packages/application/src/progress-read-model.ts`  
**Estimated scope:** Small

### Checkpoint F8: Adaptive practice companion milestone M3

- [x] Timeboxed plan to independent external practice works.
- [x] No synchronization, scraping, automation, or verification claim exists.
- [x] Broken-link, bypass, and self-report semantics are explicit.
- [x] Human owner authorizes Phase 9 (2026-10-06).

## Phase 9: Grounded retrieval and tutor

**Phase 9 entry (2026-10-06):** The owner approved proceeding after Task 40 closure. Task 41 worker infrastructure is complete locally: bounded leased delivery, immutable effect receipts, fenced retries and audited replay, canonical job adapters, reconciliation, opt-in existing draft expiry, scoped credentials and worker-stopped learning evidence. Task 42 now adds canonical pedagogical chunks, lexical documents, immutable versioned embeddings, atomic publication admission and quarantine under scoped worker credentials. Task 43 now adds permission-first PostgreSQL/exact-vector retrieval, immutable evidence receipts and a declared local pilot benchmark. Task 44 now adds provider-neutral validated tutor delivery, private-code consent, durable pending/cancel/retry, conservative assistance and authored fallback. Task 45 now adds immutable synthetic evaluation, independent human-review gates and reversible fixture configuration promotion. Live adapters remain absent and production remains authored/off; Task 45a now adds locally verified gateway/runtime/UI composition and synthetic primary/fallback/outage evidence. Actual provider activation still requires the named live-provider/data-policy decision. See [Phase 9 evidence](../docs/evidence/phases/phase9-evidence.md) and [worker operations](../docs/architecture/worker-operations.md).

### Task 41: Extend the existing relay for content and AI jobs

**Description:** Extend the relay introduced in Task 21 with Node worker handlers for content derivation, embeddings, evaluation, retention, and reconciliation with at-least-once delivery and idempotent consumers.

**Implementation boundary:** Concrete maintenance handlers and typed content/embedding/evaluation adapters are complete. Tasks 42–45 implement and enable their owning module consumers; absent consumers leave jobs pending.

**Acceptance criteria:**
- [x] Interactive requests do not run unbounded worker jobs.
- [x] Poison events dead-letter with operator-visible reason and safe replay.
- [x] Outbox lag and incomplete derived state are reconciled.

**Verification:**
- [x] Run crash/retry/duplicate/dead-letter integration tests.
- [x] Verify web learning remains usable while worker is stopped.

**Dependencies:** Tasks 13, 21 and 51; Checkpoint F8  
**Files likely touched:** `apps/worker/src/main.ts`, `apps/worker/src/outbox-relay.ts`, `apps/worker/src/job-registry.ts`, `tests/integration/worker.test.ts`  
**Estimated scope:** Medium

### Task 42: Implement pedagogical derivation and versioned indexes

**Description:** Derive typed chunks, lexical documents, and embeddings from published content using checksums, lineage, injection scan status, and quarantine on failure.

**Implementation boundary:** Complete for governed original problem statements and authored hint tiers. Local embedding fixtures validate the provider-neutral pipeline; candidates are not promoted for learner retrieval. Evaluated readiness and approved live providers remain later gates. See [Phase 9 evidence](../docs/evidence/phases/phase9-evidence.md).

**Acceptance criteria:**
- [x] Draft/retired/disallowed content never becomes retrieval eligible.
- [x] Re-running unchanged content is idempotent.
- [x] Index readiness is separate from publication.

**Verification:**
- [x] Run derivation, retirement, duplicate, malformed, and quarantine fixtures.
- [x] Verify exact content/version/checksum lineage.

**Dependencies:** Tasks 15 and 41  
**Files likely touched:** `packages/content/src/derive-chunks.ts`, `packages/retrieval/src/index-content.ts`, `packages/db/migrations/0014_search.sql`, `tests/integration/content-indexing.test.ts`  
**Estimated scope:** Medium

### Task 43: Implement hybrid retrieval and immutable evidence packages

**Description:** Add mandatory filters, PostgreSQL full-text candidates, exact pgvector candidates, versioned reciprocal-rank fusion, deduplication, contradiction flags, and immutable evidence packages.

**Acceptance criteria:**
- [x] Permission, publication, language, curriculum, and hint-tier filters apply before scoring and packaging.
- [x] Retrieval is reproducible from stored versions and checksums.
- [x] PostgreSQL ranking is not mislabeled BM25.

**Verification:**
- [x] Run retrieval correctness, permission-leak, and reproducibility tests.
- [x] Benchmark recall/latency against the declared pilot corpus.

**Dependencies:** Tasks 9 and 42  
**Files likely touched:** `packages/retrieval/src/hybrid-search.ts`, `packages/retrieval/src/evidence-package.ts`, `packages/db/src/retrieval-queries.ts`, `tests/retrieval-eval/baseline.test.ts`  
**Estimated scope:** Medium

### Task 44: Implement provider-neutral tutor and validate-before-display delivery

**Description:** Calculate allowed action before retrieval, invoke a fixture then approved provider adapter, buffer the entire candidate server-side, validate schema/citations/tier/current rights, persist response and assistance, then display. Restricted hint tiers stay authored; semantic leakage checks are defense in depth, not a guarantee.

**Acceptance criteria:**
- [x] Provider/model output cannot call application tools or mutate progress.
- [x] No partial/unvalidated candidate text reaches the UI; pending status only.
- [x] Private code is sent only for an explicit permitted debug operation.

**Verification:**
- [x] Run timeout, malformed, injected, citation-mismatch, tier-bypass, and budget fixtures.
- [x] Browser-network test proves rejected text and locked solutions never reach client payloads; covers pending/cancelled/fallback and persisted-answer retry.

**Dependencies:** Tasks 13a, 28, 41, 43 and 51  
**Files likely touched:** `packages/tutor/src/policy.ts`, `packages/tutor/src/provider-gateway.ts`, `apps/web/app/api/tutor/route.ts`, `apps/web/src/components/tutor/tutor-panel.tsx`, `tests/integration/tutor.test.ts`
**Estimated scope:** Medium

### Task 45: Implement tutor/retrieval evaluation and promotion gate

**Description:** Add versioned retrieval, generation, policy, cost, latency, and human-review suites with zero-tolerance critical leakage/privacy cases and reversible configuration promotion.

**Acceptance criteria:**
- [x] Candidate configuration cannot promote without declared suite/version and rollback target.
- [x] Critical policy/privacy regressions block promotion.
- [x] Evaluation data excludes private learner payload by default.

**Verification:**
- [x] Run `pnpm test:retrieval-eval` and adversarial tutor suite.
- [x] Demonstrate promote, reject, and rollback using fixture configurations.

**Dependencies:** Tasks 43-44  
**Files likely touched:** `packages/tutor/src/evaluation.ts`, `packages/retrieval/src/evaluation.ts`, `tests/retrieval-eval/`, `tests/adversarial/tutor-policy.test.ts`  
**Estimated scope:** Medium

### Task 45a: Activate and evaluate the live roadmap proposal adapter

**Status:** LOCAL IMPLEMENTATION AND SYNTHETIC VERIFICATION COMPLETE; LIVE ACTIVATION PENDING. The owner accepted the recommended local-completion/AI-off path on 2026-10-06. [Roadmap AI operations](../docs/architecture/roadmap-ai-operations.md) records the remaining named provider/region/context/budget/evaluation decisions.

**Description:** Connect Task 37's fixture-tested proposal port to the approved gateway only after budgets, redaction and evaluation exist.

**Acceptance criteria:**
- [x] Primary/fallback provider and AI-off paths produce only validator-approved candidates; learner acceptance remains required.
- [x] Learning plans use only reviewed catalog IDs and availability; provider outage never discards the active plan.

The acceptance checks above have local fixture/gateway evidence. They do not assert live vendor quality or owner approval.

**Verification:**
- [x] Evaluate realistic and adversarial proposals across all horizons, insufficient coverage, changed capacity, outages and budget exhaustion.
- [x] Record model/config/version/cost/latency evidence using synthetic data before live learner input (original injected gateway fixtures; billed-token/currency and actual vendor evaluation remain pending).

**Dependencies:** Tasks 37, 44, 45 and 51  
**Files likely touched:** `packages/tutor/src/plan-proposal-adapter.ts`, `tests/adversarial/roadmap-ai.test.ts`, `tests/e2e/roadmap-provider.spec.ts`  
**Estimated scope:** Small to medium; split if it exceeds one testable vertical slice

### Checkpoint F9: Grounded tutor

- [x] Authored lessons/hints still work with worker and provider disabled; new code runs show queued/unavailable status without false success.
- [x] Retrieval permission and citation tests pass.
- [x] Critical hint-leak and prompt-injection cases have zero bypasses in the declared synthetic suites; production semantic quality remains unapproved.
- [x] Human owner authorizes Phase 10 — explicitly approved on 2026-10-06; AI credentials may be supplied later.

## Phase 10: Build the shared learning platform, pilot curriculum and journey coverage

### Task 45b: Specify shared learning catalog and release contracts

**Status:** Contract card C1 complete; six query contracts, compatibility/rollback and scoped interaction direction recorded in the shared learning contract. Owner instruction authorizes the DESIGN section 29 direction for this Phase 10 scope. Runtime query delivery and browser verification remain downstream tasks.

**Description:** Resolve ADRs 0019–0021 and DESIGN section 29 into reviewed query, asset, migration and interaction contracts.

**Acceptance criteria:**
- [x] Define pagination, filters, authorization, error cases, release pins, restricted fields and withdrawal behavior for the six proposed catalog queries.
- [x] Record content-kind/schema extensions, compatibility matrix and rollback approach.
- [x] Approve proposed navigation and panel behavior before implementation; retain existing design exceptions.

**Verification:** Review the contract and record focused automated/manual evidence for the acceptance criteria during authorized implementation. This documentation revision does not run these future checks.

**Dependencies:** Tasks 18, 29 and 45; owner Phase 10 authorization
**Estimated scope:** Contract and design review; split into bounded subcards before coding.

### Task 45c: Generalize the published catalog and learning workspace

**Status:** Complete for local engineering, 2026-10-07. [Acceptance evidence](../docs/evidence/phases/phase10-platform-extension-evidence.md) and [journey coverage](../docs/evidence/phases/phase10-platform-extension-coverage.md); independent publication and later-phase gates remain separate.

**Description:** Replace the fixed slug/problem lookup and container-specific workspace assumptions with release-backed application queries and typed learning panels.

**Acceptance criteria:**
- [x] Existing pilot plus a distinct test-only fixture demonstrate reusable lookup without publishing unreviewed curriculum.
- [x] Preserve existing URLs, attempt release pins, draft recovery and ownership boundaries.
- [x] Learn, sheet and plan consumers share availability rules; server reads and client interaction have explicit boundaries.

**Verification:** Passed applicable unit, PostgreSQL, browser/build/accessibility and connected Linux checks; see the linked evidence for exact results and fixture/manual boundaries.

**Dependencies:** Task 45b
**Estimated scope:** Catalog and workspace foundation; split into bounded subcards before coding.

### Task 45d: Separate external destination and collection identities

**Status:** Complete for local engineering, 2026-10-07. [Acceptance evidence](../docs/evidence/phases/phase10-platform-extension-evidence.md) and [journey coverage](../docs/evidence/phases/phase10-platform-extension-coverage.md); independent publication and later-phase gates remain separate.

**Description:** Implement the reviewed ADR-0020 migration and compatible consumers.

**Acceptance criteria:**
- [x] Preserve legacy IDs, journal ownership, provenance and collection memberships.
- [x] Manually reconcile ambiguous links; destination/platform identity does not derive blindly from a legacy collection enum.
- [x] Deduplicate required work across sheets while keeping membership order and truthful coverage labels.

**Verification:** Passed applicable unit, PostgreSQL, browser/build/accessibility and connected Linux checks; see the linked evidence for exact results and fixture/manual boundaries.

**Dependencies:** Tasks 45b, 17 and 40
**Estimated scope:** External-reference migration; split into bounded subcards before coding.

### Task 45e: Synchronize pseudocode and algorithm walkthroughs

**Status:** Complete for local engineering, 2026-10-07. [Acceptance evidence](../docs/evidence/phases/phase10-platform-extension-evidence.md) and [journey coverage](../docs/evidence/phases/phase10-platform-extension-coverage.md); independent publication and later-phase gates remain separate.

**Description:** Extend the existing pilot with the ADR-0021 replay contract and renderer adapters.

**Acceptance criteria:**
- [x] Stable pseudocode line IDs, variables, narration and visual/text frames share one deterministic timeline.
- [x] Step, play/pause, speed, restart and scrub preserve equivalent state; schema-1 traces remain supported or explicitly converted.
- [x] No container-area assumptions leak into generic rendering; hidden checkpoints and references obey server reveal policy.

**Verification:** Passed applicable unit, PostgreSQL, browser/build/accessibility and connected Linux checks; see the linked evidence for exact results and fixture/manual boundaries.

**Dependencies:** Tasks 45c and 27
**Estimated scope:** Existing pilot walkthrough; split into bounded subcards before coding.

### Task 45f: Specify and implement navigation, deep links and authenticated return

**Status:** Complete for local engineering, 2026-10-07. [Acceptance evidence](../docs/evidence/phases/phase10-platform-extension-evidence.md) and [journey coverage](../docs/evidence/phases/phase10-platform-extension-coverage.md); independent publication and later-phase gates remain separate.

**Description:** Deliver the proposed shell and route contracts for available features, preserving current routes and private state.

**Acceptance criteria:**
- [x] Cover J01–J04 and E01–E04/E19 from the journey contract; every visible CTA has a working destination and valid return path.
- [x] Preserve current problem URLs and one plan authority across /plan and /roadmap; authorize direct entry without relying on prior navigation.
- [x] Validate same-origin return targets; sign-in cancellation, onboarding interruption and unavailable content have explicit exits.
- [x] Route changes, dialog Escape and back navigation never silently submit, abandon or erase work.

**Verification:** Passed applicable unit, PostgreSQL, browser/build/accessibility and connected Linux checks; see the linked evidence for exact results and fixture/manual boundaries.

**Dependencies:** Task 45b; navigation design approval under DESIGN section 28

**Estimated scope:** Parent work package; define bounded subcards and exact fixtures/files before coding.

### Task 45g: Extend release authoring and publication preflight

**Status:** Complete for local engineering, 2026-10-07. [Acceptance evidence](../docs/evidence/phases/phase10-platform-extension-evidence.md) and [journey coverage](../docs/evidence/phases/phase10-platform-extension-coverage.md); independent publication and later-phase gates remain separate.

**Description:** Make the shared content model operable through the existing author/reviewer workflow.

**Acceptance criteria:**
- [x] Preview the exact release, lesson blocks, six-language manifests, approaches, pseudocode lines, scenarios, transcripts and allowed external actions.
- [x] Preflight rejects missing/incompatible assets, unsafe markup, invalid mappings or restricted data in public views; publication remains transactional and reviewed.
- [x] Optional video/explanation roles are distinct from solve links; essential media has a transcript and unavailable media cannot block authored learning.
- [x] Withdrawal affects catalogs, caches and new commands while retaining lawful historical metadata; author draft edits do not mutate published versions.

**Verification:** Passed applicable unit, PostgreSQL, browser/build/accessibility and connected Linux checks; see the linked evidence for exact results and fixture/manual boundaries.

**Dependencies:** Tasks 45c, 45d and 45e

**Estimated scope:** Parent work package; define bounded subcards and exact fixtures/files before coding.

**Verification scope (owner instruction, 2026-10-06):** Delegate local verification to the assistant; use the browser for frontend and feature checks. Keep Phase 10 local without commit, push or PR. Manual assistive-technology review is outside this scope; delegated reviews do not impersonate independent human publication signatures. See [the delegated review record](../docs/evidence/phases/phase10-review-record.md).

**Technical status (updated 2026-10-07):** All four original bundles, private checksum-bound staff review/import, publication guards, published-only library/planning paths, six-language execution contracts, reference traces, recall/transfer and collection mappings are implemented and automatically verified. [Evidence and review runbook](../docs/evidence/phases/phase10-evidence.md). Tasks 46–50 and F10 are closed for the approved local engineering/verification scope after the owner requested F10 completion on 2026-10-07. Original independent publication requirements remain separate release gates. Manual assistive-technology review is outside the current browser-only scope; fixture approvals provide no human signatures.

### Task 46: Author the arrays/hashing pilot bundle

**Task status:** COMPLETE for local implementation and delegated verification; original independent publication acceptance remains a separate release gate. See the completed subtasks in [the task ledger](todo.md#phase-10-build-the-shared-learning-platform-pilot-curriculum-and-journey-coverage).

**Description:** Publish one original, deeply reviewed arrays/hashing problem with concept lesson, recognition cues, pseudocode rubric, hint ladder, trace, transfer item, six language manifests, and semantic fixtures.

**Acceptance criteria:**
- [x] Required renderer states and accessible transcripts are implemented and tested for this bundle, not assumed from the initial array renderer.
- [ ] Technical, pedagogical, accessibility, rights, trace, and conformance reviews pass.
- [x] Every language has assistant-reviewed starter, harness, canonical solution, and common-error notes; independent publication signatures remain separate.
- [x] Delayed transfer and review artifacts exist.

**Verification:**
- [x] Run content validation, conformance, visualizer, and tutor evaluation for the bundle — authored/synthetic tutor fixtures; live provider qualification remains separate.
- [ ] Human reviewers sign the publication record.

**Dependencies:** Tasks 18, 24, 29, 45c, 45e and 45g
**Files likely touched:** `content/patterns/arrays-hashing/`, `tests/language-conformance/arrays-hashing/`, `tests/retrieval-eval/arrays-hashing/`  
**Estimated scope:** Medium; one problem bundle only

### Task 47: Author the two-pointers pilot bundle

**Task status:** COMPLETE for local implementation and delegated verification; original independent publication acceptance remains a separate release gate. See the completed subtasks in [the task ledger](todo.md#phase-10-build-the-shared-learning-platform-pilot-curriculum-and-journey-coverage).

**Description:** Repeat the governed bundle template for one original two-pointers problem and its transfer item.

**Acceptance criteria:**
- [x] Required renderer states and accessible transcripts are implemented and tested for this bundle, not assumed from the initial array renderer.
- [ ] Same publication, six-language, accessibility, trace, hint, and transfer gates as Task 46 pass.
- [x] Pattern invariant and pointer movement are explicit in text and trace.

**Verification:**
- [x] Run bundle-specific compiler conformance, visualization and synthetic retrieval evaluation.
- [ ] Complete independent human review.

**Dependencies:** Task 46  
**Files likely touched:** `content/patterns/two-pointers/`, `tests/language-conformance/two-pointers/`, `tests/retrieval-eval/two-pointers/`  
**Estimated scope:** Medium

### Task 48: Author the sliding-window pilot bundle

**Task status:** COMPLETE for local implementation and delegated verification; original independent publication acceptance remains a separate release gate. See the completed subtasks in [the task ledger](todo.md#phase-10-build-the-shared-learning-platform-pilot-curriculum-and-journey-coverage).

**Description:** Repeat the governed bundle template for one original sliding-window problem and transfer item.

**Acceptance criteria:**
- [x] Required renderer states and accessible transcripts are implemented and tested for this bundle, not assumed from the initial array renderer.
- [x] Window invariant, expand/shrink decisions, and complexity are represented in text and trace.
- [ ] Same publication and six-language gates as Task 46 pass.

**Verification:**
- [x] Run bundle-specific compiler conformance, visualization and synthetic retrieval evaluation.
- [ ] Complete independent human review.

**Dependencies:** Task 46  
**Files likely touched:** `content/patterns/sliding-window/`, `tests/language-conformance/sliding-window/`, `tests/retrieval-eval/sliding-window/`  
**Estimated scope:** Medium

### Task 49: Author the stack pilot bundle

**Task status:** COMPLETE for local implementation and delegated verification; original independent publication acceptance remains a separate release gate. See the completed subtasks in [the task ledger](todo.md#phase-10-build-the-shared-learning-platform-pilot-curriculum-and-journey-coverage).

**Description:** Repeat the governed bundle template for one original stack problem and transfer item.

**Acceptance criteria:**
- [x] Required renderer states and accessible transcripts are implemented and tested for this bundle, not assumed from the initial array renderer.
- [x] Push/pop/top state, invariant, and complexity are represented in text and trace.
- [ ] Same publication and six-language gates as Task 46 pass.

**Verification:**
- [x] Run bundle-specific compiler conformance, visualization and synthetic retrieval evaluation.
- [ ] Complete independent human review.

**Dependencies:** Task 46  
**Files likely touched:** `content/patterns/stack/`, `tests/language-conformance/stack/`, `tests/retrieval-eval/stack/`  
**Estimated scope:** Medium

### Task 50a: Build curated Learn and sheet discovery

**Status:** Complete for local engineering, 2026-10-07. [Acceptance evidence](../docs/evidence/phases/phase10-platform-extension-evidence.md) and [journey coverage](../docs/evidence/phases/phase10-platform-extension-coverage.md); independent publication and later-phase gates remain separate.

**Description:** Connect published topics, problem summaries, lessons and curated collections to the shared catalog.

**Acceptance criteria:**
- [x] Search/filter/pagination and empty, loading, unavailable and withdrawn states work consistently.
- [x] Rows distinguish internal walkthrough, explanation link and reviewed external solve destination.
- [x] A solved item remains one problem across collections; no inflated progress or unsupported coverage claims.
- [x] Private sheets and public sharing are deferred from the pilot to proposed Tasks 59a–59b, with separate ownership, privacy and publication contracts.

**Verification:** Passed applicable unit, PostgreSQL, browser/build/accessibility and connected Linux checks; see the linked evidence for exact results and fixture/manual boundaries.

**Dependencies:** Tasks 45d and 46–49
**Estimated scope:** Curated discovery journeys; split into bounded subcards before coding.

### Task 50b: Drive roadmap planning from the published catalog

**Status:** Complete for local engineering, 2026-10-07. [Acceptance evidence](../docs/evidence/phases/phase10-platform-extension-evidence.md) and [journey coverage](../docs/evidence/phases/phase10-platform-extension-coverage.md); independent publication and later-phase gates remain separate.

**Description:** Replace the single-exercise planning catalog with eligible release-backed prerequisites, estimates and reviewed mappings.

**Acceptance criteria:**
- [x] Only supported published content enters a plan, with exact versions and deduplicated external memberships.
- [x] Insufficient content or time returns a scoped alternative or reasoned rejection.
- [x] Existing deterministic planning and authored fallback work without AI; existing live-provider approvals remain separate.

**Verification:** Passed applicable unit, PostgreSQL, browser/build/accessibility and connected Linux checks; see the linked evidence for exact results and fixture/manual boundaries.

**Dependencies:** Tasks 50a, 36 and 37
**Estimated scope:** Catalog-driven roadmap; split into bounded subcards before coding.

### Task 50c: Close learner journeys, exits and recovery paths

**Status:** Complete for local engineering, 2026-10-07. [Acceptance evidence](../docs/evidence/phases/phase10-platform-extension-evidence.md) and [journey coverage](../docs/evidence/phases/phase10-platform-extension-coverage.md); independent publication and later-phase gates remain separate.

**Description:** Exercise the connected pilot against the website journey and edge-case contract; implement missing transitions without expanding advertised curriculum.

**Acceptance criteria:**
- [x] J01–J08 and J11–J14 have entry, normal completion, back/cancel/leave, empty/unavailable and retry behavior, with J18/J19 operational boundaries.
- [x] Applicable E01–E12 and E16–E19 have traceable evidence; no code/draft loss, false save, accidental completion or duplicate credit.
- [x] External solve return remains self-report; editorial/video actions cannot masquerade as a solve action.
- [x] Plan preview cancellation preserves the active plan; accepted replan preserves history; execution and projection pending states remain discoverable.
- [x] Produce a coverage report mapping each journey/edge-case ID to task, fixture/manual evidence, release identity and unresolved gap.

**Verification:** Passed applicable unit, PostgreSQL, browser/build/accessibility and connected Linux checks; see the linked evidence for exact results and fixture/manual boundaries.

**Dependencies:** Tasks 45f, 45g, 50a and 50b

**Estimated scope:** Parent work package; define bounded subcards and exact fixtures/files before coding.

### Task 50: Validate pilot accessibility and collection mapping

**Task status:** COMPLETE for the owner-authorized browser-only accessibility, delegated mapping and design verification; original broader release reviews remain separate. See [the task ledger](todo.md#phase-10-build-the-shared-learning-platform-pilot-curriculum-and-journey-coverage).

**Description:** Map reviewed external source links and collection memberships to the four pilot concepts, then run keyboard, screen-reader, reduced-motion, contrast, low-power, content readability, and link-attribution reviews.

**Acceptance criteria:**
- [x] Collection overlap never duplicates required plan work.
- [x] Every pilot visual state has a useful text equivalent; automated checks cover the new learner pages and approved flat/isometric presentations.
- [ ] Complete human DESIGN.md/accessibility review of all pilot learner-facing journeys and approved exceptions.
- [x] External links are attributable, assistant-reviewed and outbound-only; sheet coverage labels distinguish supported internal, external-only and unavailable entries, with reviewed mapping type. Persistent human publication approval remains separate.

**Verification:**
- [x] Run accessibility automation, keyboard, reduced-motion, mobile and 200% zoom checks.
- [ ] Manual assistive-technology review is excluded from the current owner-authorized browser-only scope; no completed screen-reader review is claimed.
- [x] Run link-health/deduplication and complete pilot E2E suite — HTTP browser fixtures and real SQL journeys; all 24 published-pilot combinations also pass the separate actual Linux/gVisor learning loop.

**Dependencies:** Tasks 17, 40, 46–49 and 50a–50c
**Files likely touched:** `content/collections/`, `tests/accessibility/`, `tests/e2e/pilot-curriculum.spec.ts`  
**Estimated scope:** Medium

### Checkpoint F10: Pilot learning product milestone M4 — COMPLETE locally

**Local closure (2026-10-07):** Owner-requested completion after delegated verification, browser-only frontend review and the keep-local instruction. This closes the local engineering milestone; original independent persistent-publication and broader accessibility requirements remain separate release gates in [the task ledger](todo.md#separate-publication-and-release-gates--retained-not-completed). No human signatures or persistent publication are inferred. Subsequent owner authorization for Phase 11 preparation is recorded below.

- [x] Four pattern bundles pass the declared local content, delegated review and all six-language gates with matching current bundle checksums.
- [x] Guided, roadmap, external handoff, review and AI-off tutor paths work together; all 24 pilot/language combinations pass the actual Linux/gVisor loop.
- [x] Critical accessibility journeys pass automated checks and delegated browser review within the authorized browser-only scope.
- [x] Owner-requested F10 local closure is recorded; work remains uncommitted and unpushed.

The owner authorized Phase 11 preparation on 2026-10-07: “I approved, go to complete these task and ready for the next phase 11”. The persistent local database is now backed up and migrated through 0038, with restricted runtime access and active publication guards. [Release readiness](../docs/evidence/phases/phase10-release-readiness.md) records the remaining actual staff-review dependency. Runtime publication guards and original independent publication requirements remain in force.

### Proposed learning-platform extension acceptance — complete for local engineering (2026-10-07)

The owner subsequently authorized and requested completion of the extension. Tasks 45b–45g and 50a–50c now have separate local delivery and journey evidence. This extends the original pilot closure while preserving independent publication and later-phase gates.

- [x] Learn, sheets and roadmap share release availability, deduplication and truthful coverage.
- [x] Pseudocode, variables, visuals and accessible transcripts stay synchronized; historical attempts retain version pins.
- [x] Task 50c closes the pilot J/E coverage report; every advertised action has a valid outcome, return path and relevant failure/recovery evidence.

- [x] Human owner authorizes Phase 11 preparation (2026-10-07); publication completion still requires actual independent staff decisions.

## Phase 11: Privacy, observability, resilience, and operational readiness

**Local implementation complete (2026-10-08):** The owner explicitly authorized full Phase 11 implementation and set aside the independent Phase 10 publication task. Tasks 52–54 pass local engineering verification; [evidence](../docs/evidence/phases/phase11-evidence.md) records 516 core tests, 152 database checks, 64 browser journeys, 32 accessibility checks and the passed restore/game-day receipt. [Local operational policy](../docs/architecture/phase11-operational-policy.md) defines implemented defaults; Task 4 hosted/legal decisions and Task 57 staging PITR remain separate. Persistent local migrations now reach 0040, with original learner accounts preserved. The owner now authorizes repository commit/push and GitHub CI verification. Hosted deployment is not authorized.


### Task 52: Implement privacy export, deletion, and retention workflows

**Description:** Add re-authenticated export, deletion-pending state, work cancellation, dependency-ordered purge/anonymization, derived-store cleanup, tombstones, backup-expiry tracking, and reconciliation.

**Acceptance criteria:**
- [x] Export includes owned data and version/context explanations without other users' data.
- [x] Deletion propagates across primary and derived stores under the implemented local policy; hosted legal/retention approval remains Task 4/Phase 12.
- [x] Jobs/retries cannot recreate deleted private data.

**Verification:**
- [x] Run end-to-end export/deletion with interrupted/retried jobs.
- [x] Reconciliation reports zero active private references after completion.

**Dependencies:** Tasks 4, 11, 13, 25, 41-44  
**Files likely touched:** `packages/application/src/privacy-workflows.ts`, `apps/worker/src/jobs/privacy.ts`, `apps/web/app/settings/privacy/page.tsx`, `tests/e2e/privacy.spec.ts`  
**Estimated scope:** Medium

### Task 53: Implement production-safe telemetry, SLOs, and alerts

**Description:** Add trace/request/session correlation, structured redacted logs, technical and learning metrics separation, SLO calculations, symptom-based alerts, and no-raw-code/prompt telemetry tests.

**Acceptance criteria:**
- [x] Critical flows correlate without storing private payloads.
- [x] SLOs report authored fallback separately from provider success.
- [x] Every production alert has owner, severity, runbook, and rollback/degradation action.

**Verification:**
- [x] Run telemetry serialization/redaction and missing-heartbeat tests.
- [x] Generate synthetic SLO burn and verify alerts/runbook links.

**Dependencies:** Tasks 8, 21, 41, 44, and 51  
**Files likely touched:** `packages/observability/src/telemetry.ts`, `packages/observability/src/redaction.ts`, `ops/alerts/`, `tests/integration/telemetry.test.ts`  
**Estimated scope:** Medium

### Task 54: Rehearse local restore, rollback, and incident procedures

**Description:** Rehearse with synthetic data on an isolated local/reference stack; this is not hosted PITR assurance. Restore PostgreSQL and immutable assets, reconcile data/outbox/indexes, run critical journeys, measure RPO/RTO, and rehearse sandbox, provider, database, privacy, content, and release incidents.

**Acceptance criteria:**
- [x] Record local drill timing and limitations. Task 57 must repeat hosted restore/PITR on deployed staging before a pilot can pass.
- [x] Application/content/AI/runtime-image rollback paths are demonstrated.
- [x] Runbooks identify owner, containment, evidence handling, recovery, and communication.

**Verification:**
- [x] Execute and record a restore drill and at least one game-day scenario.
- [x] Securely destroy the restore environment and record evidence.

**Dependencies:** Tasks 4, 41-53  
**Files likely touched:** `ops/runbooks/`, `ops/restore/`, `docs/evidence/restore-drills/`, `tests/e2e/restored-environment.spec.ts`  
**Estimated scope:** Medium

### Checkpoint F11: Operational assurance — local engineering COMPLETE

- [x] Privacy, budget, telemetry, alert, restore, and incident gates pass.
- [x] Known failures degrade safely and leave auditable state.
- [x] Actual evidence is separated from proposed targets.
- [x] Human owner authorizes Phase 12 (2026-10-10).

## Phase 12: Hosted pilot release

**Entry authorized 2026-10-10.** Vercel is the selected web platform, following the owner's clarification. Task 55 starts with hosted configuration admission and a read-only PostgreSQL preflight; it remains incomplete until the selected staging resources, roles, secrets and network isolation are provisioned and verified. [Staging guide](../docs/deployment/staging.md). Provider-specific resource choices and real-learner policy approval are not inferred from phase entry.

### Task 55: Provision the approved single-region staging environment

**Description:** Provision web, PostgreSQL+pgvector, identity, secret store, telemetry, email if needed, worker if required, and isolated execution infrastructure with environment separation and least privilege.

**Acceptance criteria:**
- [ ] No production/staging secret enters source, client bundles, logs, or sandboxes.
- [ ] Network and database roles match the trust model.
- [ ] Infrastructure configuration is reviewable, reproducible, and rollback-aware.

**Verification:**
- [ ] Run environment security/configuration checks and deployment smoke tests.
- [ ] Verify execution sandboxes cannot reach application/data/control planes.

**Dependencies:** Checkpoint F11  
**Files likely touched:** `infra/`, `ops/environments/staging/`, `docs/deployment/staging.md`  
**Estimated scope:** Medium

### Task 55a: Integrate hosted authentication and privileged session controls

**2026-10-10 provider planning update:** The owner requested a free production-MFA migration plan under the $0 ceiling. [ADR-0025](../docs/adr/0025-free-production-mfa-provider-migration.md) proposes qualifying Supabase Auth in Singapore, retaining Neon application data and verified identity/session/role boundaries. Planning authorization is not provider cutover or evidence that MFA and recovery are qualified. The acceptance criteria below remain unchanged.

**Description:** Replace the local identity adapter with the selected hosted provider; enforce server-side ownership and session protections.

**Acceptance criteria:**
- [ ] Local/test sign-in cannot run in hosted environments; sign-in callbacks, issuer/audience/state/nonce checks apply to the selected protocol.
- [ ] Session expiry/revocation, CSRF/origin defenses, re-authenticated export/deletion and privileged MFA work.
- [ ] Role removal is effective across active sessions; account-linking requires verified ownership and excludes external coding accounts.

**Verification:**
- [ ] Run real staging sign-in/sign-out/revocation and privileged MFA flows plus invalid callback and cross-account tests.

**Dependencies:** Tasks 10, 12, 52 and 55  
**Files likely touched:** `apps/web/src/adapters/identity/`, `tests/e2e/hosted-auth.spec.ts`, `docs/evidence/identity.md`  
**Estimated scope:** Small to medium; split if it exceeds one testable vertical slice

### Task 56: Implement CI/CD, migration, image, and configuration promotion

**Description:** Build immutable release pipelines with quality gates, signed artifacts/images, expand-migrate-contract migrations, environment promotion, content/AI/runtime configuration gates, and tested rollback.

**Acceptance criteria:**
- [ ] Failed quality/security/evaluation gates cannot promote.
- [ ] Schema-compatible application rollback and forward-fix paths are documented.
- [ ] Runtime images and AI/content configurations promote independently with lineage.

**Verification:**
- [ ] Run staging deployment, failed-gate, rollback, and migration-retry drills.
- [ ] Verify artifact/image/config identities in telemetry and audit.

**Dependencies:** Tasks 45, 53-55 and 55a  
**Files likely touched:** `.github/workflows/`, `infra/pipelines/`, `ops/release/`, `docs/deployment/release.md`  
**Estimated scope:** Medium

### Task 57: Execute the hosted-pilot readiness gate

**Description:** Run the full release matrix: architecture, unit, integration, E2E, conformance, sandbox, adversarial tutor, accessibility, load, security, privacy, restore, SLO, incident, and rollback evidence. Admit only a controlled pilot cohort after explicit approval.

**Acceptance criteria:**
- [ ] Every checklist item has current evidence. Sandbox isolation, authorization, privacy, current content rights and hosted restore are non-waivable release gates; only noncritical scope can be narrowed.
- [ ] Capacity and SLO results are measured per language/profile where relevant.
- [ ] Rollback, support, incident ownership, feedback, and pilot-stop criteria are active.

**Verification:**
- [ ] Run the complete CI/assurance matrix against the deployed release candidate, including hosted PITR/asset restore, RPO/RTO measurement and real six-language runtime limits.
- [ ] Record a signed pilot readiness decision with evidence links and remaining risks.

**Dependencies:** Tasks 50, 54-56 and 55a  
**Files likely touched:** `docs/evidence/pilot-readiness.md`, `docs/evidence/load/`, `docs/evidence/security/`, `docs/evidence/accessibility/`, `tasks/todo.md`  
**Estimated scope:** Medium

### Checkpoint F12: Hosted pilot milestone M5

- [ ] Pilot readiness is approved by the named human owners.
- [ ] The status is `hosted pilot`, not `enterprise production-ready`.
- [ ] Implementation, validation, deferred, and blocked areas are reported separately.
- [ ] Phase 13 has a proposed outline below; its detailed per-track batches and release criteria require approval before execution.

## Phase 13: Expand curriculum and qualify full-course coverage

The four-pattern pilot is not a complete DSA course or full third-party sheet. This phase is a gated expansion outline, not authorization for bulk content generation.

### Task 58: Approve full-track taxonomy and coverage budgets

**Description:** Define foundations, arrays/strings/hashing, sorting/search, lists, stacks/queues, recursion/backtracking, trees/BSTs/tries, heaps, graphs, greedy and DP; add interval/bit/math material according to track goals. Choose exact named sheets and permitted metadata before promising them.

**Acceptance criteria:**
- [ ] Each offered track has prerequisites, measurable outcomes, estimated workload and six-language coverage targets.
- [ ] Maintain the per-bundle inventory from the journey contract: exact problems, owners, source rights, assets, language support and missing/draft/reviewed/published status. Choose minimum counts explicitly; do not copy marketing totals.
- [ ] Distinguish exact equivalent problems from same-pattern/prerequisite/transfer mappings; independent source links do not license copied content.

**Verification:**
- [ ] Human curriculum review and scheduler feasibility analysis for novice and advanced learners at every horizon.

**Dependencies:** Tasks 50 and 57; approved post-pilot expansion gate  
**Files likely touched:** `content/curriculum/`, `docs/product/track-coverage.md`  
**Estimated scope:** Planning package; publish small batch subcards before implementation

### Task 59: Deliver reviewed problem and visualization batches

**Description:** Repeat the pilot pipeline one original/licensed problem and transfer item at a time, including language guides, tests, hints, traces and external mapping.

**Acceptance criteria:**
- [ ] Each batch passes rights, six-language conformance, judge, accessibility and tutor regression gates before publication.
- [ ] New trace primitives require semantic/reducer/transcript tests before content uses them; no promise of automatic arbitrary-code visualization.
- [ ] Each problem subcard covers its pseudocode, approaches, scenarios/edge cases, transcript, language guides, assessments, external mappings and transfer/review assets; unsupported assets are labelled.
- [ ] The approved taxonomy includes renderer semantics for lists, recursion, trees, graphs and DP before those assets are advertised.

**Verification:**
- [ ] Run per-bundle evidence suites and human review; retirement/quarantine must remove availability without rewriting historical learning evidence.

**Dependencies:** Task 58  
**Files likely touched:** `content/patterns/`, `packages/visualizer/`, `tests/language-conformance/`, `tests/retrieval-eval/`  
**Estimated scope:** Repeatable parent package; one bounded subcard per reviewed bundle

### Task 59a: Build learner-owned private sheets

**Description:** Add private collection composition over canonical catalog/reference identities under ADR-0023.

**Acceptance criteria:**
- [ ] Create, rename, section, add/remove, reorder, duplicate and delete sheets with owner authorization and expected revision.
- [ ] Empty sections, duplicates, stale reorder, unavailable references, size limits and delete/cancel flows have explicit outcomes; personal notes stay private.
- [ ] Unknown external URLs are restricted private references until reviewed; no scraping, trusted publication or shared tutor indexing follows from saving a URL.
- [ ] Reuse canonical progress overlays without duplicating attempts/mastery; export/deletion includes owned sheets.

**Verification:** Cover J09 and E02/E04–E06/E13/E17/E18, including cross-user mutations and concurrent edits. Record results only during authorized implementation.

**Dependencies:** Tasks 58, 50c and 52; ADR-0023 decision

**Estimated scope:** Parent work package; define bounded subcards and exact fixtures/files before coding.

### Task 59b: Build explicit sheet sharing and moderation

**Description:** Publish sanitized immutable snapshots of learner sheets with revocation and report handling.

**Acceptance criteria:**
- [ ] Review visibility, discoverability, moderator ownership and retention before enabling share creation; private-by-default is preserved.
- [ ] Preview the exact shared fields; code, personal notes, attempts, progress and private profile metadata never enter public payloads or caches.
- [ ] Revocation, withdrawal, removed owner, stale cache and copied link produce the documented unavailable behavior; public copy keeps allowed references and attribution only.
- [ ] Report, triage, hide and appeal/support handling have owners and audit records; sharing never turns user content into reviewed curriculum.

**Verification:** Cover J10 and E03/E06/E14/E18 with payload inspection, unauthorized access, snapshot revision and revoke/cache scenarios. Record results only during authorized implementation.

**Dependencies:** Task 59a; privacy/security review and explicit sharing-policy approval

**Estimated scope:** Parent work package; define bounded subcards and exact fixtures/files before coding.

### Task 60: Qualify coverage and learning claims before broad release

**Description:** Evaluate actual curriculum availability, delayed transfer/recall, plan adherence, learner confusion and cost. Release only coverage-qualified tracks and retain scoped alternatives for insufficient capacity.

**Acceptance criteria:**
- [ ] No sheet/course is labelled complete when required internal content is absent.
- [ ] Learning-outcome claims cite an approved study design and measured evidence, not test counts or self-reported LeetCode totals.
- [ ] Updated capacity, content/support workload, privacy/security and rollback evidence pass a broader-release review.

**Verification:**
- [ ] Test full prerequisite chains across offered horizons and languages; review a versioned learner-outcome report with uncertainty and cohort limits.

**Dependencies:** Tasks 58–59; Tasks 59a–59b for any shipped custom/shared sheets, or an explicit recorded scope deferral with their UI disabled
**Files likely touched:** `docs/evidence/course-readiness.md`, `tests/e2e/full-track.spec.ts`, `docs/evidence/learning-outcomes.md`  
**Estimated scope:** Release-assurance package

### Checkpoint F13: Coverage-qualified course milestone M6

- [ ] Detailed batch plan and supported curriculum breadth are approved.
- [ ] Every advertised track/sheet has truthful coverage and feasibility evidence.
- [ ] Private/shared sheet Tasks 59a–59b are complete if advertised, or explicitly deferred with unsupported UI hidden.
- [ ] Broad release has a human readiness decision; interview or job outcomes are not guaranteed.


## Phase 14: DSA interview preparation (proposed)

Default order is after F13. The owner must authorize this phase; earlier scheduling requires an explicit plan revision after F10 and a review of operational prerequisites. Non-DSA interview modes are excluded from this phase.

### Task 61: Specify interview templates and evidence rubrics

**Description:** Resolve ADR-0022 into owned session contracts, lifecycle, assistance policy, deadlines and versioned DSA templates.

**Acceptance criteria:**
- [ ] Define guided versus timed modes, submission rules, accommodations and retention.
- [ ] Pin compatible releases, language manifests and rubric versions; distinguish scored evidence from advisory feedback.

**Verification:** Review the contract and record focused automated/manual evidence for the acceptance criteria during authorized implementation. This documentation revision does not run these future checks.

**Dependencies:** Task 60, F13 and owner Phase 14 authorization
**Estimated scope:** Session specification; split into bounded subcards before coding.

### Task 62: Implement timed interview session lifecycle

**Description:** Reuse the learning workspace and isolated executor with server-owned deadlines and recoverable drafts.

**Acceptance criteria:**
- [ ] Ownership, retries, reload, multi-tab and deadline races cannot duplicate finalization or extend a session.
- [ ] Queued, failed and late execution results follow the approved cutoff policy without false success.

**Verification:** Review the contract and record focused automated/manual evidence for the acceptance criteria during authorized implementation. This documentation revision does not run these future checks.

**Dependencies:** Task 61
**Estimated scope:** One reviewed DSA template first; split into bounded subcards before coding.

### Task 63: Deliver evidence-based interview debriefs

**Description:** Produce rubric-based debriefs with assistance history and justified next review activities.

**Acceptance criteria:**
- [ ] Explain code results, reasoning checks and self-report separately; AI commentary cannot modify scores.
- [ ] Only approved evidence events update mastery/reviews, idempotently.

**Verification:** Review the contract and record focused automated/manual evidence for the acceptance criteria during authorized implementation. This documentation revision does not run these future checks.

**Dependencies:** Task 62
**Estimated scope:** Debrief and review integration; split into bounded subcards before coding.

### Task 64: Qualify interview accessibility and release claims

**Description:** Review rubric reliability, recovery, accessibility and operational readiness for the declared DSA session scope.

**Acceptance criteria:**
- [ ] Keyboard, screen-reader, reduced-motion and timed accommodations pass manual review.
- [ ] Record rubric limitations, privacy, failure recovery and release/rollback decisions; no job-readiness guarantee.

**Verification:** Review the contract and record focused automated/manual evidence for the acceptance criteria during authorized implementation. This documentation revision does not run these future checks.

**Dependencies:** Tasks 61–63
**Estimated scope:** Scoped release review; split into bounded subcards before coding.

### Checkpoint F14: DSA interview milestone M7

- [ ] Reviewed templates, server timing, execution, debriefs and recovery work together.
- [ ] J15 and E15 plus applicable identity, recovery, AI, privacy and accessibility cases have evidence.
- [ ] Accessibility and rubric evaluation evidence support the declared scope.
- [ ] Human owner approves the scoped interview release; broader interview modes remain deferred to separately authorized Phase 15.

## Phase 15: Broader interview preparation (proposed)

This phase tracks the reference site’s advertised code review, low-level design and system design modes. Their private behavior was not inspected. Default dependency is F14 plus explicit owner authorization; they remain deferred from Phase 14. Typed artifacts are the initial scope; voice, live collaboration and file uploads require separate decisions.

### Task 65: Specify broader interview artifacts and scoring boundaries

**Description:** Decide ADR-0024 and author one reviewed template/rubric contract per proposed mode.

**Acceptance criteria:**
- [ ] Define typed code-review findings, LLD artifacts and system-design artifacts with schema/size limits, ownership, version pins and autosave/finalization rules.
- [ ] Separate objective checks, human review and model advisory feedback; account for valid alternatives and novel findings.
- [ ] Define assistance, deadline, accommodations, outage, debrief, retention and provider-data policy for each kind; no hiring prediction claim.

**Verification:** Review J16/J17 contracts and calibrate the proposed rubric on authored counterexamples before implementation. Record results only during authorized implementation.

**Dependencies:** Task 64, F14 and explicit Phase 15 authorization

**Estimated scope:** Parent work package; define bounded subcards and exact fixtures/files before coding.

### Task 66: Deliver a code review interview slice

**Description:** Reuse session lifecycle with an original/licensed code artifact, stable line anchors and structured learner findings.

**Acceptance criteria:**
- [ ] Preserve code version/anchors across drafts; invalid/stale anchors have recoverable errors.
- [ ] Collect findings and rationale, optionally suggested patches; do not execute supplied patches outside the approved execution plane.
- [ ] Debrief cites evidence and distinguishes expected issues, alternative valid findings and unsupported model claims.

**Verification:** Exercise one reviewed template, line-anchor changes, missing/duplicate findings, session expiry and recoverable draft conflicts. Record results only during authorized implementation.

**Dependencies:** Task 65

**Estimated scope:** Parent work package; define bounded subcards and exact fixtures/files before coding.

### Task 67: Deliver low-level and system design interview slices

**Description:** Build separate bounded subcards for LLD and system design over typed requirements and design artifacts.

**Acceptance criteria:**
- [ ] LLD captures entities/interfaces and interactions; system design captures components/data flows, capacity assumptions and failure reasoning.
- [ ] Use safe structured text/rendering; diagrams have accessible textual equivalents and no executable uploaded content.
- [ ] Rubric feedback explains satisfied/unsatisfied constraints and uncertainty; alternative viable designs are not rejected merely for differing from a reference answer.

**Verification:** Exercise each mode independently, incomplete artifacts, contradictory requirements, alternative designs, advisory failure and privacy boundaries. Record results only during authorized implementation.

**Dependencies:** Task 65

**Estimated scope:** Parent work package; define bounded subcards and exact fixtures/files before coding.

### Task 68: Qualify broader interview journeys and release

**Description:** Evaluate each implemented interview kind with independently reviewed artifacts and mode-specific reliability evidence.

**Acceptance criteria:**
- [ ] J16/J17 and applicable E02/E04–E06/E15/E16/E18/E19 pass; measure reviewer agreement and disclose rubric limitations.
- [ ] Each mode has accessibility, provider-off behavior, ownership, deadline/recovery, private-data and rollback evidence.
- [ ] Unsupported modes remain absent; no cross-mode aggregate readiness score or unsupported career claim is published.

**Verification:** Record per-mode evaluations, manual accessibility review and a scoped human release decision; synthetic checks alone do not prove coaching quality. Record results only during authorized implementation.

**Dependencies:** Tasks 66–67; existing privacy and operational release controls

**Estimated scope:** Parent work package; define bounded subcards and exact fixtures/files before coding.

### Checkpoint F15: Broader interview milestone M8

- [ ] Code review, LLD and system design each have an approved scope and evidence-backed rubric.
- [ ] Normal, exit, recovery, accessibility and privacy paths pass for every advertised mode.
- [ ] Human owner approves the declared release scope and limitations; deferred modes stay hidden.

## 6. Critical risks and mitigations

| Risk | Impact | Mitigation and early gate |
|---|---|---|
| Six-language execution becomes unsafe or too expensive | Critical | Phase 4 spike and isolation gate before broad UI/content work |
| Content workload overwhelms engineering | High | One governed problem bundle per change; reusable manifests, fixtures, hint, and trace templates |
| AI plan/tutor becomes product authority | High | Deterministic scheduler, policy, validator, evidence ledger, and authored fallback |
| LeetCode boundary drifts into scraping/sync | High | Link-only model, allowlisted URLs, no provider credentials, E2E boundary tests |
| Roadmaps promise impossible workloads | High | Capacity/prerequisite/language/link validation and reasoned infeasibility |
| Activity metrics are mistaken for mastery | High | Separate mastery, external journal, adherence, review health, and consistency views |
| Architecture becomes a distributed system too early | Medium | Modular monolith, PostgreSQL outbox, worker and service extraction only at explicit gates |
| Private code reaches logs/providers | Critical | Minimized explicit debug flow, serialization/redaction tests, provider policy and consent |
| Content rights or links change | High | Immutable provenance, retirement, link health, quarantine, and plan substitution |
| Pilot is called production-ready without evidence | High | F12 readiness matrix and status vocabulary enforced in release documents |

## 7. Handoff rules between phases

At every checkpoint, the implementer must provide:

- tasks completed and tasks explicitly deferred;
- commands run and exact results;
- runtime/browser/manual checks performed;
- schema, contract, content, and ADR changes;
- security/privacy/accessibility impact;
- known failures and residual risks;
- recommendation for the next smallest task;
- explicit request for human approval before crossing the phase gate.

Do not begin a later phase merely because earlier code compiles. Phase gates require the specified evidence and owner approval.

## 8. Open decisions tracked by Phase 0

- minors excluded or supported;
- individuals-only pilot or organization tenancy;
- English-only initial corpus;
- identity/session vendor;
- package manager and exact supported runtime versions;
- SQL/migration and test tooling;
- sandbox technology or managed execution provider;
- exact Python, JavaScript, TypeScript, Java, C++, and C versions;
- AI/embedding provider and data-processing region;
- retention/deletion periods and backup expiry;
- AI and execution budgets;
- pilot region and hosting provider;
- exact launch external collections;
- whether external completion asks for optional reflection;
- streak/grace-day definition;
- recruiter-facing profile card scope.


## Phase 12 execution supplement: Vercel Hobby workers and isolated execution

**Implementation status (2026-10-10): STARTED; VH-01 and preliminary VH-02 are PARTIAL.** Account guard/ADR and bounded synthetic Singapore discovery are implemented. See [discovery evidence](../docs/evidence/security/vercel-hobby.md); default-image privilege/PID/runtime findings block learner execution. The owner requested a Vercel-hosted implementation plan for personal, non-commercial use with a strict $0 budget and no server. This extends Tasks 55–57; their original acceptance criteria and Task 55a are unchanged. The earlier instruction to keep hosted execution disabled remains effective until managed execution is qualified and activation is authorized. No paid plan, trial, always-on VM or paid AI provider is part of this plan.

### Target architecture and boundaries

```text
Browser -> existing authenticated web API -> Neon application transactions/outbox
                                      |
                       durable event ID notification
                                      v
                      Vercel Queue -> bounded worker Function
                                      |
                        PostgreSQL leases/effect receipts

Web run admission -> durable signed descriptor -> execution-control Function
                                                     |
                                  fresh Vercel Sandbox, deny-all network
                                                     |
                             bounded candidate output -> external comparator
                                                     |
                          signed normalized result -> trusted application ingestion
```

Vercel hosts web, queue consumers and execution orchestration; existing Neon Free remains the database. Keep application, maintenance, content, privacy and execution-control credentials scoped to separate invocations/projects as appropriate. Learner sandboxes receive no database URLs, signing keys, identity credentials, provider tokens, expected answers or control-plane sockets. The trusted comparator and signing authority remain outside the sandbox. Queue notification is transport; PostgreSQL remains the durable job/effect truth. Do not replace application transactions with queue messages or treat transport acknowledgement as a committed learning result.

Use Singapore (`sin1`) where each service supports it to stay close to the existing Neon database. Verify actual regional availability for Queues and Sandbox before provisioning; document provider metadata/control-plane residency separately rather than claiming every provider component is single-region. Prefer Queues for delivery; Workflows is optional orchestration, not an initial dependency. Neither short-lived Functions nor a SQLite file in `/tmp` is a persistent execution-control host.

### Provider limits checked on 2026-10-10

| Resource | Published Hobby allowance/limit | Implementation consequence |
| --- | --- | --- |
| Functions with Fluid Compute | 300 seconds maximum; 4 CPU-hours and 360 GB-hours included | Short handlers with explicit deadlines; shared team usage must be accounted for |
| Queues | 1,000,000 API operations included; retention up to 7 days | Operations are not jobs; retries, message size and delivery options increase usage |
| Sandbox | 5 CPU-hours, 420 GB-hours memory, 5,000 creations and 20 GB transfer monthly | Reserve multiple resource dimensions before admission; stop at a conservative allowance |
| Sandbox concurrency | 10 concurrent on Hobby | Start at 2 concurrent learner runs; include qualification probes in the quota |
| Sandbox sessions | Maximum 45 minutes | Proposed initial full session cap 60 seconds, including startup/compilation; language deadlines remain stricter |
| Cron | Each Hobby schedule runs at most daily; invocation may vary within the hour | Daily reconciliation is a safety net, not a prompt delivery or privacy SLA |
| Optional Workflows | 50,000 events/month and 1 GB data written; completed-run retention 1 day | Workflow history cannot replace long-lived audit or privacy recovery records |

Sources: [Functions limits](https://vercel.com/docs/functions/limitations), [Hobby usage](https://vercel.com/docs/plans/hobby), [Queues pricing](https://vercel.com/docs/queues/pricing), [Sandbox pricing](https://vercel.com/docs/sandbox/pricing), [Cron restrictions](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [Workflow pricing](https://vercel.com/docs/workflows/pricing). Recheck at implementation and record actual team plan, availability and remaining usage. Hobby pauses usage at quota exhaustion; application limits must stop work earlier. No automatic upgrade or billing-enabled fallback.

### Ordered implementation slices

Each slice is a separate reviewable change. File paths below are likely targets, not files already implemented. Run focused tests for changed contracts plus the repository's standard CI gates. Do not widen the slice to unrelated UI or identity changes.

#### VH-01: Validate the free account and record the deployment decision

**Depends on:** Existing Phase 12 staging. **Scope:** Small.

Confirm the connected team is Hobby, personal/non-commercial use, and Sandbox/Queues availability in Singapore without a paid trial. Check remaining shared team allowances and VCR/custom-image availability and storage pricing. Record a new ADR extending ADR-0010/0011 with managed microVM execution and queue-triggered workers, preserving isolation/result integrity. Designate separate execution-control/worker secret boundaries. Do not activate learner execution.

**Acceptance/verification:** Read-only provider receipt lists plan, region, included quotas and no-charge resource path; ADR identifies unresolved limits and disables unsupported capability. If custom-image delivery is not free/available, stop that path and evaluate checksum-verified secret-free runtime artifacts without silently changing toolchain versions.

**Likely files:** `docs/adr/0026-vercel-hobby-managed-execution.md`, `docs/deployment/staging.md`.

#### VH-02: Prove one disposable Python sandbox before broad integration

**Depends on:** VH-01. **Scope:** Medium.

Create an opt-in synthetic spike with a pinned SDK and runtime identity, deny-all egress, no exposed ports, fresh filesystem, unprivileged learner process and bounded startup/run/teardown. Run one normal Python fixture and network, metadata, secret, fork, output, memory and residue attacks. Check whether provider APIs or an inner constrained process/container can enforce the existing CPU/memory/PID/file/disk contracts. MicroVM isolation alone does not establish those limits.

**Acceptance/verification:** Safe fixture passes; hostile fixtures are bounded; sandbox cannot reach web, Neon or control services; all resources stop after failure/cancellation. Unsupported controls are recorded as blockers, never waived. Persist redacted provider receipts without learner source.

**Likely files:** `spikes/execution-sandbox/vercel-hobby.ts`, spike fixtures, `docs/evidence/security/vercel-hobby.md`.

**Checkpoint A:** Continue only if Hobby availability, no-charge runtime delivery and equivalent execution controls are demonstrated. Owner reviews the architecture decision; no execution activation is implied.

#### VH-03: Deliver one durable maintenance job through Queues

**Depends on:** VH-01. **Scope:** Medium.

Extract the existing bounded consumer from CLI composition and add a verified queue consumer with a dedicated maintenance role. Commit the outbox row before publishing a descriptor-only event-ID notification. Load canonical work from PostgreSQL; reject malformed/untrusted notifications. Keep lease fencing, immutable effect receipts, bounded retries and dead-letter behavior. Begin with reconciliation, not learner deletion or embeddings.

**Acceptance/verification:** Duplicate/concurrent deliveries commit one logical effect; crash before/after commit does not lose the durable job; spoofed notifications are rejected. Provider callback authentication is proven with the pinned SDK, not a caller-controlled header.

**Likely files:** `apps/worker/src/job-relay.ts`, worker Vercel entrypoint, queue route/config, focused worker integration tests.

#### VH-04: Reconcile lost notifications and bounded worker shutdown

**Depends on:** VH-03. **Scope:** Medium.

Add bounded server-owned post-commit wake-up, daily authenticated Cron and an authenticated manual reconciliation operation. A failed queue publish leaves the outbox pending. Send retry notifications after transient failure; daily/manual reconciliation repairs interrupted publishing and expired claims. Split long jobs into checkpointed work units; do not launch detached infinite loops or rely on post-response work for durable completion.

**Acceptance/verification:** Simulate database commit followed by notification failure, provider outage and function termination; pending work is rediscovered, fenced and completed. Cron secret checks pass and backlog age remains visible. Document daily recovery delay; if required privacy/SLO deadlines need faster guaranteed recovery, this design is not qualified until a free supported scheduler solves it.

**Likely files:** worker notification/reconciliation adapter, Cron route, `apps/web/vercel.json` or actual project configuration, worker integration tests.

**Checkpoint B:** A real synthetic hosted maintenance job and loss/retry drill pass within measured function/resource limits.

#### VH-05: Add durable serverless execution lifecycle storage

**Depends on:** VH-02, VH-04. **Scope:** Medium; split migration and adapter if needed.

Implement a separate durable execution journal compatible with short-lived Functions; existing SQLite/local disk cannot serve this role. Preserve admission idempotency, fenced leases, cancellation, terminal states and orphan reconciliation. Use a dedicated schema/role with no application-table grants. Persist descriptor and sandbox identity only; learner source stays ephemeral. Do not persist reusable application/signing credentials in the journal.

**Acceptance/verification:** Concurrent cold starts, duplicate dispatch and orchestrator termination preserve lifecycle consistency. A stale lease cannot finalize a result; the journal role cannot read application data. Migration retry and schema-compatible rollback pass on an isolated database branch.

**Likely files:** next available `packages/db/migrations/` migration, execution-control journal adapter, lifecycle integration tests, scoped role bootstrap.

#### VH-06: Connect one real Python run end to end

**Depends on:** VH-05. **Scope:** Medium.

Add the provider adapter behind existing execution contracts: authenticated web admission, ephemeral source transport, fresh deny-all sandbox, bounded output collection, external comparison, signed normalized result and existing trusted ingestion. Keep provider-specific SDK logic in the execution adapter. Recheck cancellation before starting; stop a running sandbox on cancellation and fence late results.

**Acceptance/verification:** Synthetic owned attempt returns a genuine trusted result; fabricated stdout verdicts do not pass; wrong signatures and replayed/stale results are rejected. Kill the orchestrator after sandbox creation and prove reconciler discovery/cleanup, including the create-before-journal-record ambiguity.

**Likely files:** execution-control Vercel adapter, `apps/worker/src/execution-result-forwarder.ts`, existing execution client composition, hosted execution tests.

#### VH-07: Qualify the remaining runtime profiles separately

**Depends on:** VH-06. **Scope:** One small subcard per profile: JS/TS, Java, C/C++.

Build or deliver the existing pinned toolchains with no learner-time package installation/network access. Promote the four-profile runtime set through the existing signed-manifest pipeline. Verify the provider actually runs the approved immutable digest/artifact identity, including any registry mirror; mutable tags alone are insufficient. TypeScript retains its pinned compile/type-check step. Do not assume the provider default image matches current manifests.

**Acceptance/verification:** All six languages pass shared semantic fixtures and hostile resource tests. Each run records actual runtime/harness/manifest lineage. Cold-start/compiler overhead fits declared limits, or the profile remains unavailable.

**Likely files per subcard:** corresponding `services/execution-images/` profile, provider runtime mapping, conformance fixtures/adapter, runtime release receipt.

**Checkpoint C:** All six languages have genuine hosted conformance, abuse, cancellation, teardown and signed-result evidence. Local CI evidence alone is insufficient.

#### VH-08: Enforce application quotas and pilot-stop controls

**Depends on:** VH-06; final measurements from VH-07. **Scope:** Medium.

Extend existing atomic budget admission with conservative reservations for creations, CPU, allocated-memory wall time, output transfer and queue operations. Start with 2 global concurrent runs, 1 per learner, 10 daily runs per learner and at most 100 daily sandbox creations across normal runs/tests. Use an initial sandbox creation ceiling of 4,000 per rolling 30 days, but reduce it when CPU/memory/transfer or shared-team allowances bind earlier. Suggested stop at 80% of each published free allowance, after subtracting existing usage; these are proposed app caps, not provider entitlements. Count retries, startup, qualification probes and provider memory rounding; reconcile actual usage. Unknown remaining budget must fail closed.

**Acceptance/verification:** Parallel admission cannot overspend reservations; quota/provider failures produce queued/unavailable states without false assessment success. Owner can disable new admissions immediately; orphan cleanup still runs. No Pro/trial/payment fallback. A quota dashboard shows resource headroom without source/payload exposure.

**Likely files:** existing budget application/DB modules, provider usage adapter, execution admission tests, safe operational status view.

#### VH-09: Port other worker topics one at a time

**Depends on:** VH-04, VH-08. **Scope:** One medium subcard per topic/credential boundary.

Qualify mastery projection first, then authored content derivation, privacy export/deletion and existing retention/reconciliation according to their policies. Maintain separate scoped roles/invocations for content and privacy. Embeddings/evaluation remain disabled when a free approved provider is absent; authored/off behavior remains usable. Queue only opaque IDs, never source, export archives or secrets.

**Acceptance/verification:** Each enabled topic has real hosted retry/idempotency evidence, measured bounded work, denied unrelated data access and backlog handling. Deletion requires a ledger surviving application backup rewind; a queue message or a ledger restored with the same database is insufficient. Resolve a free independently durable ledger/asset store with access and restore tests before enabling destructive privacy operations or claiming recovery complete.

**Likely files per subcard:** topic handler, scoped role bootstrap, consumer composition, corresponding hosted integration tests/evidence.

#### VH-10: Extend exact-source release and rollback qualification

**Depends on:** VH-07–09. **Scope:** Medium; split worker and execution release changes.

Deploy a protected synthetic candidate with execution and consumers disabled by default. Gate worker/control-plane deployments on exact-source CI and approved compatible schema. Verify runtime image-set signatures and provider identity before admission; retain independent content/AI promotion gates. Run worker rollback and runtime A→B→A against actual provider sandboxes, with no lost jobs or stale-result acceptance.

**Acceptance/verification:** Failed CI, invalid signatures and incompatible configurations cannot activate. Telemetry/audit correlate web/control revision, runtime digest, descriptor and result. Explicit rollback/forward-fix and secret rotation procedures work without copying privileged secrets to sandboxes.

**Likely files:** `.github/workflows/`, `ops/release/`, `docs/deployment/release.md`, hosted release tests.

#### VH-11: Measure hosted capacity, cost headroom and failure recovery

**Depends on:** VH-10. **Scope:** Separate medium evidence subcards.

Run a small capped synthetic load in every language, measuring queue wait, startup/compile/run latency, CPU, memory-wall usage, transfer and database connections. Test two simultaneous runs, quota exhaustion, notification/provider outage, worker interruption and orphan cleanup. Separately rehearse historical PITR with known markers, immutable asset restore and deletion-ledger replay, measuring application RPO/RTO. Run deployed critical journeys, privacy isolation, accessibility and alerts. Do not use CI containers as learner execution hosting.

**Acceptance/verification:** Published limits and existing SLO/privacy deadlines are met with free headroom; unmet SLOs remain explicit blockers. Full recovery is not represented by a schema-only snapshot restore. No destructive drill runs against the sole live application or protected checkpoint.

**Likely files per subcard:** `tests/hosted-execution/`, hosted worker tests, `docs/evidence/load/`, recovery and accessibility evidence.

#### VH-12: Evaluate Phase 12 readiness and controlled activation

**Depends on:** VH-11 plus the unchanged original Tasks 55, 55a, 56 and 57 gates. **Scope:** Small documentation/operations change.

Update the readiness matrix with exact deployed candidates and receipts. Independently reviewed current-rights curriculum must be published; auth/MFA, privacy and named ownership decisions remain independent. Only then obtain the original named pilot-readiness/activation decision. Enable a capped personal pilot through an explicit configuration change, with a working stop switch and quota monitoring. If any non-waivable gate fails, retain synthetic staging and execution-disabled status; do not check off Phase 12 merely because Vercel deployment succeeds.

**Acceptance/verification:** Named decision references current complete evidence; stop/rollback is rehearsed; Task 55a is neither silently changed nor treated as verified by this infrastructure plan.

**Likely files:** `docs/evidence/pilot-readiness.md`, Phase 12 evidence, `tasks/todo.md`, reviewed activation configuration.

### Risks and fallback behavior

- Sandbox/VCR/Queues features or regional availability may change: validate real Hobby access early, pin SDKs and record measured limits. No paid fallback.
- New runtime packaging may alter approved digests/toolchains: require signed provenance and profile requalification, never accept `latest` as runtime lineage.
- Daily Cron cannot guarantee rapid recovery: queue retries plus reconciliation reduce gaps but do not prove a deadline; expose pending work and qualify actual deadlines.
- A free quota is shared and finite: application ceilings reserve headroom, and quota exhaustion disables admission while retaining durable pending work.
- Independent privacy ledger, immutable assets, full recovery, content rights and identity may remain unsolved: keep their gates open. This plan removes the assumed VM requirement, not the trust/recovery requirements.

**Execution order:** VH-01 → VH-02 → VH-03 → VH-04 → VH-05 → VH-06 → profile subcards VH-07 → VH-08 → topic subcards VH-09 → VH-10 → evidence subcards VH-11 → VH-12. Validate the highest-risk managed sandbox capabilities before investing in a broad migration.
