# AlgoCove phased implementation plan

**Status:** Proposed for owner review  
**Prepared:** 2026-09-17  
**Scope:** Implementation planning only. This document does not authorize application code, hosted infrastructure, external publication, or production claims.  
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
```

Safe parallel work begins only after contracts are frozen:

- Runtime images can be implemented in parallel after Task 20.
- Renderer work can run beside attempt-domain work after Task 24.
- Individual content problem bundles can run in parallel after Task 45.
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

These commands do not exist yet and are not evidence of passing tests. Task 2 freezes the toolchain, and implementation adds each script before claiming its gate. The intended command surface is:

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

### Task 10: Implement local-session identity adapter and actor context

**Description:** Build a deterministic local identity adapter for development/tests behind the same port later used by hosted OIDC or magic-link authentication.

**Acceptance criteria:**
- [ ] Browser session maps to one internal opaque user ID.
- [ ] Actor roles/scopes are loaded server-side and cannot be submitted by the browser.
- [ ] Session rotation/revocation behavior has test fixtures.

**Verification:**
- [ ] Run authentication integration tests including forged-role negatives.
- [ ] Manually verify login, logout, and revoked-session behavior.

**Dependencies:** Checkpoint F1  
**Files likely touched:** `packages/domain/src/identity.ts`, `packages/application/src/authenticate.ts`, `apps/web/src/auth/local-adapter.ts`, `tests/integration/auth.test.ts`  
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
**Files likely touched:** `apps/web/app/admin/content/page.tsx`, `apps/web/app/admin/content/[id]/page.tsx`, `packages/application/src/content-read-models.ts`, `tests/e2e/content-publish.spec.ts`  
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

### Task 25: Implement learning-session and attempt state machines

**Description:** Add learning sessions, version-pinned attempts, language/mode selection, meaningful attempt events, optimistic concurrency, abandon/expire behavior, and owner-only history.

**Acceptance criteria:**
- [ ] Attempt transitions are monotonic and version-pinned.
- [ ] Changing language creates an explicit new attempt/reset path.
- [ ] Keystrokes are not retained; saved/final snapshots are policy-controlled.

**Verification:**
- [ ] Run state-machine/property and ownership integration tests.
- [ ] Test concurrent submit/abandon/run races.

**Dependencies:** Tasks 11, 15-16, and 24  
**Files likely touched:** `packages/domain/src/practice.ts`, `packages/db/migrations/0009_practice.sql`, `packages/application/src/practice-use-cases.ts`, `tests/integration/practice.test.ts`  
**Estimated scope:** Medium

### Task 25a: Connect real attempts to durable execution and trusted results

**Description:** Wire owned attempts and saved source to the existing execution relay; integrate trusted result ingestion and explicit Run versus Submit behavior.

**Acceptance criteria:**
- [ ] Submission consumes a result for the exact source checksum, problem, language and manifest version.
- [ ] Commit the immutable assessment observation and outbox atomically; begin transaction before row locks.
- [ ] Cancellation, stale lease, duplicate result and lost response do not duplicate credit or leak quota.

**Verification:**
- [ ] Race run/submit/abandon/edit operations; kill relay and execution host and reconcile.
- [ ] Run a correct, wrong and infrastructure-failing attempt in each language.

**Dependencies:** Tasks 21, 24 and 25  
**Files likely touched:** `packages/application/src/code-run-use-cases.ts`, `apps/web/src/adapters/execution-client.ts`, `tests/integration/code-run.test.ts`  
**Estimated scope:** Small to medium; split if it exceeds one testable vertical slice

### Task 25b: Implement recoverable source and pseudocode drafts

**Description:** Implement replaceable debounced current drafts, explicit saved revisions, optimistic revision conflicts and truthful save-state indicators.

**Acceptance criteria:**
- [ ] Reload/session expiry does not silently discard confirmed saves; conflicts never overwrite newer drafts.
- [ ] No keystroke history; drafts have limits/TTL and private ownership.
- [ ] Optional local recovery is learner-scoped and cleared on logout/deletion; shared-device users can disable it.

**Verification:**
- [ ] Browser-test two tabs, offline/reconnect, lost save response, expired session and language switch.

**Dependencies:** Tasks 6a, 25 and 25a  
**Files likely touched:** `packages/application/src/save-draft.ts`, `apps/web/src/components/draft-status.tsx`, `tests/e2e/draft-recovery.spec.ts`  
**Estimated scope:** Small to medium; split if it exceeds one testable vertical slice

### Task 26: Implement structured pseudocode and readiness evidence

**Description:** Add versioned learner pseudocode fields for inputs, state, initialization, invariant, loop/recurrence, termination, output, and complexity plus explain-back evidence.

**Acceptance criteria:**
- [ ] Pseudocode is separate from executable code and supports append-only saved revisions.
- [ ] Readiness uses authored structured answer keys and verified runs, not nonempty prose or model opinion. Free-form pseudocode/explain-back feedback is advisory unless human reviewed.
- [ ] Tutor access cannot silently rewrite learner artifacts.

**Verification:**
- [ ] Run rubric, ownership, version, and privacy tests.
- [ ] Manually complete and revise one pseudocode artifact.

**Dependencies:** Tasks 25 and 25b  
**Files likely touched:** `packages/domain/src/pseudocode.ts`, `packages/db/migrations/0010_pseudocode.sql`, `apps/web/app/learn/[problemId]/pseudocode.tsx`, `tests/integration/pseudocode.test.ts`  
**Estimated scope:** Medium

### Task 27: Implement trace protocol and accessible renderer

**Description:** Implement bounded trace authoring/editing and step replay alongside reviewed canonical traces; label provenance and distinguish schema validity from algorithm correctness. Canonical trace disclosure counts as assistance where it reveals strategy. Arbitrary source-level tracing across six languages is not promised. Add versioned trace events, deterministic reducer, textual transcript, prediction checkpoints, keyboard controls, reduced motion, and initial array/two-pointer renderer.

**Acceptance criteria:**
- [ ] Same trace produces deterministic visual and text states.
- [ ] Unknown/invalid events fail safely.
- [ ] Critical controls work without pointer, color, animation, or sound; unsupported arbitrary learner-code traces fall back to the reviewed reference trace instead of fabricated states.

**Verification:**
- [ ] Run reducer/property, snapshot, keyboard, and accessibility tests.
- [ ] Manually verify reduced-motion and screen-reader transcript.

**Dependencies:** Tasks 15-16  
**Files likely touched:** `packages/visualizer/src/trace-schema.ts`, `packages/visualizer/src/reducer.ts`, `packages/visualizer/src/transcript.ts`, `apps/web/src/components/visualizer.tsx`, `tests/unit/visualizer.test.ts`  
**Estimated scope:** Medium

### Task 28: Implement deterministic hint ladder and authored fallback

**Description:** Add mode-aware hint ceilings, append-only reveals, authored hint tiers, solution-review gate, and stable refusal/fallback behavior without AI.

**Acceptance criteria:**
- [ ] Requested tier above the ceiling is rejected or capped deterministically.
- [ ] Assistance is persisted before display and cumulative across retries, language switches and new attempts on the same problem version; client bundles never preload locked hints/solutions.
- [ ] Full solution review requires the approved attempt/gate state.

**Verification:**
- [ ] Run hint policy table and concurrency/idempotency tests.
- [ ] Run adversarial requests for premature final solutions.

**Dependencies:** Tasks 15 and 25  
**Files likely touched:** `packages/domain/src/hint-policy.ts`, `packages/application/src/reveal-hint.ts`, `apps/web/src/components/hint-panel.tsx`, `tests/unit/hint-policy.test.ts`  
**Estimated scope:** Medium

### Task 29: Complete the first end-to-end internal problem workspace

**Description:** Combine topic/pattern learning, pseudocode, prediction, visualization, six-language editor/run, bounded hints, submission, and explicit result categories for one original problem.

**Acceptance criteria:**
- [ ] The full guided path works in every supported language.
- [ ] Reload/resume preserves committed state without false completion.
- [ ] AI outage is irrelevant because this slice uses authored content.

**Verification:**
- [ ] Run `pnpm test:e2e`, `pnpm test:conformance`, and accessibility checks.
- [ ] Manually exercise correct, wrong, compile-error, timeout, and infrastructure-error paths.

**Dependencies:** Tasks 6a, 25-28, 25a and 25b  
**Files likely touched:** `apps/web/app/learn/[problemId]/page.tsx`, `apps/web/src/components/problem-workspace.tsx`, `packages/application/src/problem-workspace.ts`, `tests/e2e/guided-problem.spec.ts`  
**Estimated scope:** Medium

### Checkpoint F5: Learning kernel milestone M2

- [ ] One original problem completes the entire internal learning loop in six languages.
- [ ] Hint, visualization, pseudocode, execution, and resume failure cases pass.
- [ ] Accessibility critical path passes.
- [ ] Human owner authorizes Phase 6.

## Phase 6: Mastery, review, recommendation, and progress

### Task 30: Implement append-only mastery evidence and projection v1

**Description:** Consume practice-owned observations through a deduplicated mastery-owned handler; expose pending projections and evidence watermarks. Concept mastery and language proficiency are separate, and model-advisory or self-reported events cannot become verified evidence. Store deduplicated evidence for correctness, assistance, explanation, confidence, delay, and transfer; derive an interpretable versioned mastery band with replay support.

**Acceptance criteria:**
- [ ] Historical evidence is never rewritten by projection changes.
- [ ] Full-solution completion cannot equal independent delayed transfer.
- [ ] Projection rebuild produces deterministic watermarks and reason codes.

**Verification:**
- [ ] Run evidence dedupe, replay, and policy-version comparison tests.
- [ ] Rebuild a learner projection from an empty read model.

**Dependencies:** Tasks 13, 25, and 29  
**Files likely touched:** `packages/domain/src/mastery.ts`, `packages/db/migrations/0011_mastery.sql`, `packages/application/src/mastery-projection.ts`, `tests/integration/mastery-replay.test.ts`  
**Estimated scope:** Medium

### Task 31: Implement spaced review and transfer scheduling

**Description:** Create due windows from qualifying evidence, delayed transfer tasks, UTC storage with learner-timezone presentation, overdue recovery, and idempotent rescheduling.

**Acceptance criteria:**
- [ ] DST/timezone changes do not duplicate or lose reviews.
- [ ] Overdue items remain recoverable and do not reset mastery/streak automatically.
- [ ] Same evidence watermark cannot create duplicate review items.

**Verification:**
- [ ] Run clock/property tests across DST and timezone fixtures.
- [ ] Run retry/concurrency scheduling tests.

**Dependencies:** Task 30  
**Files likely touched:** `packages/domain/src/review-schedule.ts`, `packages/application/src/review-use-cases.ts`, `apps/web/app/review/page.tsx`, `tests/unit/review-schedule.test.ts`  
**Estimated scope:** Medium

### Task 32: Implement explainable next-action recommendation

**Description:** Recommend one calm next action using prerequisites, due reviews, mastery uncertainty, learner goal, language availability, and diversity, with alternatives and reason codes.

**Acceptance criteria:**
- [ ] Every recommendation has machine-readable and learner-readable reasons.
- [ ] Cold start uses diagnostic/intro content, never fabricated personalization.
- [ ] Retired or unavailable content is never recommended.

**Verification:**
- [ ] Run deterministic scenario/property tests.
- [ ] Manually inspect cold-start, overdue-review, and language-unavailable cases.

**Dependencies:** Tasks 14-17 and 30-31  
**Files likely touched:** `packages/domain/src/recommendation.ts`, `packages/application/src/get-learner-home.ts`, `apps/web/app/home/page.tsx`, `tests/unit/recommendation.test.ts`  
**Estimated scope:** Medium

### Task 33: Implement separate progress and consistency views

**Description:** Show internal mastery, external-practice journal, plan adherence, review health, and consistency separately. Define learner-local streak semantics, pause/grace behavior, and no misleading blended mastery score.

**Acceptance criteria:**
- [ ] Self-reported and server-observed measures are visually distinct.
- [ ] Streak calculation is versioned and timezone-safe.
- [ ] Progress views expose `asOf` time and policy version.

**Verification:**
- [ ] Run streak/calendar and read-model tests.
- [ ] Accessibility and misleading-label content review passes.

**Dependencies:** Tasks 11 and 30-32  
**Files likely touched:** `packages/domain/src/consistency.ts`, `packages/application/src/progress-read-model.ts`, `apps/web/app/progress/page.tsx`, `tests/unit/consistency.test.ts`  
**Estimated scope:** Medium

### Checkpoint F6: Evidence-driven learning

- [ ] Mastery is reproducible from evidence.
- [ ] Reviews and recommendations are deterministic and explainable.
- [ ] Progress does not confuse activity with mastery.
- [ ] Human owner authorizes Phase 7.

## Phase 7: Configurable roadmap planning

### Task 34: Implement roadmap intent and immutable plan versions

**Description:** Add plan horizon, target, capacity, language, collection, status, item, pause, completion, and supersession state machines.

**Acceptance criteria:**
- [ ] Supported horizons are 1, 2, 3, 4, and 6 months unless Gate P2 changes them.
- [ ] Accepted plan versions are immutable. Explicit acceptance atomically checks the expected active-version token; only one primary plan is active.
- [ ] Replanning preserves prior adherence and completed evidence. PlanItem kind determines its nullable target FK; buffer items require no problem.

**Verification:**
- [ ] Run state-machine and version-history tests.
- [ ] Run ownership and cross-plan isolation tests.

**Dependencies:** Tasks 11, 14, 17, and 31-33  
**Files likely touched:** `packages/domain/src/roadmap.ts`, `packages/db/migrations/0012_roadmap.sql`, `packages/application/src/roadmap-use-cases.ts`, `tests/integration/roadmap.test.ts`  
**Estimated scope:** Medium

### Task 35: Implement deterministic baseline scheduler

**Description:** Produce daily/weekly schedules from capacity, prerequisite order, mastery, due reviews, buffers, required core, reinforcement, and optional extension items.

**Acceptance criteria:**
- [ ] Required workload never exceeds declared capacity.
- [ ] Reviews and configurable buffer days are reserved before optional extensions.
- [ ] Infeasible goals or insufficient reviewed curriculum return scoped alternatives, not padded repeated work or an impossible full-DSA promise.

**Verification:**
- [ ] Run property tests over horizons, capacities, missed days, and sparse content.
- [ ] Snapshot representative 1-, 2-, 3-, 4-, and 6-month plans; test month-end clamping, leap year, timezone changes, reviews after plan end and indivisible sessions per implementation contracts.

**Dependencies:** Task 34  
**Files likely touched:** `packages/domain/src/roadmap-scheduler.ts`, `packages/application/src/build-baseline-plan.ts`, `tests/unit/roadmap-scheduler.test.ts`, `tests/fixtures/roadmaps/`  
**Estimated scope:** Medium

### Task 36: Implement plan validator and replan policy

**Description:** Validate prerequisites, duplicates, language availability, rights, external link health, review spacing, dates, buffers, and AI proposal changes; implement missed-day and changed-goal replanning.

**Acceptance criteria:**
- [ ] Duplicate collection membership does not duplicate required work.
- [ ] Invalid language/content/link items block publication with reason codes.
- [ ] Replan previews moved/removed/added items and requires acceptance; completed/past items remain fixed. Pause and resume do not silently extend deadlines.

**Verification:**
- [ ] Run invalid-plan fixtures for every closure-matrix case.
- [ ] Replay old versus new plans and compare preserved history.

**Dependencies:** Tasks 17, 34-35  
**Files likely touched:** `packages/domain/src/roadmap-validator.ts`, `packages/application/src/replan-roadmap.ts`, `tests/unit/roadmap-validator.test.ts`, `tests/integration/replan.test.ts`  
**Estimated scope:** Medium

### Task 51: Implement budgets, quotas, rate limits, and circuit breakers

**Description:** This prerequisite runs before live AI calls; Task 53 later verifies production behavior. Enforce atomic reservations and caps for AI and code execution; define evaluation hooks for Task 41; add per-operation circuit breakers and documented graceful degradation.

**Acceptance criteria:**
- [ ] Concurrent requests cannot exceed the configured bounded allowance.
- [ ] Budget denial produces authored fallback or clear refusal, not a generic error.
- [ ] Core content and attempt writes remain available when optional work is shed.

**Verification:**
- [ ] Run concurrency, exhaustion, retry, and load-shedding fixtures.
- [ ] Verify recovery after breaker cooldown/administrative reset.

**Dependencies:** Tasks 13, 21 and 36  
**Files likely touched:** `packages/domain/src/budget.ts`, `packages/application/src/rate-limit.ts`, `packages/application/src/circuit-breaker.ts`, `tests/integration/budget.test.ts`  
**Estimated scope:** Medium

### Task 37: Add bounded AI plan proposal and learner plan UI

**Description:** Put AI plan explanation/sequencing behind a provider-neutral port. Use fixture-only model adapters in this phase; live AI activation is Task 45a. Validate every proposal, fall back to the baseline, and provide create/review/accept/pause/replan UI.

**Acceptance criteria:**
- [ ] AI cannot publish a plan or introduce unapproved content/links.
- [ ] Provider failure/budget denial returns the deterministic baseline.
- [ ] Learner sees workload, assumptions, reasons, and editable preferences before acceptance.

**Verification:**
- [ ] Run malformed, injected, over-capacity, timeout, and budget fixtures.
- [ ] Run E2E journeys for create, accept, miss, pause, and replan.

**Dependencies:** Tasks 35-36 and 51  
**Files likely touched:** `packages/application/src/plan-proposal-port.ts`, `packages/tutor/src/plan-proposal-adapter.ts`, `apps/web/app/plan/page.tsx`, `tests/e2e/roadmap.spec.ts`  
**Estimated scope:** Medium

### Checkpoint F7: Adaptive roadmap

- [ ] Every supported horizon produces a feasible, explainable plan or reasoned rejection.
- [ ] AI-off mode remains complete.
- [ ] Replanning preserves history and avoids catch-up overload.
- [ ] Human owner authorizes Phase 8.

## Phase 8: Outbound LeetCode practice handoff

### Task 38: Implement readiness gate and explicit practice bypass

**Description:** Evaluate the configured internal readiness categories and expose the outbound action only when ready, with bypass disabled by default unless Task 1 explicitly approves it. If approved, the learner must explicitly select practice-mode bypass.

**Acceptance criteria:**
- [ ] Confidence alone cannot satisfy the gate.
- [ ] Any approved bypass is explicit, audited, and creates no mastery evidence; the default honors learn-first.
- [ ] Gate reasons are understandable and versioned.

**Verification:**
- [ ] Run readiness decision-table tests.
- [ ] Test bypass, missing evidence, and stale content versions.

**Dependencies:** Tasks 26-33 and 37  
**Files likely touched:** `packages/domain/src/readiness-gate.ts`, `packages/application/src/evaluate-readiness.ts`, `apps/web/src/components/external-readiness.tsx`, `tests/unit/readiness-gate.test.ts`  
**Estimated scope:** Medium

### Task 39: Implement outbound opening and learner-confirmed journal

**Description:** Open the reviewed canonical provider URL in a safe new context, record an idempotent navigation request, not proof the external page opened, and optionally append a clearly self-reported external completion.

**Acceptance criteria:**
- [ ] No provider credential, cookie, submission, or profile data is accessed.
- [ ] Navigation uses allowlisted HTTPS URLs and safe referrer/opener controls.
- [ ] Confirmation is labelled learner-confirmed everywhere; corrections append journal reversals. Popup or journal failure preserves a safe normal-link action.

**Verification:**
- [ ] Run URL, idempotency, authorization, and rendering-security tests.
- [ ] Browser test verifies actual navigation target without automation on LeetCode.

**Dependencies:** Tasks 17, 33, and 38  
**Files likely touched:** `packages/application/src/external-handoff.ts`, `packages/db/migrations/0013_external_handoff.sql`, `apps/web/src/components/open-external.tsx`, `tests/e2e/external-handoff.spec.ts`  
**Estimated scope:** Medium

### Task 40: Prove the companion journey end to end

**Description:** Demonstrate plan item -> internal learning -> readiness -> source link -> learner return/confirmation -> review scheduling, including broken-link and bypass variants.

**Acceptance criteria:**
- [ ] No copied external problem content appears in the internal experience.
- [ ] Broken/quarantined links never open silently.
- [ ] External confirmation affects follow-through metrics, not server-observed mastery.

**Verification:**
- [ ] Run complete companion E2E suite with provider-link stubs and one manual real-link check.
- [ ] Review telemetry to confirm no URL query leaks private learner data.

**Dependencies:** Tasks 37-39  
**Files likely touched:** `tests/e2e/companion-journey.spec.ts`, `tests/fixtures/external-links/`, `packages/application/src/progress-read-model.ts`  
**Estimated scope:** Small

### Checkpoint F8: Adaptive practice companion milestone M3

- [ ] Timeboxed plan to independent external practice works.
- [ ] No synchronization, scraping, automation, or verification claim exists.
- [ ] Broken-link, bypass, and self-report semantics are explicit.
- [ ] Human owner authorizes Phase 9.

## Phase 9: Grounded retrieval and tutor

### Task 41: Extend the existing relay for content and AI jobs

**Description:** Extend the relay introduced in Task 21 with Node worker handlers for content derivation, embeddings, evaluation, retention, and reconciliation with at-least-once delivery and idempotent consumers.

**Acceptance criteria:**
- [ ] Interactive requests do not run unbounded worker jobs.
- [ ] Poison events dead-letter with operator-visible reason and safe replay.
- [ ] Outbox lag and incomplete derived state are reconciled.

**Verification:**
- [ ] Run crash/retry/duplicate/dead-letter integration tests.
- [ ] Verify web learning remains usable while worker is stopped.

**Dependencies:** Tasks 13, 21 and 51; Checkpoint F8  
**Files likely touched:** `apps/worker/src/main.ts`, `apps/worker/src/outbox-relay.ts`, `apps/worker/src/job-registry.ts`, `tests/integration/worker.test.ts`  
**Estimated scope:** Medium

### Task 42: Implement pedagogical derivation and versioned indexes

**Description:** Derive typed chunks, lexical documents, and embeddings from published content using checksums, lineage, injection scan status, and quarantine on failure.

**Acceptance criteria:**
- [ ] Draft/retired/disallowed content never becomes retrieval eligible.
- [ ] Re-running unchanged content is idempotent.
- [ ] Index readiness is separate from publication.

**Verification:**
- [ ] Run derivation, retirement, duplicate, malformed, and quarantine fixtures.
- [ ] Verify exact content/version/checksum lineage.

**Dependencies:** Tasks 15 and 41  
**Files likely touched:** `packages/content/src/derive-chunks.ts`, `packages/retrieval/src/index-content.ts`, `packages/db/migrations/0014_search.sql`, `tests/integration/content-indexing.test.ts`  
**Estimated scope:** Medium

### Task 43: Implement hybrid retrieval and immutable evidence packages

**Description:** Add mandatory filters, PostgreSQL full-text candidates, exact pgvector candidates, versioned reciprocal-rank fusion, deduplication, contradiction flags, and immutable evidence packages.

**Acceptance criteria:**
- [ ] Permission, publication, language, curriculum, and hint-tier filters apply before scoring and packaging.
- [ ] Retrieval is reproducible from stored versions and checksums.
- [ ] PostgreSQL ranking is not mislabeled BM25.

**Verification:**
- [ ] Run retrieval correctness, permission-leak, and reproducibility tests.
- [ ] Benchmark recall/latency against the declared pilot corpus.

**Dependencies:** Tasks 9 and 42  
**Files likely touched:** `packages/retrieval/src/hybrid-search.ts`, `packages/retrieval/src/evidence-package.ts`, `packages/db/src/retrieval-queries.ts`, `tests/retrieval-eval/baseline.test.ts`  
**Estimated scope:** Medium

### Task 44: Implement provider-neutral tutor and validate-before-display delivery

**Description:** Calculate allowed action before retrieval, invoke a fixture then approved provider adapter, buffer the entire candidate server-side, validate schema/citations/tier/current rights, persist response and assistance, then display. Restricted hint tiers stay authored; semantic leakage checks are defense in depth, not a guarantee.

**Acceptance criteria:**
- [ ] Provider/model output cannot call application tools or mutate progress.
- [ ] No partial/unvalidated candidate text reaches the UI; pending status only.
- [ ] Private code is sent only for an explicit permitted debug operation.

**Verification:**
- [ ] Run timeout, malformed, injected, citation-mismatch, tier-bypass, and budget fixtures.
- [ ] Browser-network test proves rejected text and locked solutions never reach client payloads; covers pending/cancelled/fallback and persisted-answer retry.

**Dependencies:** Tasks 13a, 28, 41, 43 and 51  
**Files likely touched:** `packages/tutor/src/policy.ts`, `packages/tutor/src/provider-gateway.ts`, `apps/web/app/api/tutor/route.ts`, `apps/web/src/components/tutor-panel.tsx`, `tests/integration/tutor.test.ts`  
**Estimated scope:** Medium

### Task 45: Implement tutor/retrieval evaluation and promotion gate

**Description:** Add versioned retrieval, generation, policy, cost, latency, and human-review suites with zero-tolerance critical leakage/privacy cases and reversible configuration promotion.

**Acceptance criteria:**
- [ ] Candidate configuration cannot promote without declared suite/version and rollback target.
- [ ] Critical policy/privacy regressions block promotion.
- [ ] Evaluation data excludes private learner payload by default.

**Verification:**
- [ ] Run `pnpm test:retrieval-eval` and adversarial tutor suite.
- [ ] Demonstrate promote, reject, and rollback using fixture configurations.

**Dependencies:** Tasks 43-44  
**Files likely touched:** `packages/tutor/src/evaluation.ts`, `packages/retrieval/src/evaluation.ts`, `tests/retrieval-eval/`, `tests/adversarial/tutor-policy.test.ts`  
**Estimated scope:** Medium

### Task 45a: Activate and evaluate the live roadmap proposal adapter

**Description:** Connect Task 37's fixture-tested proposal port to the approved gateway only after budgets, redaction and evaluation exist.

**Acceptance criteria:**
- [ ] Primary/fallback provider and AI-off paths produce only validator-approved candidates; learner acceptance remains required.
- [ ] Learning plans use only reviewed catalog IDs and availability; provider outage never discards the active plan.

**Verification:**
- [ ] Evaluate realistic and adversarial proposals across all horizons, insufficient coverage, changed capacity, outages and budget exhaustion.
- [ ] Record model/config/version/cost/latency evidence using synthetic data before live learner input.

**Dependencies:** Tasks 37, 44, 45 and 51  
**Files likely touched:** `packages/tutor/src/plan-proposal-adapter.ts`, `tests/adversarial/roadmap-ai.test.ts`, `tests/e2e/roadmap-provider.spec.ts`  
**Estimated scope:** Small to medium; split if it exceeds one testable vertical slice

### Checkpoint F9: Grounded tutor

- [ ] Authored lessons/hints still work with worker and provider disabled; new code runs show queued/unavailable status without false success.
- [ ] Retrieval permission and citation tests pass.
- [ ] Critical hint-leak and prompt-injection cases have zero bypasses.
- [ ] Human owner authorizes Phase 10.

## Phase 10: Build the pilot curriculum and accessibility evidence

### Task 46: Author the arrays/hashing pilot bundle

**Description:** Publish one original, deeply reviewed arrays/hashing problem with concept lesson, recognition cues, pseudocode rubric, hint ladder, trace, transfer item, six language manifests, and semantic fixtures.

**Acceptance criteria:**
- [ ] Required renderer states and accessible transcripts are implemented and tested for this bundle, not assumed from the initial array renderer.
- [ ] Technical, pedagogical, accessibility, rights, trace, and conformance reviews pass.
- [ ] Every language has reviewed starter, harness, canonical solution, and common-error notes.
- [ ] Delayed transfer and review artifacts exist.

**Verification:**
- [ ] Run content validation, conformance, visualizer, and tutor evaluation for the bundle.
- [ ] Human reviewers sign the publication record.

**Dependencies:** Tasks 18, 24, 29, and 45  
**Files likely touched:** `content/patterns/arrays-hashing/`, `tests/language-conformance/arrays-hashing/`, `tests/retrieval-eval/arrays-hashing/`  
**Estimated scope:** Medium; one problem bundle only

### Task 47: Author the two-pointers pilot bundle

**Description:** Repeat the governed bundle template for one original two-pointers problem and its transfer item.

**Acceptance criteria:**
- [ ] Required renderer states and accessible transcripts are implemented and tested for this bundle, not assumed from the initial array renderer.
- [ ] Same publication, six-language, accessibility, trace, hint, and transfer gates as Task 46 pass.
- [ ] Pattern invariant and pointer movement are explicit in text and trace.

**Verification:**
- [ ] Run bundle-specific conformance, visualization, retrieval, and human review.

**Dependencies:** Task 46  
**Files likely touched:** `content/patterns/two-pointers/`, `tests/language-conformance/two-pointers/`, `tests/retrieval-eval/two-pointers/`  
**Estimated scope:** Medium

### Task 48: Author the sliding-window pilot bundle

**Description:** Repeat the governed bundle template for one original sliding-window problem and transfer item.

**Acceptance criteria:**
- [ ] Required renderer states and accessible transcripts are implemented and tested for this bundle, not assumed from the initial array renderer.
- [ ] Window invariant, expand/shrink decisions, and complexity are represented in text and trace.
- [ ] Same publication and six-language gates as Task 46 pass.

**Verification:**
- [ ] Run bundle-specific conformance, visualization, retrieval, and human review.

**Dependencies:** Task 46  
**Files likely touched:** `content/patterns/sliding-window/`, `tests/language-conformance/sliding-window/`, `tests/retrieval-eval/sliding-window/`  
**Estimated scope:** Medium

### Task 49: Author the stack pilot bundle

**Description:** Repeat the governed bundle template for one original stack problem and transfer item.

**Acceptance criteria:**
- [ ] Required renderer states and accessible transcripts are implemented and tested for this bundle, not assumed from the initial array renderer.
- [ ] Push/pop/top state, invariant, and complexity are represented in text and trace.
- [ ] Same publication and six-language gates as Task 46 pass.

**Verification:**
- [ ] Run bundle-specific conformance, visualization, retrieval, and human review.

**Dependencies:** Task 46  
**Files likely touched:** `content/patterns/stack/`, `tests/language-conformance/stack/`, `tests/retrieval-eval/stack/`  
**Estimated scope:** Medium

### Task 50: Validate pilot accessibility and collection mapping

**Description:** Map reviewed external source links and collection memberships to the four pilot concepts, then run keyboard, screen-reader, reduced-motion, contrast, low-power, content readability, and link-attribution reviews.

**Acceptance criteria:**
- [ ] Collection overlap never duplicates required plan work.
- [ ] Every visual state has a useful text equivalent; all learner-facing pages follow DESIGN.md and preserve its approved exceptions.
- [ ] External links are attributable, manually reviewed and outbound-only; sheet coverage labels distinguish supported internal, external-only and unavailable entries, with reviewed mapping type.

**Verification:**
- [ ] Run accessibility automation plus manual assistive-technology review.
- [ ] Run link-health/deduplication and complete pilot E2E suite.

**Dependencies:** Tasks 17, 40, and 46-49  
**Files likely touched:** `content/collections/`, `tests/accessibility/`, `tests/e2e/pilot-curriculum.spec.ts`  
**Estimated scope:** Medium

### Checkpoint F10: Pilot learning product milestone M4

- [ ] Four pattern bundles pass all six-language and content gates.
- [ ] Guided, roadmap, external handoff, review, and tutor paths work together.
- [ ] Accessibility critical journeys pass manual and automated review.
- [ ] Human owner authorizes Phase 11.

## Phase 11: Privacy, observability, resilience, and operational readiness


### Task 52: Implement privacy export, deletion, and retention workflows

**Description:** Add re-authenticated export, deletion-pending state, work cancellation, dependency-ordered purge/anonymization, derived-store cleanup, tombstones, backup-expiry tracking, and reconciliation.

**Acceptance criteria:**
- [ ] Export includes owned data and version/context explanations without other users' data.
- [ ] Deletion propagates across primary and derived stores under the approved policy.
- [ ] Jobs/retries cannot recreate deleted private data.

**Verification:**
- [ ] Run end-to-end export/deletion with interrupted/retried jobs.
- [ ] Reconciliation reports zero active private references after completion.

**Dependencies:** Tasks 4, 11, 13, 25, 41-44  
**Files likely touched:** `packages/application/src/privacy-workflows.ts`, `apps/worker/src/jobs/privacy.ts`, `apps/web/app/settings/privacy/page.tsx`, `tests/e2e/privacy.spec.ts`  
**Estimated scope:** Medium

### Task 53: Implement production-safe telemetry, SLOs, and alerts

**Description:** Add trace/request/session correlation, structured redacted logs, technical and learning metrics separation, SLO calculations, symptom-based alerts, and no-raw-code/prompt telemetry tests.

**Acceptance criteria:**
- [ ] Critical flows correlate without storing private payloads.
- [ ] SLOs report authored fallback separately from provider success.
- [ ] Every production alert has owner, severity, runbook, and rollback/degradation action.

**Verification:**
- [ ] Run telemetry serialization/redaction and missing-heartbeat tests.
- [ ] Generate synthetic SLO burn and verify alerts/runbook links.

**Dependencies:** Tasks 8, 21, 41, 44, and 51  
**Files likely touched:** `packages/observability/src/telemetry.ts`, `packages/observability/src/redaction.ts`, `ops/alerts/`, `tests/integration/telemetry.test.ts`  
**Estimated scope:** Medium

### Task 54: Rehearse local restore, rollback, and incident procedures

**Description:** Rehearse with synthetic data on an isolated local/reference stack; this is not hosted PITR assurance. Restore PostgreSQL and immutable assets, reconcile data/outbox/indexes, run critical journeys, measure RPO/RTO, and rehearse sandbox, provider, database, privacy, content, and release incidents.

**Acceptance criteria:**
- [ ] Record local drill timing and limitations. Task 57 must repeat hosted restore/PITR on deployed staging before a pilot can pass.
- [ ] Application/content/AI/runtime-image rollback paths are demonstrated.
- [ ] Runbooks identify owner, containment, evidence handling, recovery, and communication.

**Verification:**
- [ ] Execute and record a restore drill and at least one game-day scenario.
- [ ] Securely destroy the restore environment and record evidence.

**Dependencies:** Tasks 4, 41-53  
**Files likely touched:** `ops/runbooks/`, `ops/restore/`, `docs/evidence/restore-drills/`, `tests/e2e/restored-environment.spec.ts`  
**Estimated scope:** Medium

### Checkpoint F11: Operational assurance

- [ ] Privacy, budget, telemetry, alert, restore, and incident gates pass.
- [ ] Known failures degrade safely and leave auditable state.
- [ ] Actual evidence is separated from proposed targets.
- [ ] Human owner authorizes Phase 12.

## Phase 12: Hosted pilot release

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

**Verification:**
- [ ] Run per-bundle evidence suites and human review; retirement/quarantine must remove availability without rewriting historical learning evidence.

**Dependencies:** Task 58  
**Files likely touched:** `content/patterns/`, `packages/visualizer/`, `tests/language-conformance/`, `tests/retrieval-eval/`  
**Estimated scope:** Repeatable parent package; one bounded subcard per reviewed bundle

### Task 60: Qualify coverage and learning claims before broad release

**Description:** Evaluate actual curriculum availability, delayed transfer/recall, plan adherence, learner confusion and cost. Release only coverage-qualified tracks and retain scoped alternatives for insufficient capacity.

**Acceptance criteria:**
- [ ] No sheet/course is labelled complete when required internal content is absent.
- [ ] Learning-outcome claims cite an approved study design and measured evidence, not test counts or self-reported LeetCode totals.
- [ ] Updated capacity, content/support workload, privacy/security and rollback evidence pass a broader-release review.

**Verification:**
- [ ] Test full prerequisite chains across offered horizons and languages; review a versioned learner-outcome report with uncertainty and cohort limits.

**Dependencies:** Tasks 58-59  
**Files likely touched:** `docs/evidence/course-readiness.md`, `tests/e2e/full-track.spec.ts`, `docs/evidence/learning-outcomes.md`  
**Estimated scope:** Release-assurance package

### Checkpoint F13: Coverage-qualified course milestone M6

- [ ] Detailed batch plan and supported curriculum breadth are approved.
- [ ] Every advertised track/sheet has truthful coverage and feasibility evidence.
- [ ] Broad release has a human readiness decision; interview or job outcomes are not guaranteed.


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
