# Architecture quality and traceability

**Status:** Proposed  
**Purpose:** Make architecture claims testable and connect product intent to components, data, controls, and future verification

## 1. Quality scenarios

Quality attributes become useful only when expressed as observable scenarios. Targets below are proposals for architecture approval and later baselining, not achieved evidence.

| ID | Attribute | Stimulus and environment | Required response | Proposed measure |
|---|---|---|---|---|
| QS-01 | Learning integrity | Learner requests a tier-6 solution during a restricted practice attempt | Deterministic policy rejects or returns the highest allowed tier; event is audited | Zero critical bypasses in release benchmark |
| QS-02 | Correctness | Two identical idempotent attempt submissions arrive concurrently | Exactly one terminal attempt/evidence effect; both callers receive compatible result | 100% in concurrency fixture |
| QS-03 | Availability | Primary generation provider fails mid-stream | Mark turn incomplete, avoid progress mutation, offer reviewed fallback, retain safe diagnostic state | Fallback/explicit failure within overall deadline |
| QS-04 | Performance | Learner requests evidence on the approved corpus under declared normal load | Apply filters, lexical+dense retrieval, fusion, and package evidence | P95 retrieval < 300 ms proposal |
| QS-05 | Privacy | A learner requests account deletion while jobs and backups exist | Block new work, purge/anonymize active/derived data, record minimal audit, expire backups by policy | Workflow/reconciliation reaches complete state within approved period |
| QS-06 | Security | A published draft contains prompt-injection-like instructions | Quarantine/fail validation; model cannot convert it into an application command | Zero tool/policy escalation in adversarial suite |
| QS-07 | Accessibility | Keyboard-only learner with reduced motion opens a visualization | All controls operate, animation is reduced/disabled, equivalent text state exists | Critical journey passes manual and automated review |
| QS-08 | Recoverability | Hosted database becomes unavailable/corrupt | Restore last known good state, reconcile derived indexes/outbox, resume authored learning before AI | Proposed RPO <= 5 min, RTO <= 60 min |
| QS-09 | Scalability | Offline evaluation saturates provider/database capacity | Admission control pauses background work and preserves attempts/content reads | Core SLO remains inside error budget |
| QS-10 | Auditability | Reviewer disputes a tutor answer three months later | Resolve exact content, evidence package, prompt/model/policy/retrieval versions and terminal validation | 100% completed tutor turns have required lineage |
| QS-11 | Maintainability | A second model provider is added | Implement adapter and evaluation configuration without changing domain policy | No provider SDK types in domain/application contracts |
| QS-12 | Content integrity | Rights to a published item are withdrawn | Retire from recommendations/retrieval, invalidate active cache/index entries, preserve minimal lawful history | Reconciliation shows zero active references after defined window |
| QS-13 | Cost | Per-day AI budget is exhausted | Stop new costly generation/evaluation, preserve authored learning, expose clear fallback reason | No spend accepted beyond configured bounded in-flight allowance |
| QS-14 | Explainability | Learner asks why a problem was recommended | Return reason codes tied to readiness, review due date, goal, and policy version | Reason available for every recommendation |
| QS-15 | Data evolution | Mastery policy changes after pilot findings | Replay the same evidence into a new projection and compare without rewriting old results | Full deterministic rebuild from watermark/checksum |
| QS-16 | Language equivalence | The same reviewed DSA problem is published for all six languages | Each harness executes the same semantic fixture IDs and produces equivalent pass/fail meaning | 100% published language manifests pass conformance suite |
| QS-17 | Execution security | Learner submits native code that attempts fork bombing, network/metadata access, path escape, or output flooding | Sandbox denies/limits behavior, terminates run, preserves host health, emits safe terminal category, and tears down fully | Zero escape/egress/cross-run leaks; core SLO remains inside budget |
| QS-18 | Runtime evolution | A compiler/runtime image requires a security upgrade | Promote a signed digest after vulnerability, conformance, performance, and rollback gates; old runs retain provenance without re-enabling vulnerable images | Every run resolves exact digest; no critical unapproved image active |
| QS-19 | External practice boundary | Learner chooses a linked LeetCode problem after internal readiness | Open the reviewed canonical URL and record only the outbound handoff; no provider credentials/content/submission are accessed | Zero provider scraping or automatic submission; handoff journal is labelled self-reported |
| QS-20 | Flexible planning | Learner selects a 1-, 2-, 3-, 4-, or 6-month horizon | Produce a validated schedule within declared capacity, with reasons, buffers, and immutable version history | 100% published plans pass deterministic constraint suite |

