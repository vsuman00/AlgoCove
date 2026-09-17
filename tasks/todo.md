# AlgoCove implementation task ledger

**Status:** Phase 2 technical implementation slices complete; the F2 transition checkpoint remains pending live Clerk verification and explicit human authorization for Phase 3.
**Detailed acceptance criteria:** [Implementation plan](plan.md)  
**Ordering:** Follow phase/document order, not numeric sorting. Suffix tasks close review gaps; Task 51 is intentionally before live AI. Parent packages need bounded subcards before coding.  

**Current evidence:** Phase 1 and the Phase 2 implementation slices pass the local gate: `pnpm verify`, `pnpm test:all`, production build, dependency audit, 8 isolated PostgreSQL/pgvector integration tests, 6 browser accessibility tests, Clerk adapter/route fixtures, profile ownership/version tests, authorization matrix tests, concurrent idempotency claims, audit redaction, and transactional outbox rollback. Live Clerk login/logout/revocation and an authenticated browser journey still require configured Clerk keys and a test account; those are not claimed here. Phase 0 planning approvals remain unchanged.

## Phase 0: Resolve gates and freeze the build contract

- [ ] Task 1: Approve product semantics and launch slice
- [ ] Task 2: Freeze the development toolchain and command surface
- [ ] Task 3: Define local adapter contracts and provider decision deadlines
- [ ] Task 4: Freeze privacy, retention, budgets, and pilot targets

### Checkpoint G0: Build authorization

- [ ] Tasks 1-4 are approved.
- [ ] A0-A2 and P0-P4 are accepted or explicitly narrowed.
- [ ] Human owner authorizes Phase 1 only.

## Phase 1: Establish the repository foundation

- [x] Task 5: Create root workspace and quality manifests — IMPLEMENTED; pnpm 12 lockfile metadata, release-age policy, and narrow `unrs-resolver` lifecycle-build approval now match CI, with clean frozen install, quality scripts, secret scan, and dependency audit passing.
- [x] Task 6: Create the minimal web application shell — IMPLEMENTED; routes, error boundary, production build, HTTP smoke checks, keyboard recovery, and browser accessibility checks pass.
- [x] Task 6a: Integrate approved design tokens and page-shell contracts — IMPLEMENTED for the Phase 1 shell; Tailwind token mapping, traceable Home/Workspace/Roadmap checklist, desktop/narrow shell review, and missing-asset tracking are complete. Full future screen fidelity remains phase-owned.
- [x] Task 7: Create package boundaries and architecture tests — IMPLEMENTED; import-boundary fixtures, architecture tests, and typecheck pass.
- [x] Task 8: Implement validated configuration and request primitives — IMPLEMENTED; focused configuration, ID/time, request-context, error-redaction, and secret-boundary tests pass.
- [x] Task 9: Establish PostgreSQL, pgvector, migrations, and integration harness — IMPLEMENTED; fresh isolated databases prove role bootstrap, pgvector, migrations, checksums, runtime readiness, DDL denial, bookkeeping denial, and rollback.

### Checkpoint F1: Foundation

- [x] All Phase 1 quality commands pass: `pnpm verify`, `pnpm test:all`, `pnpm build`, `pnpm test:integration`, `pnpm test:a11y`, and `pnpm security:audit`.
- [x] Architecture tests enforce import direction.
- [x] Web shell builds and database migrations pass from an empty isolated database.
- [x] Phase 1 technical implementation is complete; the prior F1 evidence is preserved. Human transition authorization remains a governance record, not an implementation claim.

## Phase 2: Identity, authorization, and durable platform primitives

- [x] Task 10: Integrate Clerk identity and actor context — IMPLEMENTED; verified Clerk session claims map to deterministic internal opaque learner IDs, roles are loaded from the server store, provider metadata is ignored, and sign-in/up/session route fixtures pass. Live Clerk account/revocation verification remains pending configured Clerk credentials.
- [x] Task 11: Deliver learner onboarding and profile preferences — IMPLEMENTED locally; PostgreSQL learner/profile migrations, owner/version use cases, Clerk-backed API, Tailwind onboarding UI, invalid-input and cross-user tests, and six browser accessibility checks pass. Authenticated browser proof remains environment-gated on Clerk credentials.
- [x] Task 12: Implement privileged roles and authorization matrix — IMPLEMENTED; every role has an explicit permission set, negative learner checks pass, and content author/reviewer separation-of-duties is enforced.
- [x] Task 13: Implement idempotency, audit, and transactional outbox foundations — IMPLEMENTED; PostgreSQL-backed claims replay/conflict safely, audit rows are append-only, payloads redact source material, outbox writes participate in transaction rollback, and concurrent claim fixtures pass.
- [x] Task 13a: Establish privacy-safe observability before service integration — IMPLEMENTED; allowlisted correlation/error fields and bounded telemetry redaction are covered by canary tests.

