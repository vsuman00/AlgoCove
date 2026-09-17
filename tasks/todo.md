# AlgoCove implementation task ledger

**Status:** Phase 2 identity/profile evidence is complete from owner-verified Clerk sign-in/sign-up and profile use. Phase 3 technical implementation and manual browser validation are complete. The owner authorized Phase 4 transition work on 2026-09-17. Tasks 20, 21, 22, 23, and the bounded Task 24 abuse/control slice are complete with local and remote evidence. Task 19's gVisor candidate matrix passed remotely in final CI run [35263785032](https://github.com/vsuman00/AlgoCove/actions/runs/35263785032), and the GHCR release, Trivy, SBOM/provenance, and Cosign gates passed in run [35261137554](https://github.com/vsuman00/AlgoCove/actions/runs/35261137554). Phase 4 remains open only for the explicit security-owner decision on the candidate runtime; runnable content publication remains blocked.
**Detailed acceptance criteria:** [Implementation plan](plan.md)  
**Ordering:** Follow phase/document order, not numeric sorting. Suffix tasks close review gaps; Task 51 is intentionally before live AI. Parent packages need bounded subcards before coding.  

**Current evidence:** Phase 1, Phase 2, and the Phase 3 implementation slices pass the local gate: `pnpm verify`, `pnpm test:all`, production build, dependency audit, 13 isolated PostgreSQL/pgvector integration tests, 9 deterministic Chromium accessibility tests, Clerk adapter/route fixtures, profile ownership/version tests, authorization matrix tests, curriculum cycle/version tests, content provenance/review/tombstone tests, six-language manifest tests, reviewed external-link/domain tests, collection deduplication, and the fixture-backed author/review/publish UI. The Clerk CLI is authenticated, linked to the AlgoCove application, and has pulled development keys into the ignored `apps/web/.env.local`; enabled-key build and liveness smoke checks pass. The owner manually verified Clerk sign-up/sign-in, profile use, and the Clerk user record. The profile persistence boundary remains covered by the application path and isolated PostgreSQL tests; no separate live SQL inspection is claimed here. Task 20's signed execution-contract package and 7 focused tests pass. Task 21's execution-control and descriptor-only outbox relay slice passes 8 focused tests, the full local gate, the 13-test PostgreSQL suite with migration 0009, production build, and 9 Chromium accessibility tests. Task 22 has four pinned image profiles for six languages with SBOM/provenance, smoke evidence, and zero local Docker Scout critical/high findings; release run [35261137554](https://github.com/vsuman00/AlgoCove/actions/runs/35261137554) built and pushed all four GHCR profiles, passed the fixable CRITICAL/HIGH Trivy gate, and verified keyless Cosign signatures. Task 23's local conformance runner passes 36 correct executions, rejects six mutated solutions, and rejects spoofed/malformed/expected-value output. Task 24's local abuse runner passes 14 bounded escape/egress/resource/path/signal/cancellation/teardown fixtures with no container residue; the existing signed-result and lifecycle tests cover correlation, fencing, cancellation classification, and infrastructure-error handling. Task 19's fail-closed explicit runtime selection and gVisor candidate CI job passed the six-language normal/hostile/concurrent matrix in final run [35263785032](https://github.com/vsuman00/AlgoCove/actions/runs/35263785032), but the security-owner approval is still pending. Phase 4 still does not approve Docker `runc` for hostile learner code. The architecture A0-A2 approval records and Phase 0 planning decisions remain explicitly proposed or pending where the architecture documents say owner input is required.

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

- [x] Task 10: Integrate Clerk identity and actor context — IMPLEMENTED; verified Clerk session claims map to deterministic internal opaque learner IDs, roles are loaded from the server store, provider metadata is ignored, the Clerk CLI app is linked, development keys are locally configured, sign-in/up/session route fixtures pass, and the owner manually verified live sign-in/sign-up and the Clerk user record.
- [x] Task 11: Deliver learner onboarding and profile preferences — IMPLEMENTED; PostgreSQL learner/profile migrations, owner/version use cases, Clerk-backed API, Tailwind onboarding UI, invalid-input and cross-user tests, six deterministic anonymous browser accessibility checks, enabled-key build/liveness checks, and owner-verified authenticated profile use pass. Profile persistence is covered by the application path and isolated PostgreSQL tests.
- [x] Task 12: Implement privileged roles and authorization matrix — IMPLEMENTED; every role has an explicit permission set, negative learner checks pass, and content author/reviewer separation-of-duties is enforced.
- [x] Task 13: Implement idempotency, audit, and transactional outbox foundations — IMPLEMENTED; PostgreSQL-backed claims replay/conflict safely, audit rows are append-only, payloads redact source material, outbox writes participate in transaction rollback, and concurrent claim fixtures pass.
- [x] Task 13a: Establish privacy-safe observability before service integration — IMPLEMENTED; allowlisted correlation/error fields and bounded telemetry redaction are covered by canary tests.

### Checkpoint F2: Identity and platform integrity

- [x] Onboarding works end to end — the owner manually verified Clerk sign-up/sign-in and profile use; API, verified-Clerk route, application, and isolated PostgreSQL tests pass.
- [x] Cross-user and privilege negative tests pass.
- [x] Idempotency/audit/outbox concurrency fixtures pass.
- [x] Human owner authorizes Phase 3 by directing continuation after confirming authentication and profile completion.

## Phase 3: Governed curriculum, problems, and external references

- [x] Task 14: Implement versioned concept and curriculum graph — IMPLEMENTED; cycle-safe domain validation, required/recommended/related edges, immutable published PostgreSQL snapshots, and pinned-version resolution port pass unit and integration checks.
- [x] Task 15: Implement immutable content/problem lifecycle and provenance — IMPLEMENTED; original/licensed provenance, checksums, separated reviews, validation blockers, immutable published/retired versions, rights tombstones, and safe historical projections pass lifecycle and database checks.
- [x] Task 16: Define six-language problem manifests and semantic fixtures — IMPLEMENTED; exactly `python`, `javascript`, `typescript`, `java`, `cpp`, and `c` have distinct profiles/adapters, shared fixture IDs, limits contracts, and completeness validation.
- [x] Task 17: Implement external references and collection deduplication — IMPLEMENTED; allowlisted provider-specific HTTPS metadata URLs, review status, outbound navigation boundaries, and cross-collection membership deduplication pass malicious-host and overlap fixtures.
- [x] Task 18: Deliver content author/review/publish vertical slice — IMPLEMENTED as a fixture-backed admin preview; separate author/reviewer/publisher responsibilities, complete original candidate rights/reviews, six-language evidence, reviewed outbound metadata, and the Task 23 runnable-publication blocker are visible and accessible.

### Checkpoint F3: Governed content foundation

- [x] One original problem candidate has complete rights/reviews; runnable publication remains blocked until Task 23.
- [x] Six-language manifest completeness and external-link boundaries pass.
- [x] No third-party statement, solution, test, or credential is stored.
- [x] Human owner authorizes Phase 4 transition work by directing completion of the Phase 3 closure and Phase 4 readiness boundary on 2026-09-17.

**Manual F3 browser evidence (2026-09-17):** The current production build was loaded in Chromium at `/admin/content`; the candidate workflow was opened and visibly confirmed to show original provenance/rights, separate approved technical and pedagogical reviews, passed metadata validation, six language rows (`python`, `javascript`, `typescript`, `java`, `cpp`, `c`), reviewed outbound metadata, no-third-party-copy disclosure, and a disabled `Publish fixture (locked)` control with Task 23 as the blocker. The detail page had no horizontal overflow, no application console errors, and the official Chromium accessibility suite passed all 9 tests, including the 320px workflow check.

## Phase 4: Prove isolated six-language execution

**Entry status (2026-09-17):** Transition work is authorized. Task 19 must first complete the sandbox-selection spike, using the provider/sandbox decision criteria required by Task 3. No Phase 4 task is marked implemented until its acceptance criteria and evidence are complete.

- [ ] Task 19: Complete the sandbox selection spike — TECHNICAL EVIDENCE COMPLETE, SECURITY DECISION PENDING; CI run [35263228343](https://github.com/vsuman00/AlgoCove/actions/runs/35263228343) ran the six-language matrix under explicitly selected gVisor `runsc`, and normal, hostile-boundary, and concurrent startup fixtures all passed. Default `runc` remains rejected for production until a security owner records approval, rejection, or a narrowed decision with threat-model evidence.
- [x] Task 20: Implement signed execution contracts — COMPLETE locally; schema, digest binding, Ed25519 signatures, key rotation window, expiry, result classification, replay identity, lease epoch fencing, tamper rejection, and compatibility tests pass. This does not close the unresolved Task 19 production sandbox decision.
- [x] Task 21: Implement execution-control admission and lifecycle — COMPLETE locally; internal admission/lifecycle, separate journal port, signed descriptor-only PostgreSQL relay, bounded claims/retries, and focused fault/concurrency tests pass. This does not close Task 19 or the later runtime/conformance gates.
- [x] Task 22: Build pinned runtime images for all six languages — COMPLETE; profiles, immutable base references, SBOM/provenance, smoke fixtures, and four clean local Docker Scout critical/high scans pass. Release run [35261137554](https://github.com/vsuman00/AlgoCove/actions/runs/35261137554) built and pushed all four GHCR profiles, passed the Trivy fixable critical/high gate, and passed keyless Cosign signing plus certificate identity/issuer verification.
- [x] Task 23: Prove semantic conformance across six languages — COMPLETE locally; one shared six-fixture manifest runs through six explicit adapters, 36 correct executions pass, six not-equal mutations are rejected by the trusted host judge, and lineage/spoofing/serialization checks pass. This does not override the Task 19 production sandbox blocker or authorize runnable publication.
- [x] Task 24: Pass sandbox abuse and execution-port contract gates — COMPLETE locally for the bounded fixture/control baseline; 14 abuse fixtures pass with no container residue, and Task 20/21 tests cover signed correlation, cancellation, fencing, teardown, and infrastructure classification. This does not approve Docker `runc` for hostile learner code while Task 19 remains open.

### Checkpoint F4: Execution safety

- [x] Six-language conformance is green.
- [x] Sandbox security and teardown gates are green for the bounded local fixtures and the remote gVisor candidate matrix.
- [x] Learner source may be privately stored but never executed in Next.js, general worker, browser origin or database host.
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