| QS-21 | Output disclosure | Model emits a disallowed answer early then fails final validation | No candidate answer bytes reach the client; authored fallback records assistance before delivery | Zero unvalidated bytes in browser/network adversarial fixtures |
| QS-22 | Judge integrity | Candidate prints a forged passing verdict or alters its marshalling adapter | Trusted outside-sandbox comparator rejects/ignores the claim | Negative tampering cases pass in all six languages |
| QS-23 | Plan concurrency | Two tabs accept candidates against the same active version | One activation wins; the other gets a visible conflict and preview | One active primary version; immutable prior history |
| QS-24 | Evidence integrity | Free-form prose is nonempty or AI labels it correct | Store artifact/advisory feedback only; structured or human evidence required for correctness | No advisory event becomes verified mastery in replay tests |
| QS-25 | Draft resilience | Network loss, session expiry, competing tabs | Saved/local/conflict states are truthful; newer revisions cannot be overwritten silently | Recovery E2E and privacy cleanup fixtures pass |
| QS-26 | Curriculum sufficiency | A short track or named sheet lacks internal coverage | Offer only scoped feasible schedules; display gaps rather than fabricate a full course | All required scheduled items resolve eligible content and estimated capacity |
| QS-27 | Revocation | Rights/runtime policy changes after a plan or run is pinned | Current safety/rights blocks new access; historical metadata remains attributable | Retired forbidden payload cannot be fetched through old IDs or caches |

## 2. Product-to-architecture traceability

| Product need | Owning capabilities | Primary data | Critical controls | Future verification |
|---|---|---|---|---|
| One calm recommended next step | mastery-review, practice-assessment | projection, review schedule, recommendation | deterministic rules, reason codes, alternatives | recommendation unit/property tests; learner experiment |
| Learn mode | curriculum-content, visualization | learning unit version, trace, prediction | review/publication, accessibility | content fixtures; E2E; delayed recall |
| Practice mode | practice-assessment, code-execution | attempt, submission, execution run/result, events | ownership, signed manifests/results, sandbox limits, hint ceiling | unit/integration/E2E and isolation tests |
| Six-language learning | curriculum-content, practice-assessment, code-execution | language variants, problem-language manifests, runtime image versions | shared semantic fixtures, reviewed starter/harness/reference solutions | conformance suite across Python, JavaScript, TypeScript, Java, C++, and C |
| Rescue mode | practice-assessment, tutor-retrieval | misconception, hint ladder, evidence package | tier policy, grounding, fallback | adversarial/human tutor evaluation |
| Review mode | mastery-review | evidence ledger, review schedule | idempotent scheduling, timezone correctness | clock/property tests; retention outcome |
| Interview mode later | practice-assessment | rubric, attempt, post-completion feedback | no hints during attempt, clear mode boundary | deferred new specification and ADR review |
| Active visualization | visualization | trace schema, checkpoint response | text equivalent, keyboard, reduced motion | reducer/property/snapshot/accessibility tests |
| Curated RAG | curriculum-content, tutor-retrieval | versioned chunks/embeddings | publish filters, provenance, exact citations | retrieval benchmark + human review |
| Learning progress | mastery-review | immutable evidence + projection | policy version, assistance visibility | replay/reconciliation tests |
| Timeboxed planning | roadmap-planning | plan intent, validated version, daily items | bounded AI proposal, deterministic capacity/prerequisite validation | property tests, schedule fixtures, replan replay |
| External LeetCode practice | practice-assessment, curriculum-content | source reference, handoff journal | outbound-only navigation, no credentials/scraping/sync | link verification and boundary tests |
| Content authoring | content-operations | draft, reviews, checksums, lifecycle | role separation, license, fail-closed gates | workflow/integration tests |
| AI cost control | platform-operations, tutor-retrieval | budget ledger, provider usage | reservations, caps, circuit breaker | fault/load fixtures |
| Privacy rights | identity-profile, platform-operations | consent, export/deletion workflow | re-auth, scoped jobs, audit | end-to-end deletion/export drill |