### Checkpoint F2: Identity and platform integrity

- [ ] Onboarding works end to end — API and mocked verified-Clerk route tests pass; live Clerk login/logout/revocation and authenticated browser journey require configured Clerk keys and a test account.
- [x] Cross-user and privilege negative tests pass.
- [x] Idempotency/audit/outbox concurrency fixtures pass.
- [ ] Human owner authorizes Phase 3.

## Phase 3: Governed curriculum, problems, and external references

- [ ] Task 14: Implement versioned concept and curriculum graph
- [ ] Task 15: Implement immutable content/problem lifecycle and provenance
- [ ] Task 16: Define six-language problem manifests and semantic fixtures
- [ ] Task 17: Implement external references and collection deduplication
- [ ] Task 18: Deliver content author/review/publish vertical slice

### Checkpoint F3: Governed content foundation

- [ ] One original problem candidate has complete rights/reviews; runnable publication remains blocked until Task 23.
- [ ] Six-language manifest completeness and external-link boundaries pass.
- [ ] No third-party statement, solution, test, or credential is stored.
- [ ] Human owner authorizes Phase 4.

## Phase 4: Prove isolated six-language execution

- [ ] Task 19: Complete the sandbox selection spike
- [ ] Task 20: Implement signed execution contracts
- [ ] Task 21: Implement execution-control admission and lifecycle
- [ ] Task 22: Build pinned runtime images for all six languages
- [ ] Task 23: Prove semantic conformance across six languages
- [ ] Task 24: Pass sandbox abuse and execution-port contract gates

### Checkpoint F4: Execution safety

- [ ] Six-language conformance is green.
- [ ] Sandbox security and teardown gates are green.
- [ ] Learner source may be privately stored but never executed in Next.js, general worker, browser origin or database host.
- [ ] Human security review authorizes Phase 5.

## Phase 5: Deliver the guided internal learning loop

- [ ] Task 25: Implement learning-session and attempt state machines
- [ ] Task 25a: Connect real attempts to durable execution and trusted results
- [ ] Task 25b: Implement recoverable source and pseudocode drafts
- [ ] Task 26: Implement structured pseudocode and readiness evidence
- [ ] Task 27: Implement trace protocol and accessible renderer
- [ ] Task 28: Implement deterministic hint ladder and authored fallback
- [ ] Task 29: Complete the first end-to-end internal problem workspace

### Checkpoint F5: Learning kernel milestone M2

- [ ] One original problem completes the entire internal learning loop in six languages.
- [ ] Hint, visualization, pseudocode, execution, and resume failure cases pass.
- [ ] Accessibility critical path passes.
- [ ] Human owner authorizes Phase 6.

## Phase 6: Mastery, review, recommendation, and progress

- [ ] Task 30: Implement append-only mastery evidence and projection v1
- [ ] Task 31: Implement spaced review and transfer scheduling
- [ ] Task 32: Implement explainable next-action recommendation
- [ ] Task 33: Implement separate progress and consistency views

### Checkpoint F6: Evidence-driven learning

- [ ] Mastery is reproducible from evidence.
- [ ] Reviews and recommendations are deterministic and explainable.
- [ ] Progress does not confuse activity with mastery.
- [ ] Human owner authorizes Phase 7.

## Phase 7: Configurable roadmap planning

- [ ] Task 34: Implement roadmap intent and immutable plan versions
- [ ] Task 35: Implement deterministic baseline scheduler
- [ ] Task 36: Implement plan validator and replan policy
- [ ] Task 51: Implement budgets, quotas, rate limits, and circuit breakers
- [ ] Task 37: Add bounded AI plan proposal and learner plan UI

