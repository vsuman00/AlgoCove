# AlgoCove architecture review

**Reviewed:** 2026-09-17  
**Result:** The core architecture is appropriate. Material correctness, trust-boundary and implementation-order gaps required targeted corrections.  
**Evidence tier:** Documentation review only. Proposed designs and planned tests are not implementation or runtime evidence.

## 1. Review basis

Reviewed the system, data/AI, runtime-flow, security/operations, product-closure, quality, ADR and implementation-plan documents against the owner's requirements and the existing approved DESIGN.md. The workspace is documentation-only; no application, deployed environment or test suite was available to certify.

The owner's current requirements take priority: six learner languages including C and TypeScript; learn/solve/visualize internally; manually follow a source link and independently solve on LeetCode; no scraping, account linking, automatic submission or synchronization; adaptable 1/2/3/4/6-month roadmaps; truthful daily consistency and sheet-based learning. This review does not implement the application or approve any deployment.

## 2. Decisions retained

- Modular-monolith application, rather than a service per feature.
- PostgreSQL as authoritative storage, with pgvector for the initial curated retrieval corpus.
- Separately isolated hostile-code execution for all six languages.
- Versioned content, rights/review gates and an append-only learning evidence ledger.
- Outbound-only external practice and clearly labelled manual follow-through.
- Deterministic roadmap constraints and authored fallbacks when AI is unavailable.
- Accessible 2D visualization before speculative 3D or arbitrary-code tracing.
- The approved visual direction in DESIGN.md.

No new database fleet, distributed event platform, mandatory cloud vendor or automatic LeetCode integration was added.

## 3. Material findings and corrections

`P1` means a security/correctness or prerequisite blocker. `P2` means a product/implementation completeness gap. All entries below are corrected in the proposed documentation, not proven in running software.

| ID | Priority | Finding in the previous documents | Correction and planned proof |
|---|---|---|---|
| AR-01 | P1 | Tutor sequence displayed provider fragments before final leakage/tier validation | Buffer before display, persist assistance before release, use authored restricted hints; ADR-0014, Tasks 28/44/45, QS-21 |
| AR-02 | P1 | Sandbox-produced normalized results were signed without specifying an independent comparator | Trusted judge outside learner boundary; candidate outputs cannot be authoritative verdicts; Tasks 20/23/24, QS-22 |
| AR-03 | P1 | Attempt flow acquired a row lock before BEGIN and wrote mastery directly despite its separate owner | Transaction first, immutable assessment observation plus outbox; mastery-owned deduplicated consumer and visible pending projection; Tasks 25a/30 |
| AR-04 | P1 | Durable execution dispatch preceded the relay implementation; real attempt integration preceded the attempt model | Relay in Task 21; fixture-only isolation in Task 24; real integration in Task 25a |
| AR-05 | P1 | Live AI could precede budget controls, safe telemetry and a clearly sequenced planner adapter | Task 13a redaction, Task 51 moved before AI; Task 37 fixture-only, live planner activation in Task 45a |
| AR-06 | P1 | Hosted infrastructure was planned, but only local authentication had an implementation task | Hosted authentication, session revocation, re-authentication and privileged MFA in Task 55a; non-waivable pilot gate |
| AR-07 | P1 | A universal problem target could not represent lesson/review/buffer items; candidate activation lacked an explicit concurrency contract | Kind-specific targets, learner acceptance, expected-active-version check, one active primary plan; Tasks 34-37, QS-23 |
| AR-08 | P1 | Structured prose fields and model feedback could be mistaken for deterministic correctness | Provenance classes, authored bounded checks, human-reviewed correctness, advisory free-form feedback; Tasks 26/30/38, QS-24 |
| AR-09 | P2 | Four pattern bundles were the final content milestone despite broad DSA, sheet and long-horizon goals | Scoped pilot plus gated Phase 13 curriculum expansion; coverage-qualified scheduling and explicit gaps; Tasks 58-60, QS-26 |
| AR-10 | P2 | Link presence could imply identical internal/external problems or completed sheet coverage | Reviewed equivalent/same-pattern/prerequisite/transfer mappings, separate identities and coverage counts; Tasks 17/50/58 |
| AR-11 | P2 | Resume promises lacked autosave, conflicting-tab and lost-response behavior; approved UI was not a plan prerequisite | Tasks 6a/25b add design integration and recoverable drafts; QS-25 |
| AR-12 | P2 | Calendar boundaries, capacity estimates, pause/resume and post-horizon reviews were underspecified | Calendar-month clamping, explicit workload/buffer rules, immutable past adherence and accepted replan diffs; Tasks 34-37 |
| AR-13 | P2 | Handoff journal implied a page opened; early bypass was treated as decided | Navigation-request semantics, popup/journal recovery, append-only self-report corrections; bypass disabled unless owner approves; Tasks 38-40 |
| AR-14 | P1 | Publication/conformance and local-versus-hosted restore sequencing could pass gates prematurely | Real runnable publication waits for Task 23; local drill in Task 54, real staging restore/PITR in Task 57 |
| AR-15 | P2 | Pinned versions could imply continued access after rights or runtime revocation | Current tombstones override old IDs; retain permissible historical metadata, not forbidden payload access or vulnerable runtime execution; QS-27 |