## 3. Architecture decision traceability

| Decision | Drivers | Primary risks addressed | Revisit trigger |
|---|---|---|---|
| Modular monolith | Small team, one client, strong transactions | Premature distributed complexity | Sustained independent scale/isolation/release need |
| PostgreSQL + pgvector | Small curated corpus, rich filters, version consistency | Dual-store drift and operational burden | Benchmark proves external vector/search service wins approved criteria |
| Next.js synchronous backend | TypeScript stack, UI/BFF cohesion | Duplicate backend surface | Multi-client stable API or runtime/scale separation |
| Deferred Node worker | Long-running work not yet present | Premature queue/worker ops | Durable jobs exceed request budgets or compete with learner traffic |
| Isolated multi-language execution plane | Six first-class languages and server-observed results | Host escape, resource abuse, cross-run leakage, inconsistent language semantics | New language, certification, or materially changed sandbox threat model |
| Governed immutable content | Learning/legal/reproducibility needs | Incorrect/unlicensed/mutable teaching | No removal; workflow may evolve by ADR |
| Deterministic tutor policy | Answer leakage and AI uncertainty | Model policy bypass | No removal; mechanisms evolve with evidence |
| 2D trace protocol | Accessibility and active learning | 3D novelty/coupling | Controlled 3D experiment shows delayed-learning benefit |
| Evidence ledger | Explainable/evolvable mastery | Opaque score and lost history | Storage/retention evidence requires compaction policy |
| Single-region first | Unknown cloud/traffic/residency, pilot stage | Premature distributed data | Approved availability/residency need exceeds single region |

## 4. Architecture status matrix

This prevents documentation from being mistaken for implementation or validation.

| Area | Architecture state | Implementation state | Validation state |
|---|---|---|---|
| Product/domain boundaries | Proposed | Not started | Owner review pending |
| Modular monolith | Proposed | Not started | No architecture tests |
| PostgreSQL/pgvector | Proposed | Not started | No schema/query/benchmark evidence |
| Tutor/RAG | Proposed | Not started | No evaluation suite results |
| Visualization runtime | Proposed | Not started | No accessibility/learning evidence |
| Multi-language execution plane | Proposed | Not started | No isolation, conformance, image, or performance evidence |
| Content governance | Proposed | Not started | No reviewed corpus |
| Mastery/review | Proposed | Not started | No learner calibration evidence |
| Security/privacy | Proposed controls | Not started | No threat-test/privacy review evidence |
| Reliability/SLOs | Proposed targets | Not started | No load/restore/runtime evidence |
| Deployment | Deployment-neutral proposal | Not provisioned | No hosted-pilot readiness evidence |
| Review corrections / ADR-0014 | Proposed, documented in implementation contracts | Not started | Documentation consistency only; runtime gates pending |
| Full DSA and named-sheet coverage | Phase 13 expansion outline | Not started | Exact catalogs, rights and reviewed corpus pending |

## 5. Standards and reference model alignment

The architecture should use these standards as implementation/review inputs, with exact current versions verified during the relevant phase:

| Area | Standard/reference | Intended use |
|---|---|---|
| Architecture views | C4 model concepts | Context, container, component, and code-boundary communication |
| Security verification | OWASP ASVS and OWASP Top 10 | Web/application control checklist and threat tests |
| AI security | OWASP LLM application risks | Prompt injection, data disclosure, output/tool controls |
| Accessibility | WCAG 2.2 AA target | Keyboard, animation, semantic alternatives, visual accessibility |
| Identity | OpenID Connect/OAuth standards | Authentication federation, not ad hoc token formats |
| HTTP errors | RFC 9457 problem details pattern | Stable error envelope semantics |
| Telemetry | OpenTelemetry semantic conventions | Vendor-neutral traces, metrics, and log correlation |
| API description | OpenAPI if/when public APIs exist | Contract generation and compatibility |
| Database changes | Expand/migrate/contract pattern | Backward-compatible releases and rollback |
| Supply chain | SBOM/provenance and locked dependencies | Release traceability and dependency risk |
| Sandbox runtime | OCI-compatible isolation plus gVisor-class or microVM-class defense in depth | Host-kernel exposure reduction and disposable hostile-code execution |