### Checkpoint F7: Adaptive roadmap

- [ ] Every supported horizon produces a feasible, explainable plan or reasoned rejection.
- [ ] AI-off mode remains complete.
- [ ] Replanning preserves history and avoids catch-up overload.
- [ ] Human owner authorizes Phase 8.

## Phase 8: Outbound LeetCode practice handoff

- [ ] Task 38: Implement readiness gate and explicit practice bypass
- [ ] Task 39: Implement outbound opening and learner-confirmed journal
- [ ] Task 40: Prove the companion journey end to end

### Checkpoint F8: Adaptive practice companion milestone M3

- [ ] Timeboxed plan to independent external practice works.
- [ ] No synchronization, scraping, automation, or verification claim exists.
- [ ] Broken-link, bypass, and self-report semantics are explicit.
- [ ] Human owner authorizes Phase 9.

## Phase 9: Grounded retrieval and tutor

- [ ] Task 41: Extend the existing relay for content and AI jobs
- [ ] Task 42: Implement pedagogical derivation and versioned indexes
- [ ] Task 43: Implement hybrid retrieval and immutable evidence packages
- [ ] Task 44: Implement provider-neutral tutor and validate-before-display delivery
- [ ] Task 45: Implement tutor/retrieval evaluation and promotion gate
- [ ] Task 45a: Activate and evaluate the live roadmap proposal adapter

### Checkpoint F9: Grounded tutor

- [ ] Authored lessons/hints still work with worker and provider disabled; new code runs show queued/unavailable status without false success.
- [ ] Retrieval permission and citation tests pass.
- [ ] Critical hint-leak and prompt-injection cases have zero bypasses.
- [ ] Human owner authorizes Phase 10.

## Phase 10: Build the pilot curriculum and accessibility evidence

- [ ] Task 46: Author the arrays/hashing pilot bundle
- [ ] Task 47: Author the two-pointers pilot bundle
- [ ] Task 48: Author the sliding-window pilot bundle
- [ ] Task 49: Author the stack pilot bundle
- [ ] Task 50: Validate pilot accessibility and collection mapping

### Checkpoint F10: Pilot learning product milestone M4

- [ ] Four pattern bundles pass all six-language and content gates.
- [ ] Guided, roadmap, external handoff, review, and tutor paths work together.
- [ ] Accessibility critical journeys pass manual and automated review.
- [ ] Human owner authorizes Phase 11.

## Phase 11: Privacy, observability, resilience, and operational readiness

- [ ] Task 52: Implement privacy export, deletion, and retention workflows
- [ ] Task 53: Implement production-safe telemetry, SLOs, and alerts
- [ ] Task 54: Rehearse local restore, rollback, and incident procedures

### Checkpoint F11: Operational assurance

- [ ] Privacy, budget, telemetry, alert, restore, and incident gates pass.
- [ ] Known failures degrade safely and leave auditable state.
- [ ] Actual evidence is separated from proposed targets.
- [ ] Human owner authorizes Phase 12.

## Phase 12: Hosted pilot release

- [ ] Task 55: Provision the approved single-region staging environment
- [ ] Task 55a: Integrate hosted authentication and privileged session controls
- [ ] Task 56: Implement CI/CD, migration, image, and configuration promotion
- [ ] Task 57: Execute the hosted-pilot readiness gate

### Checkpoint F12: Hosted pilot milestone M5

- [ ] Pilot readiness is approved by the named human owners.
- [ ] The status is `hosted pilot`, not `enterprise production-ready`.
- [ ] Implementation, validation, deferred, and blocked areas are reported separately.
- [ ] Phase 13 has a proposed outline below; its detailed per-track batches and release criteria require approval before execution.

## Phase 13: Expand curriculum and qualify full-course coverage

- [ ] Task 58: Approve full-track taxonomy and coverage budgets
- [ ] Task 59: Deliver reviewed problem and visualization batches
- [ ] Task 60: Qualify coverage and learning claims before broad release

### Checkpoint F13: Coverage-qualified course milestone M6

- [ ] Detailed batch plan and supported curriculum breadth are approved.
- [ ] Every advertised track/sheet has truthful coverage and feasibility evidence.
- [ ] Broad release has a human readiness decision; interview or job outcomes are not guaranteed.
