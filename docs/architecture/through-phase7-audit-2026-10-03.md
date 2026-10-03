# AlgoCove audit through Phase 7

**Current-status supersession:** This dated record preserves its original baseline and test counts. [Runtime repair evidence](runtime-repair-evidence-2026-10-03.md) records subsequent authorized repairs, actual localhost authentication/persistence, fresh Linux results and retained local resources. Historical failure, skip, cleanup and advisory statements below must be read at their recorded time.

**Subsequent implementation update (2026-10-03):** The [real product and 3D UI evidence](phase7-production-ui-evidence-2026-10-03.md) records the replacement of fixture content administration, production identity persistence and fresh UI/execution gates. The results below describe their original audit baseline.

**Audit date:** 2026-10-03, Asia/Kolkata.

**Implementation baseline:** ecad9295c951f8790c8ba28a6d51e7a4767d4fed on main.

**Scope:** Phase 0 through Phase 7, including Tasks 6a, 13a, 25a, 25b and 51. Local testing and GitHub CI only; no live deployment.

## 1. Verdict

**No: “everything through Phase 7 is fully completed, including approvals, every edge case and all UI fidelity” is not supported by the evidence.**

The task ledger marks the scoped technical implementations in Phases 1–7 complete. Fresh automated gates pass, and Phase 7's deterministic AI-off planner, persistence, lifecycle, budgeting and learner interactions have coverage. This is a tested local engineering implementation with one reviewed two-pointer exercise, not a complete DSA course, production release, or certification that every possible defect has been eliminated.

Three qualifications prevent an unqualified completion claim:

1. **Phase 0 governance is open.** Tasks 1–4 and G0 remain unchecked. A0–A2 and P0–P4 do not have a consolidated accepted/narrowed decision record. Most ADRs remain Proposed. Later phase authorization and the explicit gVisor decision do not automatically approve every earlier product, privacy and infrastructure decision.
2. **UI fidelity and manual accessibility are incomplete.** Production assets, reference comparisons, screenshot baselines, responsive mockup approval and comprehensive manual assistive-technology review remain open in DESIGN.md and the design checklist. Passing rendered interactions, axe and reflow checks does not complete these deliverables.
3. **Two real full-stack execution tests are skipped in the current gate.** They have earlier local passing evidence from 2026-10-01, but were not rerun against the Phase 7 baseline. Current browser planning/review/progress journeys use explicit API fixtures, with separate real PostgreSQL and route-boundary coverage. There is no new live Clerk or live AI validation.

The implementation plan's Phase 1–5 detailed acceptance/verification boxes also remain unchecked despite the checked task ledger. Appendix D preserves their exact recorded state. This is a traceability inconsistency, not evidence that each corresponding implementation is absent. It should be reconciled against dated evidence rather than bulk-checking approvals.

## 2. Fresh test results