Relevant research/technology references already gathered for this architecture include:

- [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
- [Next.js backend-for-frontend guidance](https://nextjs.org/docs/app/guides/backend-for-frontend)
- [pgvector hybrid-search guidance](https://github.com/pgvector/pgvector#hybrid-search)
- [PostgreSQL full-text search ranking](https://www.postgresql.org/docs/current/textsearch-controls.html#TEXTSEARCH-RANKING)
- [W3C guidance for animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)
- [RAGAS evaluation paper](https://aclanthology.org/2024.eacl-demo.16/)
- [LeetCode Terms of Service](https://leetcode.com/terms/)
- [gVisor security model](https://gvisor.dev/docs/architecture_guide/security/)
- [Firecracker design and threat containment](https://github.com/firecracker-microvm/firecracker/blob/main/docs/design.md)
- [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints/)
- [Docker network isolation](https://docs.docker.com/engine/network/drivers/none/)
- [TypeScript compiler model](https://www.typescriptlang.org/docs/handbook/typescript-from-scratch)

These references support technology and risk reasoning; they do not prove the implementation exists or that AlgoCove meets any target.

## 6. Architecture governance

### Change classification

| Change | Required governance |
|---|---|
| Clarification with no behavior/decision change | Update document, preserve review history |
| New component inside accepted boundary | Architecture review and spec traceability |
| Expensive-to-reverse technology or ownership change | New ADR |
| Changed security/privacy/trust boundary | Threat-model update and approval |
| Changed SLO/RPO/RTO or consistency model | Architecture and operational approval |
| New external provider/data processor | Privacy/security/vendor review plus adapter evaluation |
| New public API/event breaking change | Versioning/deprecation decision and contract review |
| New language, sandbox/runtime model, certification mode, minors, or organizations | New phase gate and dedicated architecture/security review |

### Review cadence

- Review before each implementation phase is authorized.
- Review after major pilot evidence changes assumptions.
- Review after security incidents or significant reliability failures.
- Review at least once per major release for stale deferred assumptions.

Do not edit an accepted ADR to make history look correct; supersede it.

## 7. Gate A0-A2 consolidated checklist

### Product and scope

- [ ] Target learners and six first-class languages approved
- [ ] Four initial patterns approved
- [ ] Learning modes and progressive hint contract approved
- [ ] Content rights boundary approved
- [ ] Minors and organization tenancy explicitly included or excluded

### Structural design

- [ ] Bounded contexts, owners, and dependency direction approved
- [ ] Modular-monolith core, dedicated execution plane, and extraction triggers approved
- [ ] Database/retrieval baseline and deferred technologies approved
- [ ] Multi-language execution contracts, sandbox boundary, and runtime-image governance approved
- [ ] Repository layering/import rules approved

### Data and AI

- [ ] Immutable content/version/provenance model approved
- [ ] Evidence ledger and mastery projection approved
- [ ] Retrieval evidence package and evaluation promotion gates approved
- [ ] Provider-neutral tutor and authored fallback approved
- [ ] Retention/deletion decisions identified for the pilot

### Assurance and operations

- [ ] Trust boundaries and threat model approved
- [ ] Authorization roles and separation of duties approved
- [ ] Proposed SLO/RPO/RTO targets accepted or revised
- [ ] Failure/degradation, backup/restore, and incident expectations approved
- [ ] Accessibility target approved
- [ ] Per-language conformance, isolation, capacity, patch, and runtime-deprecation gates approved

### Decision records

- [ ] ADR-0001 through ADR-0013 accepted, revised, rejected, superseded, or explicitly deferred

Unchecked items keep the architecture gate open. An open gate is not a failure; it is an honest signal that implementation authorization has not yet been given.