## 4. Requirement coverage

| Owner requirement | Design coverage | Earliest complete implementation evidence |
|---|---|---|
| Python, JavaScript, TypeScript, Java, C++ and C | Separate profiles, reviewed manifests, portable semantics, isolated judge | F4 execution assurance plus F5 end-to-end learning |
| Learn topic, recognize pattern, write pseudocode, understand steps | Authored lessons, structured evidence, hints, traces and learner drafts | F5 learning kernel; each new topic needs its own content/renderer gates |
| Visualize the learner's approach | Reviewed reference traces and labelled learner-authored draft traces | Task 27 and topic-specific bundles; arbitrary source-to-trace automation is not promised |
| Practice internally, then independently on LeetCode | Readiness plus reviewed link; no external account access | F8 companion journey |
| No scraping or automatic external updates | No provider ingestion, credentials, callbacks or submission mechanisms | Tasks 17/39/40 boundary tests |
| 1/2/3/4/6-month plans with AI help | Capacity/prerequisite/content-constrained baseline, validated proposals, explicit acceptance | F7 fixture/AI-off planner; Task 45a live AI evidence |
| Daily progress, consistency, timeline and review | Separate mastery, language proficiency, follow-through, adherence and due review measures | F6 and F7; external completion remains self-reported |
| Named problem sheets | Versioned collection metadata, provenance, mapping type and truthful coverage | F10 scoped mapping; F13 approved full-track coverage |
| Phased, understandable implementation | 66 task cards across Phases 0-13, acceptance/verification/dependencies and bounded subcards | Only documentation consistency checked in this review |

## 5. Remaining decisions and validation gates

These are not silently filled with assumptions. Assign a named owner and record the outcome before the stated gate.

| Decision or uncertainty | Owner role | Must be resolved before |
|---|---|---|
| Minors, individual versus organization scope, optional bypass, exact initial curriculum and collection names | Product owner | Task 1 / implementation authorization |
| Meaning of named sheets, membership/provenance and permission for any reproduced material | Product/content owner with rights review as needed | Publishing those references/content; Task 17 or relevant batch |
| Toolchain, local adapter contracts and supported runtime candidates | Engineering owner | Tasks 2-3; compiler pins before image builds |
| Sandbox strength, independent judge feasibility, host fencing and six-language cost | Security/platform owner | Tasks 19-24 and before any real learner execution |
| Model providers, processing region, context policy, budgets and validated-answer latency | AI/privacy owner | Live Task 44 and Task 45a |
| Identity provider, session policy, retention, backup expiry, hosting/region and operating budget | Platform/privacy owner | Tasks 52/55/55a and real learner data |
| Measurable pilot load, restore/RPO/RTO, stop criteria and staffed incident ownership | Operations owner | Task 57 |
| Full-track content volume, author/reviewer capacity and learner-outcome evidence | Curriculum/product owner | Phase 13 broad-release decision |
| Paid offering and pricing, if wanted | Product owner | A separate commercialization scope; billing is not silently added here |

Local fixture work need not wait for a cloud purchase. Conversely, documentation approval cannot substitute for sandbox escape tests, rights review, real hosted identity, restore drills, accessibility review, model evaluation or a learning-outcome study. No plan can promise zero unknown defects or guaranteed recruiting outcomes.

## 6. Navigation and verification record

- [Implementation contracts](implementation-contracts.md): precise state, evidence, judging, recovery and calendar behavior.
- [Implementation plan](../../tasks/plan.md) and [task ledger](../../tasks/todo.md): dependency-ordered implementation work.
- [ADR-0014](../adr/0014-validate-before-display-and-trust-evidence.md): changed trust-boundary decisions, rationale and primary sources.
- [Quality scenarios](quality-and-traceability.md): proposed measurable safety and correctness checks.

Review verification covers Markdown link/fence consistency, task/ledger alignment, task dependencies and removal of the specific contradictory flows. Application tests, diagram rendering, provider integration, browser behavior, security isolation and performance remain unvalidated.

Executed read-only checks on 2026-09-17:

- 28 Markdown files checked for balanced fenced blocks.
- 63 local Markdown links checked, including six heading anchors: no missing targets.
- 66 task cards matched 66 ledger entries in identical order and title.
- Every task card contained description, acceptance, verification, dependencies, likely files and scope fields.
- 192 declared task-dependency references checked: no unknown IDs, forward references or task dependency cycles.
- 14 phases, numbered 0-13, retained explicit checkpoints.
- 17 Mermaid blocks inventoried; sequence-message participants checked for declared identities. Full Mermaid parsing/rendering was not performed.
- No application code, infrastructure, external account integration or production state was created or changed.

These checks found no structural documentation errors. They do not establish semantic completeness or a defect-free future implementation. The findings and pending gates above remain the honest readiness record.