The full Linux workflow was rerun during this audit on the exact implementation baseline: [CI run 37051234150, attempt 2](https://github.com/vsuman00/AlgoCove/actions/runs/37051234150/attempts/2). All three jobs succeeded. Its tests run on disposable GitHub runners; the website was not deployed.

| Gate | Fresh result | Environment / limit |
|---|---|---|
| Repository verification | PASS: formatting, ESLint, root/web/worker TypeScript, token generation consistency, tests, Markdown links/fences, committed-secret scan | macOS and Linux CI |
| Pure unit tests | 165 passed, 34 files | Domain, application, adapters and execution contracts |
| Web tests | 63 passed, 14 files | jsdom components and authenticated route fixtures |
| Architecture tests | 4 passed, 1 file | Import direction, invalid dependency fixture, isolated-host dependencies |
| PostgreSQL integration | 55 passed; 2 skipped, 7 files total | Fresh Linux PostgreSQL + pgvector; 24 migrations |
| Production build | PASS | All implemented pages/API routes and middleware build; no deployment |
| Accessibility/browser suite | 25 passed | Chromium, axe, keyboard, reduced motion, narrow reflow and fixture-authenticated interactions |
| Browser journeys | 3 passed | Draft recovery; full roadmap lifecycle/replan; infeasible full-course recovery |
| Execution-result browser fixtures | 5 passed | Local Chromium; pass/wrong/compile/limit/infrastructure categories |
| Dependency audit | PASS: no known vulnerabilities reported | Advisory database result at audit time, not a penetration test |
| Runtime-image smoke | PASS for six language adapters | Four pinned image profiles |
| Semantic conformance | 36 correct executions pass; 6 mutated solutions rejected | Six semantic fixtures × six adapters, plus mutation negatives |
| Bounded abuse fixtures | 14 pass, no reported container residue | Packaging/control fixture baseline; distinct from approved learner-code isolation |
| gVisor runtime matrix | 36 normal/hostile cases pass; six concurrent startups pass | Six languages × two modes × three repetitions; explicit runsc |
| Additional static import audit | PASS: 23 domain files / 72 imports; 25 application files / 111 imports | TypeScript AST audit of imports, exports, dynamic import/require and relative boundary escapes |
| Additional responsive audit | 24/24 samples pass; zero page errors | Six routes × 320/768/1024/1440px; signed-out states only |

The normal test suites contribute 320 passing cases (232 unit/web/architecture + 55 database + 33 browser) and two skips. Runtime fixture matrices and the 24 layout samples are reported separately; they are not additional unique product requirements or a code-coverage percentage.

Commands used: pnpm verify; pnpm exec vitest run with JSON reporting; pnpm build; pnpm test:a11y; pnpm test:e2e; pnpm test:execution-browser; pnpm security:audit. pnpm 12.4.2 is pinned. Browser suites ran sequentially to avoid shared test-results directory collisions. Linux CI reran frozen installation, database integration, image builds/smokes, conformance, abuse and runsc gates.

Appendices A–C enumerate every executed named unit/web/architecture/browser case and every declared database case. Loop-driven assertions cover additional input combinations inside those cases; case counts are not assertion counts.

## 3. Phase and task closure

| Phase | Tasks | Verified technical behavior | Completion qualification |
|---|---|---|---|
| 0 | 1–4, G0 | Toolchain and local contracts exist in code; narrower explicit six-language, runsc and Phase 6/7 decisions are recorded | OPEN formal approvals, policy freeze and consolidated decisions. Proposed ADR-0015/0016/0017 files named in the plan do not exist |
| 1 | 5, 6, 6a, 7, 8, 9 | Pinned workspace/lockfile/CI; accessible shell; tokens; dependency boundaries; fail-closed configuration; IDs/time/errors; isolated migration/runtime roles and pgvector harness | Technical ledger closed; detailed plan boxes unreconciled; full design production assets/fidelity open |
| 2 | 10, 11, 12, 13, 13a | Clerk adapter and server-owned roles; owner-scoped optimistic profile; permission matrix and duty separation; idempotency/audit/outbox; telemetry redaction | Local technical closure plus prior owner live sign-up/sign-in/profile verification. No fresh live-provider handshake |
| 3 | 14–18 | Versioned acyclic curriculum; immutable rights/reviewed content; six distinct manifests; reviewed HTTPS metadata and collection deduplication; governed fixture admin preview | Admin UI is intentionally fixture-backed. No claim of production author/reviewer operations or third-party content ingestion |
| 4 | 19–24 | Approved runsc selection; signed descriptors/results, replay/lease fences; execution-control journal/relay; pinned runtime profiles; independent host judge; conformance/abuse/teardown | Fresh bounded CI; historical signed-image release evidence. Current ordinary CI is not fresh release-signature/vulnerability promotion evidence |
| 5 | 25, 25a, 25b, 26–29 | Owner-scoped attempt state; durable dispatch/trusted callback; drafts/revisions/offline recovery; structured readiness; trace edit/prediction/transcript; write-before-display hints; six-language learning workspace | Real full-stack six-language local proof is dated 2026-10-01. Current run skips two opt-in host tests; current rendered result checks are fixtures |
| 6 | 30–33 | Immutable canonical evidence and replay; assistance/source classes; delayed recall/transfer reviews; reasoned recommendation; separate mastery/language/confidence/external/adherence/consistency views | Fresh unit, route, DB and fixture browser coverage; declared policies are not calibrated learning efficacy |
| 7 | 34–37, 51 | Intent/revisions; validated previews and explicit fenced acceptance; one primary plan; capacity/prerequisites/reviews/buffers; immutable replan history; lifecycle/check-ins/corrections; bounded proposal fallback; quotas/breakers; complete AI-off UI | Technical F7 passes for reviewed pilot; live AI is Phase 9 Task 45a; full course/collections require later content. Phase 8 authorization remains open |

Dated supporting records: [Phase 2](phase2-evidence.md), [Phase 3](phase3-evidence.md), [Phase 4](phase4-evidence.md), [Phase 5](phase5-evidence.md), [Phase 6](phase6-evidence.md), [Phase 7](phase7-evidence.md), [task ledger](../../tasks/todo.md), [implementation plan](../../tasks/plan.md).

### Phase 0 details

- Task 1: Product/scope decisions and A0–A2/P0–P4 outcomes are not consolidated as accepted, narrowed, deferred or rejected.
- Task 2: Actual Node/pnpm/Next.js/TypeScript commands and CI exist; formal toolchain decision/approval and planned ADR-0015 remain open.
- Task 3: Authentication/provider ports and six-language execution controls exist; runsc has an explicit security-owner decision. The broader provider/runtime baseline, owners/deadlines and planned ADR-0016 are not a closed approval record.
- Task 4: Local source/data safeguards and per-learner proposal/execution limits exist; approved retention/legal regime, environment/global budget policy and pilot reliability targets are not a closed record. Planned ADR-0017 is absent.
- G0: All three approval checks remain unchecked. This report does not fabricate historical approvals.

## 4. Architecture and trust boundaries

### Dependency and composition

- Delivery composes application use cases and concrete adapters. Domain is dependency-free; application imports domain and owned local ports. Package manifests match that direction.
- All 48 domain/application TypeScript files were additionally scanned using the TypeScript AST: 183 import/export targets, no external adapter/framework imports, dynamic import/require or relative escapes under this audit's rules.
- The committed architecture suite additionally checks that execution-host does not depend on application persistence, identity, PostgreSQL or Clerk; a deliberately invalid domain React import is detected.
- These checks establish inspected dependency direction. The committed regex suite is not a complete security proof or universal future-import enforcement mechanism.

### Data, ownership and consistency

- PostgreSQL is transactional truth; pgvector is installed. Migration owner and runtime roles are distinct, runtime DDL/bookkeeping writes are denied, migrations are repeatable with immutable checksums.
- Request actor derives from verified authentication. Browser/provider metadata cannot assign AlgoCove roles or change resource ownership.
- Commands fence owned resources by expected versions; identical idempotency facts replay compatible receipts, altered facts conflict.
- Attempt/source observations and outbox commit atomically. Practice cannot directly award mastery: the mastery-owned consumer reloads canonical facts, deduplicates evidence, updates its projection and exposes pending watermarks.
- Content publication and accepted plans retain immutable versions. Rights/current availability override old version eligibility. Direct historical mutations fail; scoped privacy cascades are tested.
- Separate execution-control/host journals own leases, terminal state and result delivery. Learner source is absent from descriptor-only durable execution events and host lifecycle storage.

### Execution

- Next.js, the general application worker, browser origin and database host do not execute hostile learner source.
- Approved runsc executes six explicitly distinct language adapters in a dedicated Linux boundary; default runc is not approved for hostile learner submissions.
- Host-owned judging and signing occur outside learner workload. Printed success, zero exit status, forged verdicts and candidate normalization cannot establish correctness.
- Source/manifest/problem/attempt/run/replay/lease/key lineage is verified before observation commits. Confirmed teardown is required; failure becomes infrastructure error and quarantines the host, with no credit or replacement run.
- Current CI runsc probe uses bounded fixture resources and startup concurrency. It is not a production capacity, latency, cost, or isolation guarantee against every novel exploit.

### Planning and optional operations

- Reviewed content, authored estimates and deterministic validation own feasibility. AI proposal fixtures cannot publish, add content/URLs or override policy.
- Acceptance rechecks current intent, active token, eligible catalog and fixed history inside owner-serialized transactions.
- Due reviews and configurable recovery capacity precede required/optional work. No catch-up overload or invented full-course coverage.
- Reservations serialize request/unit/rate/pending admission; settlement is idempotent. Only infrastructure failures trip breakers; cooldown permits one pending probe, authorized reset is audited.
- Production composition remains AI-off. Fixtures test the provider-neutral proposal boundary. There is no live token-price/billing claim.

## 5. Edge-case coverage

| Area | Cases actually represented in tests |
|---|---|
| Primitive/configuration boundaries | Missing/invalid secrets, unsupported config, opaque ID kinds/formats, invalid timestamps/durations, stable redacted errors and telemetry secret/source canaries |
| Identity/authorization | Missing sessions, invalid provider subject, server-role lookup, ignored client/provider role claims, negative learner permissions, resource-owner mismatch, author/reviewer duty conflicts |
| Database/idempotency | Empty migrations, repeat application/checksum drift, runtime DDL denial, rollback usability, concurrent identical claims, changed-fact conflicts, response-loss retries, outbox atomic rollback |
| Curriculum/content | Cycles/edge kinds, pinned immutable versions, missing provenance/reviews/validation, wrong lifecycle transitions, expired rights/tombstones, mapping writes serialized with publication, private reviewed keys |
| External metadata | Non-HTTPS/lookalike/subdomain/provider-path inputs, reviewed canonical URLs, unavailable links, overlapping collections and metadata-only identity |
| Signed execution | Digest tampering, expiry, key rotation, wrong run/attempt/manifest/source/language/replay identity/lease, duplicated terminal delivery, cancellation, lost callback/source, restart, quarantine and invalid classifications |
| Semantics/runtime | Six adapters, shared small/empty/64-bit (including a negative input)/duplicate-order/Unicode/no-match semantic fixtures as defined in the manifest, wrong solutions, malformed/spoofed/expected-value output; separate JS/TS and C/C++ profiles |
| Abuse controls | Escape, egress, metadata, host credentials/files/socket, PID/thread/memory/CPU/disk/output exhaustion, path traversal/symlinks, signals/cancellation and teardown residue |
| Drafts/reasoning | Private artifacts, current snapshot vs explicit revision, optimistic conflict, offline/reload/reconnect, conflicting newer remote state, expiry/logout clearing, wrong structured keys, prose-only non-credit, tutor rewrite mismatch |
| Hints/visualization | Tier/kind/cap validation, cumulative assistance across attempts/languages, write-before-display, duplicate exposes, premature solution review, invalid trace retention, deterministic transcript/prediction, keyboard/reduced motion, hidden reference until persisted assistance |
| Mastery/relay | Duplicate/lost acknowledgement, immutable evidence, policy replay/watermark, empty projection rebuild, transactional projection failure, dead letters, assistance vs independent transfer, non-credit for infrastructure/cancellation/self-report |
| Reviews/recommendations | UTC windows across spring/autumn DST, leap/date boundaries, timezone-only presentation changes, overdue/deferral, repeated recall vs unseen delayed transfer, wrong answers, watermark deduplication, cold start, pending prerequisites, retired content, unavailable language, stable order/reasons |
| Progress/consistency | Captured local-timezone history, repeated observations/day deduplication, zero-grace rules, prospective pauses and timezone fences, no activity fabricated by pause, external corrections separate from verified mastery |
| Planning inputs | All five horizons, leap/month-end clamp, conflicting target date, invalid timezone/day/capacity/language/collection, changed-fact replay, midnight retries vs fresh backdating, competing revisions, outbox rollback and privacy cascades |
| Scheduler/validator | Five horizons × five capacities; five horizons × three buffers/missed-day variants; sparse/empty/full-course infeasibility, indivisible sessions, overlap deduplication, prerequisites, review windows/beyond-end reviews, invalid date/capacity/occurrence/target/buffer/required-work/unit/rights/link/language |
| Plan state/history | Competing acceptances, old receipt not rewinding pointer, stale intent/token and expiry, atomic item/journal/pointer/outbox rollback, pause/resume unchanged deadline, premature completion, archive/supersession, fixed timezone/language history, recovery/new-language occurrences, append-only cross-version correction, no mastery from check-ins |
| AI proposals/budgets | Valid, malformed, injected, over-capacity, bounded payload/schema, provider failure/timeout, unavailable/denied budgeting, no repeated provider call on ambiguous retry; concurrency/request/unit/rate caps, replay/conflict, rollback, idempotent finish, breaker cooldown/probe/reset |

These are finite authored fixtures and bounded scenario loops, not exhaustive state-space exploration. There is no measured 100% line/branch/mutation coverage report. Timezone sampling is finite. The exact named tests below are the source of truth for what ran.

## 6. UI and accessibility review

### Verified interactions

- Home: one reasoned next action with alternatives, cold-start/overdue/unavailable states, preferred language, truthful missing profile and signed-out recovery.
- Workspace: six-language editor, saved structured reasoning, trace/prediction/transcript, persisted hints, owned draft recovery, source/result separation and rendered terminal statuses.
- Review: keyboard answers, confidence receipt, overdue recovery and deferral.
- Progress: separate internal and learner-reported dimensions, explicit asOf/policy/timezone, prospective pause payload and conflict fences.
- Planner: create/save/reload preferences, month clamp, conflict preserving edits, preview/workload/assumptions/coverage/reasons, acceptance, done/missed/correction, pause/resume/replan/history and reasoned full-course rejection.
- Content preview/runtime profiles: accessible governed fixture/admin details, six adapter rows and truthful local-versus-hosted execution status.
- Shared shell: semantic tokens, labelled controls, skip navigation, 320px reflow, reduced motion and no advertised fake global controls.

The 25 accessibility checks and three journeys cover authenticated states using API fixtures; actual persistence/ownership is tested independently. The additional 24 viewport samples cover signed-out Home, Plan, Progress, Review, Onboarding and Workspace at 320, 768, 1024 and 1440px. Every sample returned HTTP 200, included main content and had no document horizontal overflow. There were zero uncaught page errors.

Desktop Home and narrow signed-out Plan screenshots were visually inspected. This confirms those rendered states were inspected, not approved fidelity against canonical references.

### UI deliverables still open

| Design IDs | Open evidence/deliverable |
|---|---|
| D-04 | Human-reviewed canonical production logo/lockups/favicon exports |
| D-05/D-06 | Font appearance specimen, licensing/provenance, self-hosted production delivery/fallback |
| D-08 | Full contrast/state matrix beyond sampled automated states |
| D-09 | Canonical icon specimen/reference comparison |
| D-10 | Approved optimized coastal illustration assets |
| D-11/D-12 | Desktop overlay measurements and approved responsive reference mockups |
| D-16 | Existing deterministic traces/transcripts do not establish matching approved visual snapshot baselines |
| D-19 | Approved mockups/wireframes and validation for the additional pages listed by DESIGN.md |
| D-20 | Comprehensive keyboard/screen-reader/live-update/manual assistive-technology review |
| D-21 | Committed screenshot baseline and reference approval |

D-01/D-02/D-03/D-07/D-13/D-15/D-17/D-18 are documentary decisions/specifications; D-14 tokens are implemented. Their documentary status does not complete the open assets above.

Chromium is the only configured browser. Firefox, Safari/WebKit, real mobile devices, comprehensive zoom and screen-reader sessions were not freshly tested. The observed overflow and duplicate Progress heading fixed during Phase 7 are recorded in its evidence; visual equivalence remains unvalidated.

## 7. Quality scenario scope

| Quality scenario | Through-Phase-7 evidence / boundary |
|---|---|
| QS-01 | Authored hint-tier/solution gate negatives; live tutor benchmark later |
| QS-02 | Concurrent submit/source/evidence idempotency fixtures |
| QS-03 | Planner provider timeout/failure fallback; streaming tutor later |
| QS-04 | Retrieval latency/corpus benchmark later, not implemented evidence |
| QS-05 | Privacy cascades only; full deletion/backups workflow Phase 11 |
| QS-06 | Proposal injection/schema rejection; retrieval content quarantine later |
| QS-07 | Automated keyboard/reduced motion/text trace; comprehensive manual review open |
| QS-08 | Hosted restore/RPO/RTO later; local transaction/host-failure fixtures are narrower |
| QS-09 | Optional admission/load-shedding fixtures; production saturation/SLO later |
| QS-10 | Local execution/evidence/plan lineage; long-lived tutor lineage later |
| QS-11 | Provider-neutral proposal/identity ports; no live second-model integration |
| QS-12 | Current content rights/tombstones checked; future retrieval/cache reconciliation later |
| QS-13 | Atomic local request/unit allowance and baseline fallback; live costing/production global controls later |
| QS-14 | Deterministic machine-readable and learner-readable recommendation reasons |
| QS-15 | Empty projection replay, watermarks and policy comparisons |
| QS-16 | Six-language shared semantic conformance |
| QS-17 | Fresh bounded abuse and runsc matrix; not an exhaustive exploit or production SLO test |
| QS-18 | Pinned images plus historical signed/scanned release; new promotion/rollback gate not freshly rerun |
| QS-19 | Metadata-only external references now; outbound readiness/handoff journey Phase 8 |
| QS-20 | All supported horizons, bounded scheduling and reasoned rejection |
| QS-21 | Authored write-before-display and strict proposal handling; tutor browser/network adversarial disclosure later |
| QS-22 | Host comparator, result tamper and forged-verdict negatives |
| QS-23 | Concurrent acceptance/token conflict and one active primary plan |
| QS-24 | Structured/private-key evidence vs prose/advisory/self-report separation |
| QS-25 | Offline/reconnect/conflict/expiry/logout recovery |
| QS-26 | Sparse curriculum rejection and truthful coverage, not a qualified full course |
| QS-27 | Local current rights/runtime eligibility and historical metadata; future export/retrieval/cache paths not yet implemented |

## 8. Historical evidence and skips

The two skipped tests are in [local-learning-loop.test.ts](../../tests/integration/local-learning-loop.test.ts), guarded by LOCAL_PHASE5_E2E=1 and requiring the disposable local Linux host configuration:

1. Completes reasoning, trace, hints, Run/Submit and submitted-state resume in all six languages.
2. Cancels real execution, recovers a killed host without credit, and rejects missing images in every language.

Both passed on 2026-10-01 with fixture authentication, actual application routes, real PostgreSQL, gVisor and signed callbacks. The [machine-readable browser report](evidence/f5-browser-2026-10-01.json) records actual six-language results, trace/readiness, changed-source non-credit, cancellation and host crash. The [runner matrix](evidence/f5-matrix-2026-10-01.json) has 36/36 passing outcome checks; the [host boundary report](evidence/f5-boundaries-2026-10-01.json) has 5/5 passing checks. Every recorded matrix/boundary outcome has confirmed teardown.

These remain dated historical evidence. In particular, the browser report identifies Next.js 16.3.5 at capture; current code uses 16.3.6 and Phase 7 added execution budgeting. Current unit/DB/fixture-browser regressions pass, but this audit does not substitute them for a fresh end-to-end current-head host run.

Earlier manual Clerk evidence is owner-provided in Phase 2. The historical runtime-image release [35261137554](https://github.com/vsuman00/AlgoCove/actions/runs/35261137554) records pushed/scanned/keyless-signed images. The fresh ordinary CI builds local test images with attestations disabled; it does not republish or freshly sign them.

## 9. Minor corrections made during this audit

- ADR index now matches ADR-0013's existing Accepted-for-local-Phase-7 status.
- Plan command surface now states the scripts exist while keeping formal Phase 0 approval open.
- Phase 6 evidence assigns account deletion to Phase 11 Task 52 rather than Phase 9.
- Design checklist now records functional Workspace/Planner implementation and preserves the missing visual approval.
- Home no longer says planning and real local execution proof are future work.
- Runtime evidence page now distinguishes the passed historical local learning loop, removed temporary host and unauthorised hosted release. It explicitly does not report current runtime availability.
- Runtime browser assertion was updated to check the corrected local-versus-hosted message.

No underlying policy, authorization, schema, scheduler or execution behavior was changed. No approvals were invented. The ad hoc viewport harness initially used the wrong working directory, then waited for network idle despite background requests; these harness attempts failed before completing the matrix. The corrected harness used the web-app directory and visible main/font readiness, then passed all 24 samples. Baseline standard gates had no failures. The initial audit copy edit introduced a JSX apostrophe lint error; the wording was corrected before the final verification gate.

Non-failing warnings observed: Playwright/Node NO_COLOR versus FORCE_COLOR; pnpm setup's dependency emits a url.parse deprecation warning in CI. These are not represented as passing functional assertions or known production defects.

## 10. What remains before broader completion

- Reconcile Phase 0 approvals, ADR statuses, policy baseline and detailed Phase 1–5 plan checkboxes with actual owner decisions/evidence.
- Produce and approve the required UI assets and reference screenshot/mockup comparisons; complete manual accessibility evidence.
- Rerun the two opt-in real-host scenarios against the current code to remove the current-head full-stack validation gap.
- Phase 8 remains unstarted pending owner authorization. Outbound readiness/handoff is future work, not an existing completed journey.
- Live tutor/retrieval/planner providers and evaluations belong to Phase 9; broader pilot curriculum/manual accessibility to Phase 10; privacy/operations to Phase 11; hosted pilot to Phase 12; coverage-qualified full DSA to Phase 13.
- No production performance/load, hosted restore/rollback, legal-retention approval, learner efficacy or complete named-sheet coverage is claimed.

## 11. Cleanup and reproducibility

No VM or native PostgreSQL installation was created for this audit. Fresh database/runtime gates used disposable GitHub-hosted runners. All localhost browser processes were terminated; ports 3100 and 3200 were checked afterward. Earlier Phase 5 VM deletion and Phase 6/7 native database cleanup remain documented in their dated records. No live deployment occurred.

The report and [machine-readable audit summary](evidence/through-phase7-audit-2026-10-03.json) preserve named cases and requirement status rather than raw environment/credential output. Temporary audit logs, JSON and inspection screenshots are scratch evidence; workspace dependencies and the production build are retained.

## Appendix A. Every fresh unit, web and architecture case

Cases below come from the successful Vitest JSON report, not inference from filenames.

### tests/architecture/import-boundaries.test.ts — 4 passed

- PASS: package import boundaries keeps the domain dependency-free
- PASS: package import boundaries keeps application code behind domain-owned ports
- PASS: package import boundaries keeps the isolated source host independent of application persistence and identity
- PASS: package import boundaries detects the deliberately invalid dependency fixture

### tests/unit/code-run-use-cases.test.ts — 5 passed

- PASS: Task 25a code-run application boundary preserves booleans, unknown assistance and the safe digest in assessment events
- PASS: Task 25a code-run application boundary commits a durable run request before dispatch and preserves it when the relay response is lost
- PASS: Task 25a code-run application boundary keeps Run non-assessing and commits Submit observation/outbox exactly once
- PASS: Task 25a code-run application boundary rejects a result whose source, problem, language, or manifest does not match the run
- PASS: Task 25a code-run application boundary reconciles a lost response without replacing the run or duplicating assessment effects

### tests/unit/content-lifecycle.test.ts — 5 passed

- PASS: governed content lifecycle blocks publication until both reviews and validation pass
- PASS: governed content lifecycle publishes an original version only after separated approvals and validation
- PASS: governed content lifecycle rejects copied licensed statements at draft creation
- PASS: governed content lifecycle tombstones withdrawn rights while retaining safe historical metadata
- PASS: governed content lifecycle blocks publication when rights have expired

### tests/unit/contracts/application-contracts.test.ts — 4 passed

- PASS: request context builds server-owned identity, time, and correlation values
- PASS: request context regenerates unsafe correlation values and rejects forged actor data
- PASS: request context enforces role and ownership checks without revealing another learner
- PASS: error contract removes secret-shaped details and unknown causes from public envelopes

### tests/unit/contracts/authorization.test.ts — 3 passed

- PASS: authorization contract covers every role with an explicit least-privilege permission set
- PASS: authorization contract rejects an actor who spans separated content responsibilities
- PASS: authorization contract enforces permissions at the application boundary

### tests/unit/contracts/clerk-auth.test.ts — 3 passed

- PASS: Clerk identity boundary maps a Clerk subject to an opaque learner and loads roles from the server store
- PASS: Clerk identity boundary rejects signed-out and malformed Clerk auth state
- PASS: Clerk identity boundary does not trust roles, learner IDs, or session IDs supplied in Clerk metadata

### tests/unit/contracts/configuration.test.ts — 10 passed

- PASS: validated configuration applies safe development defaults
- PASS: validated configuration parses explicit values without changing the secret boundary
- PASS: validated configuration reports all schema and cross-field failures without including values
- PASS: validated configuration rejects an identical runtime and migration connection
- PASS: validated configuration enforces production transport and runtime database requirements
- PASS: validated configuration requires an internal result callback token when production execution is enabled
- PASS: validated configuration requires the relay URL and token as a pair
- PASS: validated configuration requires a secure relay URL when production execution is enabled
- PASS: validated configuration requires Clerk keys together and redacts both values
- PASS: validated configuration redacts registered secrets from diagnostic text

### tests/unit/contracts/domain-primitives.test.ts — 10 passed

- PASS: opaque identifiers round-trips generated identifiers across the trust boundary
- PASS: opaque identifiers rejects short (too short)
- PASS: opaque identifiers rejects 00000000000000000000000000000000000000000000000000000 (too long)
- PASS: opaque identifiers rejects contains_illegal_character (ambiguous punctuation)
- PASS: opaque identifiers rejects a valid identifier with the wrong kind prefix
- PASS: server-controlled time and bounded values normalizes offsets to a millisecond UTC instant
- PASS: server-controlled time and bounded values rejects out-of-range durations and prevents instant overflow
- PASS: boundary hygiene accepts runtime-supported time zones and rejects unknown zones
- PASS: boundary hygiene normalizes line endings and removes control characters
- PASS: boundary hygiene validates immutable content checksums

### tests/unit/contracts/learner-profile.test.ts — 3 passed

- PASS: learner profile contract validates timezone, capacity, horizon, accessibility, and languages
- PASS: learner profile contract allows the owner to create and update a profile with an audit version
- PASS: learner profile contract does not allow a learner to read or mutate another learner profile

### tests/unit/contracts/observability.test.ts — 3 passed

- PASS: observability contract keeps stable correlation and outcome fields
- PASS: observability contract does not serialize source, prompts, tokens, or arbitrary fields
- PASS: observability contract bounds invalid telemetry values instead of leaking them

### tests/unit/contracts/platform-primitives.test.ts — 4 passed

- PASS: platform primitives redacts source material and secret-shaped values while retaining safe metadata
- PASS: platform primitives retains signed execution digests without permitting source material
- PASS: platform primitives claims an effect once and replays the stored response
- PASS: platform primitives rejects hash reuse and exposes no request data in the conflict

### tests/unit/curriculum.test.ts — 5 passed

- PASS: curriculum graph contract preserves required, recommended, and related edge semantics
- PASS: curriculum graph contract rejects a graph with a cycle across any edge kind
- PASS: curriculum graph contract rejects an edge that references a concept outside the graph
- PASS: curriculum graph contract publishes a validated version as a copied immutable snapshot
- PASS: curriculum graph contract requires the publisher permission at the application boundary

### tests/unit/execution-contracts.test.ts — 7 passed

- PASS: signed execution contracts accepts only source and selected published language from the learner
- PASS: signed execution contracts binds the descriptor to manifest, image, fixture, limits, expiry, and lease
- PASS: signed execution contracts signs and verifies a descriptor, then rejects payload tampering
- PASS: signed execution contracts rejects expired descriptors and supports old keys only in the rotation window
- PASS: signed execution contracts classifies terminal results and fences stale lease epochs and replays
- PASS: signed execution contracts rejects unsupported schema versions and invalid terminal classifications
- PASS: signed execution contracts does not accept a mismatched generated signing key

### tests/unit/execution-control.test.ts — 10 passed

- PASS: execution-control service boundary restores a durable queue and fences active work after restart
- PASS: execution-control service boundary serves authenticated control over loopback with bounded requests
- PASS: execution-control service boundary stops control after a journal write failure
- PASS: execution-control service boundary rejects browser-origin calls and accepts only authenticated internal relay calls
- PASS: execution-control service boundary deduplicates concurrent dispatches and queues beyond the per-profile quota
- PASS: execution-control service boundary leases one run, fences a lost worker, and never auto-replaces uncertain execution
- PASS: execution-control service boundary lets a terminal result win a cancellation race and deduplicates terminal effects
- PASS: execution-control service boundary forwards only control-plane terminal results after teardown confirmation
- PASS: execution-control service boundary converts teardown failure into an infrastructure terminal result
- PASS: execution-control service boundary creates a descriptor-only relay message and rejects arbitrary payload fields

### tests/unit/execution-host.test.ts — 6 passed

- PASS: local isolated source host uses host OOM evidence for lost runtime RPCs instead of trusting stderr
- PASS: local isolated source host verifies a freshly signed descriptor after its issue time
- PASS: local isolated source host waits for ephemeral source when the descriptor outbox wins the admission race
- PASS: local isolated source host enforces runsc and host judging, and overrides a pass if teardown cannot be confirmed
- PASS: local isolated source host durably deduplicates admission, retries callback after restart and rejects forged results
- PASS: local isolated source host retains cancel-before-admission across host restarts

### tests/unit/execution-images.test.ts — 2 passed

- PASS: execution image profiles covers six languages with immutable base digests and fixed non-root policy
- PASS: execution image profiles keeps TypeScript type-check and transpile as separate fixed commands

### tests/unit/external-references.test.ts — 3 passed

- PASS: reviewed external references accepts only provider-owned HTTPS metadata URLs
- PASS: reviewed external references requires a review before outbound navigation
- PASS: reviewed external references deduplicates one provider identity across overlapping collections

### tests/unit/hints.test.ts — 5 passed

- PASS: Task 28 deterministic authored hints persists exposure before returning authored text and replays the same request
- PASS: Task 28 deterministic authored hints rejects premature solution review and preserves state when the exposure write fails
- PASS: Task 28 deterministic authored hints rejects an idempotency race whose exposure belongs to another problem version
- PASS: Task 28 deterministic authored hints keeps the ladder deterministic and cumulative across attempts
- PASS: Task 28 deterministic authored hints does not expose another learner's authored assistance

### tests/unit/language-conformance.test.ts — 3 passed

- PASS: trusted language-conformance judge normalizes UTF-8 line endings and NFC labels without accepting extra output
- PASS: trusted language-conformance judge rejects a candidate verdict and an expected-value spoof
- PASS: trusted language-conformance judge produces stable checksums for manifest lineage

### tests/unit/language-manifest.test.ts — 5 passed

- PASS: six-language problem manifest declares exactly the six supported language IDs
- PASS: six-language problem manifest requires every language to map to the same semantic fixtures
- PASS: six-language problem manifest exposes missing language support instead of generalizing publication
- PASS: six-language problem manifest keeps JavaScript and TypeScript, and C and C++, distinct adapters
- PASS: six-language problem manifest rejects a manifest that silently changes a language limits profile

### tests/unit/mastery-relay.test.ts — 3 passed

- PASS: mastery outbox delivery loads committed source facts by ID and ignores a forged claimed payload
- PASS: mastery outbox delivery retries source effects after a lost acknowledgement and caps repeated failures
- PASS: mastery outbox delivery leaves unmapped assessments pending without inventing concept evidence

### tests/unit/mastery.test.ts — 8 passed

- PASS: Task 30 deterministic evidence projection keeps explanation-only evidence out of completion and language counts, and uses prior reviewed explanations under a requiring policy
- PASS: Task 30 deterministic evidence projection replays unordered and duplicated observations to the same watermark and reasons
- PASS: Task 30 deterministic evidence projection changes the watermark when a backfilled source replaces another with the same count and latest observation
- PASS: Task 30 deterministic evidence projection keeps solution disclosure and unknown historical assistance below independent transfer
- PASS: Task 30 deterministic evidence projection isolates compile/type feedback and ignores infrastructure/cancellation for concept credit
- PASS: Task 30 deterministic evidence projection excludes advisory/self-reported correctness and transfer
- PASS: Task 30 deterministic evidence projection compares policies without rewriting input facts or evidence watermarks
- PASS: Task 30 deterministic evidence projection rejects malformed, cross-owner and conflicting source facts

### tests/unit/phase6-policies.test.ts — 5 passed

- PASS: Phase 6 policy contracts stores elapsed UTC review windows through spring and autumn DST
- PASS: Phase 6 policy contracts deduplicates activity and credits paused days without fabricating activity
- PASS: Phase 6 policy contracts uses cold-start intro, due reviews, and excludes retired/unavailable languages
- PASS: calendar and recommendation scenario properties keeps calendar days stable across DST, leap day and international date boundaries
- PASS: calendar and recommendation scenario properties uses prerequisites, uncertainty, diversity and stable reasons regardless of candidate order

### tests/unit/plan-adherence.test.ts — 2 passed

- PASS: accepted plan adherence projection separates no plan, paused obligations and reported check-ins
- PASS: accepted plan adherence projection counts retained occurrences once across versions and reverses via appended events

### tests/unit/plan-proposal.test.ts — 7 passed

- PASS: bounded fixture proposals falls back on malformed without losing the baseline
- PASS: bounded fixture proposals falls back on injected without losing the baseline
- PASS: bounded fixture proposals falls back on over_capacity without losing the baseline
- PASS: bounded fixture proposals falls back on failure without losing the baseline
- PASS: bounded fixture proposals falls back on timeout without losing the baseline
- PASS: bounded fixture proposals validates fixture output without activation rights
- PASS: bounded fixture proposals budget denial yields a baseline and does not call a provider

### tests/unit/practice.test.ts — 6 passed

- PASS: learning session and attempt state machines starts a mode-pinned session and version-pinned attempt without source data
- PASS: learning session and attempt state machines records meaningful source and run events with optimistic version increments
- PASS: learning session and attempt state machines makes submit terminal and rejects later mutations
- PASS: learning session and attempt state machines allows only one monotonic terminal transition
- PASS: learning session and attempt state machines creates an explicit new attempt when language changes
- PASS: learning session and attempt state machines rejects changing to the same language and oversized source snapshots

### tests/unit/pseudocode-use-cases.test.ts — 3 passed

- PASS: Task 26 pseudocode application boundary requires explicit saves and fences another writer
- PASS: Task 26 pseudocode application boundary uses only version-matched authored checks and verified runs for readiness
- PASS: Task 26 pseudocode application boundary keeps another learner, including tutor-context callers, outside the artifact

### tests/unit/pseudocode.test.ts — 4 passed

- PASS: Task 26 structured pseudocode and readiness requires saved authored answers even with filled prose and a verified passing submission
- PASS: Task 26 structured pseudocode and readiness keeps current editing separate from explicit append-only revisions
- PASS: Task 26 structured pseudocode and readiness does not infer readiness from nonempty prose or mismatched evidence
- PASS: Task 26 structured pseudocode and readiness rejects oversized fields and non-monotonic edits

### tests/unit/roadmap-intent.test.ts — 4 passed

- PASS: Task 34 planning preferences uses all declared horizons and clamps calendar-month ends, including leap years
- PASS: Task 34 planning preferences normalizes preferences and resolves matching explicit target dates
- PASS: Task 34 planning preferences rejects unsupported horizons, invalid dates, missing capacity/languages, duplicate collections and weekdays
- PASS: Task 34 planning preferences uses the selected timezone for prospective-date validation at a UTC boundary

### tests/unit/roadmap-scheduler.test.ts — 8 passed

- PASS: roadmap scheduler and publication validator all horizons and capacities produce valid bounded schedules or explicit indivisible rejection
- PASS: roadmap scheduler and publication validator clamps leap years and month ends and never pads sparse or full-course goals
- PASS: roadmap scheduler and publication validator deduplicates collection overlap, reserves reviews first and carries beyond-end reviews
- PASS: roadmap scheduler and publication validator preserves history and previews moved/removed/added work without catch-up overload
- PASS: roadmap scheduler and publication validator rejects each invalid publication boundary
- PASS: roadmap scheduler and publication validator blocks prerequisites, infeasible review spacing and missing content
- PASS: calendar properties and configurable recovery respects buffers, missed sessions and optional extensions across capacities and all horizons
- PASS: calendar properties and configurable recovery pins representative supported-horizon summaries

### tests/unit/sandbox-security.test.ts — 1 passed

- PASS: sandbox abuse fixture contract covers every bounded Task 24 threat with conservative limits

### tests/unit/sandbox-spike.test.ts — 1 passed

- PASS: sandbox-selection spike runtime contract requires an explicitly selected Docker runtime for candidate evidence

### tests/unit/save-draft.test.ts — 3 passed

- PASS: Task 25b recoverable drafts replaces current snapshots and appends only explicit saved revisions
- PASS: Task 25b recoverable drafts rejects stale writers without overwriting the newer current snapshot
- PASS: Task 25b recoverable drafts clears all owner-scoped recovery state without retaining keystroke history

### tests/unit/visualizer.test.ts — 3 passed

- PASS: Task 27 deterministic trace protocol replays the same bounded trace into the same state and transcript
- PASS: Task 27 deterministic trace protocol fails closed on unknown events, invalid pointers, and out-of-range steps
- PASS: Task 27 deterministic trace protocol labels reviewed reference disclosure as assistance instead of inventing source traces

### tests/unit/web/auth-config.test.ts — 2 passed

- PASS: Clerk runtime configuration requires non-empty publishable and secret keys
- PASS: Clerk runtime configuration reads process environment values without exposing them

### tests/unit/web/auth-routes.test.ts — 3 passed

- PASS: Clerk session route returns an internal actor projection for a verified Clerk session
- PASS: Clerk session route returns 401 for a signed-out Clerk session
- PASS: Clerk session route returns 401 without invoking Clerk when local keys are absent

### tests/unit/web/content-read-models.test.ts — 1 passed

- PASS: content operations fixture read model shows complete separated review evidence but keeps runnable publication blocked

### tests/unit/web/draft-sync.test.ts — 4 passed

- PASS: Task 25b browser draft synchronization recovers one current snapshot after reload and clears it after server acknowledgement
- PASS: Task 25b browser draft synchronization keeps local work and exposes the newer remote draft on a two-tab conflict
- PASS: Task 25b browser draft synchronization retains a bounded local snapshot while offline and clears all learner recovery on logout
- PASS: Task 25b browser draft synchronization does not recover a local snapshot after the server expiry boundary

### tests/unit/web/execution-client.test.ts — 8 passed

- PASS: HTTP execution relay adapter keeps preparation descriptor-only and sends source only on dispatch
- PASS: HTTP execution relay adapter rejects source mismatches before making an internal request
- PASS: HTTP execution relay adapter rejects a relay response that tries to persist raw source material
- PASS: HTTP execution relay adapter rejects a preparation for another event before the outbox can be saved
- PASS: HTTP execution relay adapter rejects a preparation receipt that labels the dispatch token for another run
- PASS: HTTP execution relay adapter rejects a descriptor with a mismatched source digest
- PASS: HTTP execution relay adapter rejects a descriptor with a mismatched problem version
- PASS: HTTP execution relay adapter rejects a descriptor with a mismatched language

### tests/unit/web/mastery-route.test.ts — 3 passed

- PASS: authenticated mastery route requires authentication before reading the projection
- PASS: authenticated mastery route derives the owner from authentication and preserves pending and watermark information
- PASS: authenticated mastery route does not expose another owner's observation and rejects invalid identifiers

### tests/unit/web/onboarding-routes.test.ts — 3 passed

- PASS: onboarding route requires a verified Clerk session
- PASS: onboarding route creates and updates the authenticated learner's versioned profile
- PASS: onboarding route returns a clean unauthenticated response when local Clerk keys are absent

### tests/unit/web/phase6-routes.test.ts — 4 passed

- PASS: Phase 6 private routes authenticates all six endpoints before accessing persistence
- PASS: Phase 6 private routes derives review ownership from authentication and reports missing persistence
- PASS: Phase 6 private routes returns a durable pending receipt when immediate projection delivery fails
- PASS: Phase 6 private routes rejects malformed source identifiers, confidence, dates and journal commands

### tests/unit/web/practice-draft-routes.test.ts — 13 passed

- PASS: authenticated practice draft routes withholds the reviewed trace until owned assistance persistence succeeds
- PASS: authenticated practice draft routes fails closed for signed-out draft creation
- PASS: authenticated practice draft routes starts an owner-scoped source draft and replaces its current snapshot
- PASS: authenticated practice draft routes does not expose an unavailable draft to an owner that cannot load it
- PASS: authenticated practice draft routes reports unavailable practice persistence without fabricating workspace state
- PASS: authenticated practice draft routes recovers workspace bootstrap races through the unique active keys
- PASS: authenticated practice draft routes does not hide a partially persisted terminal execution result
- PASS: authenticated practice draft routes requires authentication before accepting a hint exposure request
- PASS: authenticated practice draft routes fails closed when the isolated execution relay is not configured
- PASS: authenticated practice draft routes returns owner-scoped queued and trusted terminal run status
- PASS: authenticated practice draft routes returns a saved submission receipt and visible pending mastery
- PASS: authenticated practice draft routes cancels an owned run through the authenticated relay boundary
- PASS: authenticated practice draft routes rejects an unauthenticated internal execution result callback

### tests/unit/web/problem-workspace.test.tsx — 8 passed

- PASS: Task 29 guided problem workspace keeps the critical path visible and fails closed when execution is unavailable
- PASS: Task 29 guided problem workspace keeps language source and authored hint controls explicit
- PASS: Task 29 guided problem workspace loads the private workspace and sends edited source to the durable route
- PASS: Task 29 guided problem workspace preserves unsynced local recovery and queues it for durable sync
- PASS: Task 29 guided problem workspace sends Run through the authenticated execution boundary and shows queued state
- PASS: Task 29 guided problem workspace restores a committed terminal result from workspace bootstrap
- PASS: Task 29 guided problem workspace cancels a queued run and waits for the trusted cancelled result
- PASS: Task 29 guided problem workspace serializes slow remote saves so newer edits use the latest version

### tests/unit/web/roadmap-intent-route.test.ts — 4 passed

- PASS: private planning preference routes authenticates before accessing read or write persistence
- PASS: private planning preference routes derives the owner from the session and persists only normalized preferences
- PASS: private planning preference routes rejects invalid horizons, forged plan identifiers, mismatched target dates and version tokens
- PASS: private planning preference routes reports unavailable persistence without fabricating an active plan

### tests/unit/web/roadmap-route.test.ts — 4 passed

- PASS: roadmap route authentication and boundary validation authenticates before reads and commands
- PASS: roadmap route authentication and boundary validation derives owner from session and ignores browser activation/validation claims
- PASS: roadmap route authentication and boundary validation rejects forged identifiers, absent tokens, unsupported actions and invalid occurrence commands
- PASS: roadmap route authentication and boundary validation reports unavailable persistence honestly

### tests/unit/web/routes.test.tsx — 4 passed

- PASS: health route stays live without configuration or database access
- PASS: readiness route reports invalid configuration without disclosing values
- PASS: readiness route reports a valid local configuration without pretending an absent database is ready
- PASS: error boundary offers an accessible retry and home recovery path

### tests/unit/web/trace-renderer.test.tsx — 2 passed

- PASS: Task 27 accessible trace renderer supports keyboard and labeled controls without relying on color or motion
- PASS: Task 27 accessible trace renderer fails closed and explains the reviewed-reference fallback

### tests/unit/worker-relay.test.ts — 11 passed

- PASS: application outbox execution relay connects the website adapter to local preparation, dispatch and cancellation endpoints
- PASS: application outbox execution relay never repeats an uncertain source dispatch
- PASS: application outbox execution relay rejects expired tokens and cancellation before preparation
- PASS: application outbox execution relay prepares a source-free website descriptor and deduplicates source dispatch
- PASS: application outbox execution relay does not acknowledge rejected authentication
- PASS: application outbox execution relay does not acknowledge another run's receipt
- PASS: application outbox execution relay requires a loopback control URL for local dispatch
- PASS: application outbox execution relay replays a lost HTTP admission response after control restart without leasing twice
- PASS: application outbox execution relay delivers a verified descriptor message and acknowledges it
- PASS: application outbox execution relay releases a claim for retry when the execution-control sink fails
- PASS: application outbox execution relay sends only the signed result envelope to the authenticated application callback

## Appendix B. Every database integration case

55 pass and two explicitly marked skips, verified from the fresh CI run. Counts by file: database lifecycle 13, practice 8, mastery replay 6, Phase 6 learning 8, roadmap intent 7, roadmap 13; optional local learning loop 2 skipped.

### tests/integration/db-lifecycle.test.ts

- PASS: installs the vector extension and owns the platform schema with the migration role
- PASS: applies migrations idempotently and records immutable checksums
- PASS: lets the runtime role read bounded readiness data
- PASS: prevents the runtime role from changing schema or migration bookkeeping
- PASS: rolls back failed transactions and leaves the runtime connection usable
- PASS: persists Clerk identity, server roles, and an optimistic learner profile
- PASS: replays idempotent effects and persists immutable audit plus outbox records
- PASS: deduplicates concurrent claims and rolls back outbox work atomically
- PASS: claims execution dispatches with a lease and supports retry release
- PASS: pins curriculum graph rows and blocks mutation after publication
- PASS: stores original problem metadata and blocks published payload mutation
- PASS: installs six distinct language profiles and protects published manifests
- PASS: deduplicates reviewed external references across collections and rejects lookalike hosts

### tests/integration/local-learning-loop.test.ts

- SKIPPED (historical pass 2026-10-01): completes reasoning, trace, hints, Run/Submit and submitted-state resume in all six languages
- SKIPPED (historical pass 2026-10-01): cancels real execution, recovers a killed host without credit, and rejects missing images in every language

### tests/integration/mastery-replay.test.ts

- PASS: snapshots assistance, reports pending, and commits concurrent duplicate delivery once
- PASS: rebuilds an empty read model and compares policies without rewriting facts
- PASS: carries persisted strategy disclosure across languages without changing earlier observations
- PASS: rolls back evidence and projection if the transactional outbox write fails
- PASS: rejects historical rewrites while allowing source privacy deletion to cascade
- PASS: retries a lost acknowledgement without duplicate effects and persists terminal dead letters

### tests/integration/phase6-learning.test.ts

- PASS: persists code activity and detects unconsumed sources before showing credit
- PASS: grades saved structured answers, keeps prose advisory, deduplicates confidence and rejects other owners
- PASS: answers an overdue independent transfer once under concurrent retries and schedules the next watermark
- PASS: defers without erasing history and treats repeated exercises as recall, including wrong answers
- PASS: separates external reports and immutable timezone history, with prospective pause fences
- PASS: rebuilds all source kinds without changing their facts or review identities
- PASS: authors mappings only on owned drafts and invalidates prior review decisions
- PASS: enforces reviewed keys, publication duties and availability

### tests/integration/practice.test.ts

- PASS: persists owner-scoped attempts and fences competing optimistic writes
- PASS: atomically records a language reset and returns only the owner's history
- PASS: replaces current drafts and appends only explicit saved revisions
- PASS: persists structured pseudocode current fields and append-only revisions privately
- PASS: commits authored hint exposure before returning the hint and replays idempotently
- PASS: rejects authored hint content when its kind does not match its ladder tier
- PASS: runs application orchestration against PostgreSQL and preserves lost dispatches
- PASS: commits a submit result, immutable observation, and outbox event as one idempotent boundary

### tests/integration/roadmap-intent.test.ts

- PASS: starts empty and commits concurrent identical saves once with immutable receipts and outbox
- PASS: rejects changed facts on replay, unsupported collections and another owner’s plan
- PASS: serializes competing edits and preserves the original revision and old command receipt
- PASS: replays a saved command across midnight without allowing a new backdated save
- PASS: rolls back preference, pointer, collection and command writes if outbox persistence fails
- PASS: guards immutable history, identity, pointer integrity and cross-owner foreign keys
- PASS: allows learner privacy cascades without allowing direct history deletion

### tests/integration/roadmap.test.ts

- PASS: persists AI-off previews, retries once, rejects changed command facts, and isolates owners
- PASS: atomically activates one competing candidate and replays the original acceptance receipt
- PASS: checks lifecycle tokens, keeps pause/resume deadline fixed and blocks premature completion
- PASS: replans missed sessions with a diff, preserves completed work and historical check-ins across timezone/goal changes
- PASS: appends corrections, preserves receipts, and completes without creating mastery evidence
- PASS: pins completed language history while scheduling deliberate practice in a newly selected language
- PASS: rejects stale preference versions and expired candidates
- PASS: guards immutable schedules, journal ownership and kind-specific targets; privacy cascades remove only owned state
- PASS: rolls back activation, items, journal and candidate status when outbox insertion fails
- PASS: caps concurrent atomic reservations, replays without charging twice and denies changed facts
- PASS: enforces exhaustion/rate caps, sheds optional work without blocking intent writes, and rolls back reservations
- PASS: opens breakers only on infrastructure failure, finishes once, admits one cooldown probe and resets administratively
- PASS: read models retain historical adherence without treating learner reports as mastery

## Appendix C. Every fresh browser case and additional viewport sample

### Accessibility — 25 passed

- PASS: tests/accessibility/design-shell.spec.ts:5:3 › Learner Home shell › has no automatically detectable accessibility violations
- PASS: tests/accessibility/design-shell.spec.ts:38:3 › Learner Home shell › does not advertise unimplemented global controls
- PASS: tests/accessibility/content-operations.spec.ts:14:3 › Content operations fixture › renders the detail workflow without narrow-screen overflow
- PASS: tests/accessibility/content-operations.spec.ts:5:3 › Content operations fixture › renders the governed candidate and lifecycle blocker accessibly
- PASS: tests/accessibility/design-shell.spec.ts:13:3 › Learner Home shell › supports keyboard skip navigation and labeled controls
- PASS: tests/accessibility/design-shell.spec.ts:47:3 › Learner Home shell › shows real authentication entry points without a placeholder identity
- PASS: tests/accessibility/design-shell.spec.ts:69:3 › Learner Home shell › reflows at the narrowest supported shell width
- PASS: tests/accessibility/design-shell.spec.ts:81:3 › Learner Home shell › honors reduced-motion preferences
- PASS: tests/accessibility/execution-readiness.spec.ts:5:3 › Execution readiness › shows all code-backed language profiles without presenting a learner runner
- PASS: tests/accessibility/execution-readiness.spec.ts:26:3 › Execution readiness › has no horizontal overflow at the narrowest supported width
- PASS: tests/accessibility/guided-problem.spec.ts:5:3 › Guided problem workspace › renders the complete learner critical path without pretending to run code
- PASS: tests/accessibility/guided-problem.spec.ts:26:3 › Guided problem workspace › does not overflow at the narrowest supported width
- PASS: tests/accessibility/guided-problem.spec.ts:37:3 › Guided problem workspace › recovers the active language draft after a reload
- PASS: tests/accessibility/guided-problem.spec.ts:53:3 › Guided problem workspace › syncs authenticated workspace edits and reveals authored hints only after the route responds
- PASS: tests/accessibility/onboarding.spec.ts:5:3 › Learner onboarding › renders an accessible signed-out entry point
- PASS: tests/accessibility/onboarding.spec.ts:18:3 › Learner onboarding › does not overflow at the narrowest supported shell width
- PASS: tests/accessibility/phase6-learning.spec.ts:84:1 › overdue review supports keyboard answers, receipt and deferral with accessible states
- PASS: tests/accessibility/phase6-learning.spec.ts:110:1 › progress keeps self-reports separate and records a timezone-fenced prospective pause
- PASS: tests/accessibility/phase6-learning.spec.ts:142:1 › home shows one reasoned action with alternatives and honors recommended language
- PASS: tests/accessibility/phase6-learning.spec.ts:167:3 › /review has accessible signed-out recovery at 320px
- PASS: tests/accessibility/phase6-learning.spec.ts:167:3 › /progress has accessible signed-out recovery at 320px
- PASS: tests/accessibility/phase6-learning.spec.ts:184:1 › home explains overdue and unavailable scenarios
- PASS: tests/accessibility/phase6-learning.spec.ts:217:1 › saved explanation checks carry self-reported confidence and preserve saved state if the check fails
- PASS: tests/accessibility/planning-preferences.spec.ts:10:1 › planning preferences save, reload, clamp calendar months, and preserve edits after a conflict
- PASS: tests/accessibility/planning-preferences.spec.ts:84:1 › signed-out planning preferences provide accessible recovery without a fake schedule

### Journeys — 3 passed

- PASS: tests/e2e/roadmap.spec.ts:235:1 › infeasible full-course goals show a scoped alternative without an accept action
- PASS: tests/e2e/roadmap.spec.ts:15:1 › complete AI-off create, review, accept, miss, pause, resume, replan and history journey
- PASS: tests/e2e/draft-sync.spec.ts:49:1 › draft sync survives offline reload, reconnects, and preserves newer remote work

### Execution result fixtures — 5 passed

- PASS: tests/execution-browser/guided-results.spec.ts:12:3 › renders trusted infrastructure_error status and never exposes source
- PASS: tests/execution-browser/guided-results.spec.ts:12:3 › renders trusted compile_error status and never exposes source
- PASS: tests/execution-browser/guided-results.spec.ts:12:3 › renders trusted wrong_answer status and never exposes source
- PASS: tests/execution-browser/guided-results.spec.ts:12:3 › renders trusted pass status and never exposes source
- PASS: tests/execution-browser/guided-results.spec.ts:12:3 › renders trusted limits status and never exposes source

### Additional signed-out viewport audit

| Route | Width | HTTP | Document/client width | Result |
|---|---:|---:|---|---|
| / | 320 | 200 | 320/320 | PASS |
| /plan | 320 | 200 | 320/320 | PASS |
| /progress | 320 | 200 | 320/320 | PASS |
| /review | 320 | 200 | 320/320 | PASS |
| /onboarding | 320 | 200 | 320/320 | PASS |
| /learn/arrays-two-pointer | 320 | 200 | 320/320 | PASS |
| / | 768 | 200 | 768/768 | PASS |
| /plan | 768 | 200 | 768/768 | PASS |
| /progress | 768 | 200 | 768/768 | PASS |
| /review | 768 | 200 | 768/768 | PASS |
| /onboarding | 768 | 200 | 768/768 | PASS |
| /learn/arrays-two-pointer | 768 | 200 | 768/768 | PASS |
| / | 1024 | 200 | 1024/1024 | PASS |
| /plan | 1024 | 200 | 1024/1024 | PASS |
| /progress | 1024 | 200 | 1024/1024 | PASS |
| /review | 1024 | 200 | 1024/1024 | PASS |
| /onboarding | 1024 | 200 | 1024/1024 | PASS |
| /learn/arrays-two-pointer | 1024 | 200 | 1024/1024 | PASS |
| / | 1440 | 200 | 1440/1440 | PASS |
| /plan | 1440 | 200 | 1440/1440 | PASS |
| /progress | 1440 | 200 | 1440/1440 | PASS |
| /review | 1440 | 200 | 1440/1440 | PASS |
| /onboarding | 1440 | 200 | 1440/1440 | PASS |
| /learn/arrays-two-pointer | 1440 | 200 | 1440/1440 | PASS |

## Appendix D. Complete requirement checklist snapshot through Phase 7

This is the plan's recorded checkbox state at audit time, **not an independent assertion that checked boxes prove completion or unchecked boxes prove absent code**. Phase 0 is open; Phase 1–5 plan checkboxes conflict with the ledger's technical closure; Phase 6/7 technical checks are marked complete. Source/evidence and scope qualifications appear above. Likely-touched filenames in the plan are suggestions, not required exact implementations.

## Phase 0: Resolve gates and freeze the build contract


### Task 1: Approve product semantics and launch slice

- [ ] Architecture and product gate checklists record accepted, revised, deferred, or rejected outcomes.
- [ ] V1/pilot scope and explicit non-goals are unambiguous.
- [ ] ADR-0001 through ADR-0014 have deliberate statuses.
- [ ] `pnpm docs:check` after Task 2 establishes the command; before then run local Markdown link/fence checks.
- [ ] Manual review confirms no unresolved decision is silently assumed by Phase 1.

### Task 2: Freeze the development toolchain and command surface

- [ ] One decision record lists the selected tools, supported runtime range, upgrade policy, and rejected alternatives.
- [ ] Every planned quality command has one owner and one intended purpose.
- [ ] No framework or ORM type is allowed to enter domain contracts.
- [ ] Toolchain decision is reviewed against ADR-0001 and ADR-0003.
- [ ] Planned command names in this document are updated if needed.

### Task 3: Define local adapter contracts and provider decision deadlines

- [ ] Sandbox decision criteria address isolation, language support, latency, cost, region, observability, and provider exit.
- [ ] Every runtime/compiler version has a patch and retirement policy.
- [ ] Provider credentials and SDK types terminate at adapters.
- [ ] Security review maps the choice to ADR-0011 controls.
- [ ] A proof-of-capability checklist exists for all six languages.

### Task 4: Freeze privacy, retention, budgets, and pilot targets

- [ ] Retention matrix covers attempts, code, conversations, execution output, telemetry, audit, and backups.
- [ ] AI/execution budgets have learner, daily, environment, and global limits.
- [ ] Pilot targets are labelled proposals until measured.
- [ ] Privacy and reliability owner review is recorded.
- [ ] No hosted-pilot task depends on an unresolved legal or retention decision.

### Checkpoint G0: Build authorization

- [ ] Tasks 1-4 are approved.
- [ ] A0-A2 and P0-P4 are accepted or explicitly narrowed.
- [ ] Human owner authorizes Phase 1 only.

## Phase 1: Establish the repository foundation


### Task 5: Create root workspace and quality manifests

- [ ] Fresh install is deterministic from the lockfile.
- [ ] Format, lint, typecheck, test, build, and docs commands exist.
- [ ] Baseline CI runs the quality commands plus secret/dependency checks; secrets and generated files are excluded safely.
- [ ] Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm test`.
- [ ] Fresh-clone setup instructions are manually followed in a temporary directory.

### Task 6: Create the minimal web application shell

- [ ] App starts locally and renders an accessible shell.
- [ ] Health and readiness have distinct semantics.
- [ ] No database, AI, or execution dependency is required for the health endpoint.
- [ ] Run focused web tests and `pnpm build`.
- [ ] Manually verify keyboard navigation and failure boundary.

### Task 6a: Integrate approved design tokens and page-shell contracts

- [ ] Home, Workspace and Roadmap references have a traceable token/component checklist.
- [ ] No production asset is assumed to exist; missing assets are tracked, not silently substituted.
- [ ] Compare shell states to approved references at desktop and narrow widths; run keyboard/contrast checks.

### Task 7: Create package boundaries and architecture tests

- [ ] Domain imports no Next.js, database, provider, or telemetry package.
- [ ] Application depends on owned ports, never concrete adapters.
- [ ] Architecture tests fail on a deliberately invalid dependency fixture.
- [ ] Run `pnpm test:architecture` and `pnpm typecheck`.
- [ ] Review package dependency graph.

### Task 8: Implement validated configuration and request primitives

- [ ] Missing or invalid required configuration fails clearly.
- [ ] Server-controlled UTC time and actor context are mandatory for use cases.
- [ ] Error output contains stable codes and no secret/internal details.
- [ ] Run unit and property tests for configuration, time, IDs, and error serialization.
- [ ] Run a secret-shaped fixture through logging/error tests.

### Task 9: Establish PostgreSQL, pgvector, migrations, and integration harness

- [ ] Migrations apply from empty and are repeatable in test setup.
- [ ] Runtime role cannot run migrations or bypass schema ownership.
- [ ] Integration tests reset without sharing state across cases.
- [ ] Run `pnpm test:integration` against a fresh database.
- [ ] Apply migrations from zero and verify pgvector availability.

### Checkpoint F1: Foundation

- [ ] All root quality commands pass.
- [ ] Architecture tests enforce import direction.
- [ ] Web shell builds and database migrations pass from empty.
- [ ] Human owner authorizes Phase 2.

## Phase 2: Identity, authorization, and durable platform primitives


### Task 10: Integrate Clerk identity and actor context

- [ ] A verified Clerk session maps to one internal opaque learner ID.
- [ ] Actor roles/scopes are loaded server-side and cannot be submitted by the browser or Clerk public metadata.
- [ ] Clerk sign-in/sign-out/session behavior is exposed through the approved Next.js integration and has adapter/route fixtures.
- [ ] Run authentication integration tests including forged-role negatives.
- [ ] Manually verify login, logout, and revoked-session behavior.

### Task 11: Deliver learner onboarding and profile preferences

- [ ] Only the owner can read/update the profile.
- [ ] Language, timezone, capacity, and horizon-related fields validate at the boundary.
- [ ] Updates preserve version/audit metadata.
- [ ] Run unit, integration, and one browser journey for onboarding.
- [ ] Test invalid timezone, unsupported language, and cross-user access.

### Task 12: Implement privileged roles and authorization matrix

- [ ] Every privileged command has an explicit permission and negative test.
- [ ] Learners cannot enumerate or mutate another learner's resources.
- [ ] Privileged access is audited and never inferred from email domain.
- [ ] Run authorization matrix unit/integration tests.
- [ ] Review every command in the interface catalog for an owner.

### Task 13: Implement idempotency, audit, and transactional outbox foundations

- [ ] Same key and payload replays one result; changed payload conflicts.
- [ ] State change and outbox record commit atomically.
- [ ] Audit serialization excludes secrets and raw learner code.
- [ ] Run duplicate/concurrent idempotency integration tests.
- [ ] Simulate rollback and prove no orphaned event is published.

### Task 13a: Establish privacy-safe observability before service integration

- [ ] No source, pseudocode, token, cookie or model body appears in default telemetry.
- [ ] Synthetic failures retain useful stable error categories and correlation.
- [ ] Inject sensitive canary strings across API, worker and adapter errors and assert absence from serialized telemetry.

### Checkpoint F2: Identity and platform integrity

- [ ] Onboarding works end to end.
- [ ] Cross-user and privilege negative tests pass.
- [ ] Idempotency/audit/outbox concurrency fixtures pass.
- [ ] Human owner authorizes Phase 3.

## Phase 3: Governed curriculum, problems, and external references


### Task 14: Implement versioned concept and curriculum graph

- [ ] Published graph versions are immutable and acyclic.
- [ ] Required, recommended, and related edges remain distinguishable.
- [ ] Historical sessions can resolve their pinned graph version.
- [ ] Run graph unit/property tests, including cycle and version fixtures.
- [ ] Run migration integration tests.

### Task 15: Implement immutable content/problem lifecycle and provenance

- [ ] Publication fails without provenance, technical review, pedagogical review, and validation.
- [ ] Published payload cannot be edited; changes create a version.
- [ ] Rights withdrawal blocks new use and preserves safe historical references.
- [ ] Run lifecycle transition and authorization tests.
- [ ] Test original, licensed, expired-rights, and rejected-content fixtures.

### Task 16: Define six-language problem manifests and semantic fixtures

- [ ] Stable IDs are exactly `python`, `javascript`, `typescript`, `java`, `cpp`, and `c`.
- [ ] One semantic fixture set maps to six explicit harness adapters.
- [ ] Missing language support is visible and blocks general publication.
- [ ] Run schema/fixture contract tests for all six languages.
- [ ] Test that TypeScript and JavaScript, and C and C++, remain distinct profiles.

### Task 17: Implement external references and collection deduplication

- [ ] External records contain link metadata, not copied protected content.
- [ ] Only allowlisted providers and reviewed canonical URLs can be published.
- [ ] One reference may belong to several collections without duplicating required work.
- [ ] Run URL/redirect/domain validation tests with malicious fixtures.
- [ ] Run collection overlap/deduplication tests.

### Task 18: Deliver content author/review/publish vertical slice

- [ ] Role separation and lifecycle blockers are visible in the UI.
- [ ] Only fixture publication is permitted now; real runnable publication requires Task 23 conformance. All candidates resolve exact version/checksum/provenance.
- [ ] Retired content disappears from new recommendations but retains historical metadata; rights/security tombstones prevent forbidden payload rendering.
- [ ] Run content lifecycle E2E and negative-role tests.
- [ ] Run `pnpm build` and accessibility smoke checks.

### Checkpoint F3: Governed content foundation

- [ ] One original problem candidate has complete rights/reviews; runnable publication remains blocked until Task 23.
- [ ] Six-language manifest completeness and external-link boundaries pass.
- [ ] No third-party statement, solution, test, or credential is stored.
- [ ] Human owner authorizes Phase 4.

## Phase 4: Prove isolated six-language execution


### Task 19: Complete the sandbox selection spike

- [ ] Network, credentials, host mounts, runtime sockets, and metadata access are absent.
- [ ] CPU, wall time, memory, PID, filesystem, and output limits are enforceable.
- [ ] Startup latency, concurrency, cost, patching, and observability are measured.
- [ ] Produce a versioned spike report with commands and results.
- [ ] Security owner approves, rejects, or narrows the sandbox choice.

### Task 20: Implement signed execution contracts

- [ ] Learner-controlled fields are limited to source and selected published language.
- [ ] Descriptor binds run, manifest, image digest, source checksum, limits, and expiry.
- [ ] Results distinguish learner failures from infrastructure failures; key rotation, expiry and lease epochs reject stale/forged outcomes.
- [ ] Run schema, signature, expiry, replay, and tamper tests.
- [ ] Compatibility fixture covers current and rejected versions.

### Task 21: Implement execution-control admission and lifecycle

- [ ] Browser cannot call execution control directly.
- [ ] Duplicate dispatch has deduplicated terminal effects and fenced leases; do not promise exactly-once physical execution.
- [ ] Lost-host uncertainty reaches a terminal infrastructure error within a bounded reconciliation deadline; no replacement starts while the old job may still execute.
- [ ] Run service contract and concurrency tests.
- [ ] Fault-inject cancellation, lost response, duplicate result, and teardown failure.

### Task 22: Build pinned runtime images for all six languages

- [ ] Each profile records compiler/runtime version and immutable digest.
- [ ] TypeScript has a distinct type-check/transpile phase.
- [ ] No profile permits package installation, network access, or learner-selected flags.
- [ ] Build, scan, sign, and smoke-test every image.
- [ ] Run representative compile/syntax/runtime failure fixtures per profile.

### Task 23: Prove semantic conformance across six languages

- [ ] All six harnesses use the same semantic fixture IDs.
- [ ] Equivalent correct/incorrect solutions produce equivalent outcome categories.
- [ ] Every result resolves manifest, harness, limits, image, and policy versions. A trusted judge outside the sandbox compares outputs; no candidate verdict is accepted.
- [ ] Numeric width, Unicode, mutation, ordering, float tolerance and serialization semantics are explicit; limits are calibrated by runtime.
- [ ] The first runnable content version can publish only after this report and all reviews pass.
- [ ] Run `pnpm test:conformance` from clean images.
- [ ] Review an equivalence report with per-language differences; test spoofed verdicts, malformed output and expected-value isolation.

### Task 24: Pass sandbox abuse and execution-port contract gates

- [ ] Abuse fixtures cause bounded safe terminal outcomes with no escape, egress, or residue.
- [ ] The adapter verifies signed results, source/run correlation and cancellation/fencing without requiring future attempt tables.
- [ ] Infrastructure errors never create negative mastery evidence.
- [ ] Run `pnpm test:sandbox`, `pnpm test:conformance`, and execution integration tests.
- [ ] Run correct and failing fixture submissions in each language.

### Checkpoint F4: Execution safety

- [ ] Six-language conformance is green.
- [ ] Sandbox security and teardown gates are green.
- [ ] No learner code runs in Next.js, worker, browser origin, or database host.
- [ ] Human security review authorizes Phase 5.

## Phase 5: Deliver the guided internal learning loop


### Task 25: Implement learning-session and attempt state machines

- [x] Attempt transitions are monotonic and version-pinned.
- [x] Changing language creates an explicit new attempt/reset path.
- [x] Keystrokes are not retained; saved/final snapshots are policy-controlled.
- [x] Run state-machine/property and ownership integration tests.
- [x] Test concurrent submit/abandon/run races.

### Task 25a: Connect real attempts to durable execution and trusted results

- [x] Submission consumes a result for the exact source checksum, problem, language and manifest version.
- [x] Commit the immutable assessment observation and outbox atomically; begin transaction before row locks.
- [x] Cancellation, stale lease, duplicate result and lost response do not duplicate credit or leak quota.
- [x] Race run/submit/abandon/edit operations; kill relay and execution host and reconcile.
- [x] Run a correct, wrong and infrastructure-failing attempt in each language.

### Task 25b: Implement recoverable source and pseudocode drafts

- [x] Reload/session expiry does not silently discard confirmed saves; conflicts never overwrite newer drafts.
- [x] No keystroke history; drafts have limits/TTL and private ownership.
- [x] Optional local recovery is learner-scoped and cleared on logout/deletion; shared-device users can disable it.
- [x] Browser-test two tabs, offline/reconnect, lost save response, expired session and language switch.

### Task 26: Implement structured pseudocode and readiness evidence

- [x] Pseudocode is separate from executable code and supports append-only saved revisions.
- [x] Readiness uses authored structured answer keys and verified runs, not nonempty prose or model opinion. Free-form pseudocode/explain-back feedback is advisory unless human reviewed.
- [x] Tutor access cannot silently rewrite learner artifacts.
- [x] Run rubric, ownership, version, and privacy tests.
- [ ] Manually complete and revise one pseudocode artifact.

### Task 27: Implement trace protocol and accessible renderer

- [x] Same trace produces deterministic visual and text states.
- [x] Unknown/invalid events fail safely.
- [x] Critical controls work without pointer, color, animation, or sound; unsupported arbitrary learner-code traces fall back to the reviewed reference trace instead of fabricated states.
- [x] Run reducer/property, snapshot, keyboard, and accessibility tests.
- [ ] Manually verify reduced-motion and screen-reader transcript.

### Task 28: Implement deterministic hint ladder and authored fallback

- [x] Requested tier above the ceiling is rejected or capped deterministically.
- [x] Assistance is persisted before display and cumulative across retries, language switches and new attempts on the same problem version; client bundles never preload locked hints/solutions.
- [x] Full solution review requires the approved attempt/gate state.
- [x] Run hint policy table and concurrency/idempotency tests.
- [x] Run adversarial requests for premature final solutions.

### Task 29: Complete the first end-to-end internal problem workspace

- [x] The full guided path works in every supported language.
- [x] Reload/resume preserves committed state without false completion.
- [x] AI outage is irrelevant because this slice uses authored content.
- [x] Run `pnpm test:e2e`, `pnpm test:conformance`, and accessibility checks.
- [ ] Manually exercise correct, wrong, compile-error, timeout, and infrastructure-error paths.

### Checkpoint F5: Learning kernel milestone M2

- [x] One original problem completes the entire internal learning loop in six languages.
- [x] Hint, visualization, pseudocode, execution, and resume failure cases pass.
- [x] Accessibility critical path passes.
- [x] Human owner authorizes Phase 6 — authorized in this task on 2026-10-02; no hosted deployment is authorized.

## Phase 6: Mastery, review, recommendation, and progress


### Task 30: Implement append-only mastery evidence and projection v1

- [x] Historical evidence is never rewritten by projection changes.
- [x] Full-solution completion cannot equal independent delayed transfer.
- [x] Projection rebuild produces deterministic watermarks and reason codes.
- [x] Run evidence dedupe, replay, and policy-version comparison tests.
- [x] Rebuild a learner projection from an empty read model.

### Task 31: Implement spaced review and transfer scheduling

- [x] DST/timezone changes do not duplicate or lose reviews.
- [x] Overdue items remain recoverable and do not reset mastery/streak automatically.
- [x] Same evidence watermark cannot create duplicate review items.
- [x] Run clock/property tests across DST and timezone fixtures.
- [x] Run retry/concurrency scheduling tests.

### Task 32: Implement explainable next-action recommendation

- [x] Every recommendation has machine-readable and learner-readable reasons.
- [x] Cold start uses diagnostic/intro content, never fabricated personalization.
- [x] Retired or unavailable content is never recommended.
- [x] Run deterministic scenario/property tests.
- [x] Manually inspect cold-start, overdue-review, and language-unavailable cases.

### Task 33: Implement separate progress and consistency views

- [x] Self-reported and server-observed measures are visually distinct.
- [x] Streak calculation is versioned and timezone-safe.
- [x] Progress views expose `asOf` time and policy version.
- [x] Run streak/calendar and read-model tests.
- [x] Accessibility and misleading-label content review passes.

### Checkpoint F6: Evidence-driven learning

- [x] Mastery is reproducible from evidence.
- [x] Reviews and recommendations are deterministic and explainable.
- [x] Progress does not confuse activity with mastery.
- [x] Human owner authorizes Phase 7 — explicitly approved in this chat on 2026-10-02; local testing and GitHub publication are authorized, with no live deployment.

## Phase 7: Configurable roadmap planning


### Task 34: Implement roadmap intent and immutable plan versions

- [x] Supported horizons are 1, 2, 3, 4, and 6 months unless Gate P2 changes them.
- [x] Accepted plan versions are immutable. Explicit acceptance atomically checks the expected active-version token; only one primary plan is active.
- [x] Replanning preserves prior adherence and completed evidence. PlanItem kind determines its nullable target FK; buffer items require no problem.
- [x] Run state-machine and version-history tests.
- [x] Run ownership and cross-plan isolation tests.

### Task 35: Implement deterministic baseline scheduler

- [x] Required workload never exceeds declared capacity.
- [x] Reviews and configurable buffer days are reserved before optional extensions.
- [x] Infeasible goals or insufficient reviewed curriculum return scoped alternatives, not padded repeated work or an impossible full-DSA promise.
- [x] Run property tests over horizons, capacities, missed days, and sparse content.
- [x] Snapshot representative 1-, 2-, 3-, 4-, and 6-month plans; test month-end clamping, leap year, timezone changes, reviews after plan end and indivisible sessions per implementation contracts.

### Task 36: Implement plan validator and replan policy

- [x] Duplicate collection membership does not duplicate required work.
- [x] Invalid language/content/link items block publication with reason codes.
- [x] Replan previews moved/removed/added items and requires acceptance; completed/past items remain fixed. Pause and resume do not silently extend deadlines.
- [x] Run invalid-plan fixtures for every closure-matrix case.
- [x] Replay old versus new plans and compare preserved history.

### Task 51: Implement budgets, quotas, rate limits, and circuit breakers

- [x] Concurrent requests cannot exceed the configured bounded allowance.
- [x] Budget denial produces authored fallback or clear refusal, not a generic error.
- [x] Core content and attempt writes remain available when optional work is shed.
- [x] Run concurrency, exhaustion, retry, and load-shedding fixtures.
- [x] Verify recovery after breaker cooldown/administrative reset.

### Task 37: Add bounded AI plan proposal and learner plan UI

- [x] AI cannot publish a plan or introduce unapproved content/links.
- [x] Provider failure/budget denial returns the deterministic baseline.
- [x] Learner sees workload, assumptions, reasons, and editable preferences before acceptance.
- [x] Run malformed, injected, over-capacity, timeout, and budget fixtures.
- [x] Run E2E journeys for create, accept, miss, pause, and replan.

### Checkpoint F7: Adaptive roadmap

- [x] Every supported horizon produces a feasible, explainable plan or reasoned rejection.
- [x] AI-off mode remains complete.
- [x] Replanning preserves history and avoids catch-up overload.
- [ ] Human owner authorizes Phase 8.

## Appendix E. Fresh runtime fixture inventory

### Six-language semantic cases

| Language | Fixture | Candidate | Category | Diagnostic |
|---|---|---|---|---|
| python | pair-sum-small | correct | passed | none |
| python | pair-sum-empty | correct | passed | none |
| python | pair-sum-64-bit | correct | passed | none |
| python | pair-sum-duplicate-order | correct | passed | none |
| python | pair-sum-unicode | correct | passed | none |
| python | pair-sum-no-match | correct | passed | none |
| javascript | pair-sum-small | correct | passed | none |
| javascript | pair-sum-empty | correct | passed | none |
| javascript | pair-sum-64-bit | correct | passed | none |
| javascript | pair-sum-duplicate-order | correct | passed | none |
| javascript | pair-sum-unicode | correct | passed | none |
| javascript | pair-sum-no-match | correct | passed | none |
| typescript | pair-sum-small | correct | passed | none |
| typescript | pair-sum-empty | correct | passed | none |
| typescript | pair-sum-64-bit | correct | passed | none |
| typescript | pair-sum-duplicate-order | correct | passed | none |
| typescript | pair-sum-unicode | correct | passed | none |
| typescript | pair-sum-no-match | correct | passed | none |
| java | pair-sum-small | correct | passed | none |
| java | pair-sum-empty | correct | passed | none |
| java | pair-sum-64-bit | correct | passed | none |
| java | pair-sum-duplicate-order | correct | passed | none |
| java | pair-sum-unicode | correct | passed | none |
| java | pair-sum-no-match | correct | passed | none |
| cpp | pair-sum-small | correct | passed | none |
| cpp | pair-sum-empty | correct | passed | none |
| cpp | pair-sum-64-bit | correct | passed | none |
| cpp | pair-sum-duplicate-order | correct | passed | none |
| cpp | pair-sum-unicode | correct | passed | none |
| cpp | pair-sum-no-match | correct | passed | none |
| c | pair-sum-small | correct | passed | none |
| c | pair-sum-empty | correct | passed | none |
| c | pair-sum-64-bit | correct | passed | none |
| c | pair-sum-duplicate-order | correct | passed | none |
| c | pair-sum-unicode | correct | passed | none |
| c | pair-sum-no-match | correct | passed | none |
| python | pair-sum-no-match | mutated-not-equal | learner_failed | wrong_answer |
| javascript | pair-sum-no-match | mutated-not-equal | learner_failed | wrong_answer |
| typescript | pair-sum-no-match | mutated-not-equal | learner_failed | wrong_answer |
| java | pair-sum-no-match | mutated-not-equal | learner_failed | wrong_answer |
| cpp | pair-sum-no-match | mutated-not-equal | learner_failed | wrong_answer |
| c | pair-sum-no-match | mutated-not-equal | learner_failed | wrong_answer |

### Conformance spoof/normalization checks

- spoofedVerdictRejected: True
- expectedValueSpoofRejected: True
- candidateVerdictsIgnored: True

### Bounded abuse fixtures

- PASS: escape-boundary exit=0 signal=none timeout=false overflow=false residue=false
- PASS: egress-denial exit=0 signal=none timeout=false overflow=false residue=false
- PASS: metadata-denial exit=0 signal=none timeout=false overflow=false residue=false
- PASS: fork-thread-bomb exit=0 signal=none timeout=false overflow=false residue=false
- PASS: memory-flood exit=137 signal=none timeout=false overflow=false residue=false
- PASS: cpu-flood exit=none signal=SIGKILL timeout=true overflow=false residue=false
- PASS: disk-flood exit=0 signal=none timeout=false overflow=false residue=false
- PASS: output-flood exit=none signal=SIGKILL timeout=false overflow=true residue=false
- PASS: path-traversal exit=0 signal=none timeout=false overflow=false residue=false
- PASS: symlink-boundary exit=0 signal=none timeout=false overflow=false residue=false
- PASS: container-residue exit=0 signal=none timeout=false overflow=false residue=false
- PASS: signal-boundary exit=none signal=SIGKILL timeout=true overflow=false residue=false
- PASS: explicit-cancellation exit=none signal=SIGKILL timeout=true overflow=false residue=false
- PASS: teardown-residue exit=0 signal=none timeout=false overflow=false residue=false

### gVisor normal/hostile cases and startup probe

Artifact capture: 2026-10-02T19:12:11.296Z. Docker 28.0.4, selected runtime runsc, three repetitions; Firecracker was not installed or tested. The recorded six lightweight concurrent startup probes are distinct from production throughput tests.

| Language | Mode | Repetition | Exit | Timed out | Duration (ms) | Output marker |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| python | normal | 1 | 0 | false | 519 | NORMAL_OK |
| python | hostile | 1 | 0 | false | 3313 | NETWORK_BLOCKED,METADATA_BLOCKED,DOCKER_SOCKET_ABSENT,HOST_MOUNT_ABSENT,CREDENTIAL_ENV_ABSENT |
| javascript | normal | 1 | 0 | false | 544 | NORMAL_OK |
| javascript | hostile | 1 | 0 | false | 523 | NETWORK_BLOCKED,METADATA_BLOCKED,DOCKER_SOCKET_ABSENT,HOST_MOUNT_ABSENT,CREDENTIAL_ENV_ABSENT |
| typescript | normal | 1 | 0 | false | 818 | NORMAL_OK |
| typescript | hostile | 1 | 0 | false | 903 | NETWORK_BLOCKED,METADATA_BLOCKED,DOCKER_SOCKET_ABSENT,HOST_MOUNT_ABSENT,CREDENTIAL_ENV_ABSENT |
| java | normal | 1 | 0 | false | 3545 | NORMAL_OK |
| java | hostile | 1 | 0 | false | 4340 | NETWORK_BLOCKED=true,METADATA_BLOCKED=true,DOCKER_SOCKET_ABSENT=true,HOST_MOUNT_ABSENT=true,CREDENTIAL_ENV_ABSENT=true |
| cpp | normal | 1 | 0 | false | 562 | NORMAL_OK |
| cpp | hostile | 1 | 0 | false | 605 | NETWORK_BLOCKED=1,METADATA_BLOCKED=1,DOCKER_SOCKET_ABSENT=1,HOST_MOUNT_ABSENT=1 |
| c | normal | 1 | 0 | false | 432 | NORMAL_OK |
| c | hostile | 1 | 0 | false | 464 | NETWORK_BLOCKED=1,METADATA_BLOCKED=1,DOCKER_SOCKET_ABSENT=1,HOST_MOUNT_ABSENT=1 |
| python | normal | 2 | 0 | false | 413 | NORMAL_OK |
| python | hostile | 2 | 0 | false | 3324 | NETWORK_BLOCKED,METADATA_BLOCKED,DOCKER_SOCKET_ABSENT,HOST_MOUNT_ABSENT,CREDENTIAL_ENV_ABSENT |
| javascript | normal | 2 | 0 | false | 514 | NORMAL_OK |
| javascript | hostile | 2 | 0 | false | 582 | NETWORK_BLOCKED,METADATA_BLOCKED,DOCKER_SOCKET_ABSENT,HOST_MOUNT_ABSENT,CREDENTIAL_ENV_ABSENT |
| typescript | normal | 2 | 0 | false | 743 | NORMAL_OK |
| typescript | hostile | 2 | 0 | false | 867 | NETWORK_BLOCKED,METADATA_BLOCKED,DOCKER_SOCKET_ABSENT,HOST_MOUNT_ABSENT,CREDENTIAL_ENV_ABSENT |
| java | normal | 2 | 0 | false | 3576 | NORMAL_OK |
| java | hostile | 2 | 0 | false | 4257 | NETWORK_BLOCKED=true,METADATA_BLOCKED=true,DOCKER_SOCKET_ABSENT=true,HOST_MOUNT_ABSENT=true,CREDENTIAL_ENV_ABSENT=true |
| cpp | normal | 2 | 0 | false | 620 | NORMAL_OK |
| cpp | hostile | 2 | 0 | false | 601 | NETWORK_BLOCKED=1,METADATA_BLOCKED=1,DOCKER_SOCKET_ABSENT=1,HOST_MOUNT_ABSENT=1 |
| c | normal | 2 | 0 | false | 421 | NORMAL_OK |
| c | hostile | 2 | 0 | false | 447 | NETWORK_BLOCKED=1,METADATA_BLOCKED=1,DOCKER_SOCKET_ABSENT=1,HOST_MOUNT_ABSENT=1 |
| python | normal | 3 | 0 | false | 367 | NORMAL_OK |
| python | hostile | 3 | 0 | false | 3318 | NETWORK_BLOCKED,METADATA_BLOCKED,DOCKER_SOCKET_ABSENT,HOST_MOUNT_ABSENT,CREDENTIAL_ENV_ABSENT |
| javascript | normal | 3 | 0 | false | 530 | NORMAL_OK |
| javascript | hostile | 3 | 0 | false | 591 | NETWORK_BLOCKED,METADATA_BLOCKED,DOCKER_SOCKET_ABSENT,HOST_MOUNT_ABSENT,CREDENTIAL_ENV_ABSENT |
| typescript | normal | 3 | 0 | false | 799 | NORMAL_OK |
| typescript | hostile | 3 | 0 | false | 835 | NETWORK_BLOCKED,METADATA_BLOCKED,DOCKER_SOCKET_ABSENT,HOST_MOUNT_ABSENT,CREDENTIAL_ENV_ABSENT |
| java | normal | 3 | 0 | false | 3665 | NORMAL_OK |
| java | hostile | 3 | 0 | false | 4384 | NETWORK_BLOCKED=true,METADATA_BLOCKED=true,DOCKER_SOCKET_ABSENT=true,HOST_MOUNT_ABSENT=true,CREDENTIAL_ENV_ABSENT=true |
| cpp | normal | 3 | 0 | false | 580 | NORMAL_OK |
| cpp | hostile | 3 | 0 | false | 615 | NETWORK_BLOCKED=1,METADATA_BLOCKED=1,DOCKER_SOCKET_ABSENT=1,HOST_MOUNT_ABSENT=1 |
| c | normal | 3 | 0 | false | 481 | NORMAL_OK |
| c | hostile | 3 | 0 | false | 425 | NETWORK_BLOCKED=1,METADATA_BLOCKED=1,DOCKER_SOCKET_ABSENT=1,HOST_MOUNT_ABSENT=1 |

- Normal fixtures all passed: true
- Hostile boundary fixtures all passed: true

## Failure diagnostics

## Concurrency

- Six lightweight language-container fixtures launched concurrently: 851 ms wall time
- Results: c=0 (empty), cpp=0 (empty), python=0 (NORMAL_OK), javascript=0 (NORMAL_OK), typescript=0 (NORMAL_OK), java=0 (openjdk version "25.0.4" 2026-07-21 LTS OpenJDK Runtime Environment Temurin-25.0.4+7 (build 25.0.4+7-LTS) OpenJDK 64-Bit Server VM Temurin-25.0.4+7 (build 25.0.4+7-LTS, mixed mode, sharing))
- Concurrent fixtures all passed: true

The concurrent probe uses lightweight startup commands; sequential fixtures above cover language-specific compile/run and boundary behavior.

This is a local startup/concurrency observation, not a capacity or cost claim.

### Image smoke adapters

PASS: Python, JavaScript, TypeScript, Java, C++, C. JavaScript/TypeScript share one image profile and C/C++ share one image profile, while their adapters and language identities remain distinct. Python and Java have their own profiles.
