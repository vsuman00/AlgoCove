# AlgoCove implementation task ledger

**Status:** Proposed; documentation only. No implementation is marked complete.  
**Detailed acceptance criteria:** [Implementation plan](plan.md)  
**Ordering:** Follow phase/document order, not numeric sorting. Suffix tasks close review gaps; Task 51 is intentionally before live AI. Parent packages need bounded subcards before coding.

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

- [ ] Task 5: Create root workspace and quality manifests
- [ ] Task 6: Create the minimal web application shell
- [ ] Task 6a: Integrate approved design tokens and page-shell contracts
- [ ] Task 7: Create package boundaries and architecture tests
- [ ] Task 8: Implement validated configuration and request primitives
- [ ] Task 9: Establish PostgreSQL, pgvector, migrations, and integration harness

### Checkpoint F1: Foundation

- [ ] All root quality commands pass.
- [ ] Architecture tests enforce import direction.
- [ ] Web shell builds and database migrations pass from empty.
- [ ] Human owner authorizes Phase 2.

## Phase 2: Identity, authorization, and durable platform primitives

- [ ] Task 10: Implement local-session identity adapter and actor context
- [ ] Task 11: Deliver learner onboarding and profile preferences
- [ ] Task 12: Implement privileged roles and authorization matrix
- [ ] Task 13: Implement idempotency, audit, and transactional outbox foundations
- [ ] Task 13a: Establish privacy-safe observability before service integration

### Checkpoint F2: Identity and platform integrity

- [ ] Onboarding works end to end.
- [ ] Cross-user and privilege negative tests pass.
- [ ] Idempotency/audit/outbox concurrency fixtures pass.
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
