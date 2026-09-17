# AlgoCove architecture index

**Status:** Proposed  
**Architecture gate:** `A0 — awaiting owner approval`  
**Prepared:** 2026-09-17  
**Scope:** Architecture plus a separately proposed implementation plan; implementation evidence is tracked in the phase evidence records and task ledger

## 1. Architectural objective

Design an enterprise-quality architecture for a calm, adaptive DSA learning platform without prematurely creating an enterprise-scale operational burden. “Enterprise-quality” here means explicit boundaries, replaceable dependencies, security and privacy by design, deterministic fallbacks, measurable reliability, reproducible AI evaluation, and a controlled path to scale. It does not mean starting with microservices, Kubernetes, multiple databases, or multi-region infrastructure.

The architecture optimizes for the product's core proof:

> A learner completes a short guided session, solves a calibrated problem with limited assistance, explains the invariant, and later transfers the pattern to a different problem.

## 2. Source of truth and evidence hierarchy

This architecture is derived from the completed research report at:

`/Users/vaibhavsuman/Documents/Codex/2026-09-17/asidsa-ai-powered-dsa-rag-engine/outputs/ASIDSA_RESEARCH_AND_PRODUCT_REPORT.md`

The report's JavaScript-first learner/execution assumption is explicitly superseded by the owner's 2026-09-17 clarification: Python, JavaScript, TypeScript, Java, C++, and C are all first-class from the target architecture's first learner-facing release. The report remains authoritative for the learning model, product direction, and other researched constraints unless a later approved decision supersedes them.

When documents disagree, use this order:

1. explicit current owner requirements, followed by approved ADRs;
2. approved architecture documents in this directory;
3. approved product/specification documents created in a later phase;
4. research evidence;
5. implementation, once implementation is authorized.

Code must not silently override an approved architectural invariant. A conflict requires a new ADR.

## 3. Assumptions being made

| ID | Assumption | Architectural consequence | Validation status |
|---|---|---|---|
| A-01 | Learners may practice in Python, JavaScript, TypeScript, Java, C++, or C | All six languages are first-class content and execution targets | Owner-confirmed |
| A-02 | Initial curriculum covers arrays/hashing, two pointers, sliding window, and stack | Small, curated curriculum graph and deterministic trace grammar | Unvalidated |
| A-03 | A recommended next action reduces overwhelm | Recommendation service is a first-class domain capability | Unvalidated |
| A-04 | Progressive hints outperform immediate full solutions | Hint policy is enforced outside the LLM | Unvalidated |
| A-05 | Active 2D visualization helps selected topics | 2D trace runtime is core; 3D remains experimental | Unvalidated |
| A-06 | Original or explicitly licensed content is available | Publication is fail-closed on provenance and review | Unvalidated |
| A-07 | Early traffic is compatible with a modular monolith and one PostgreSQL primary | No microservice or distributed database fleet initially | Planning assumption |
| A-08 | One model provider plus one tested fallback is sufficient initially | Provider-neutral gateway, no multi-model router | Planning assumption |
| A-09 | Local development comes before a cloud decision | Deployment model remains cloud-neutral; AWS is a later decision | Owner-stated |
| A-10 | Learner code, attempts, and conversations are private | Private data is excluded from the shared learning corpus and indexes | Required |
| A-11 | LeetCode and similar providers are outbound practice destinations, not synchronized data sources | AlgoCove stores permitted source links and a learner-owned handoff journal; it does not scrape, import, or automatically verify provider activity | Owner-confirmed |
| A-12 | Learners choose a timeboxed plan horizon of 1, 2, 3, 4, or 6 months | Roadmap plans are versioned, adaptive, and validated against deterministic workload/prerequisite constraints; AI proposes but does not authorize a plan | Owner-confirmed |

If A-01, A-02, A-06, or A-09 changes, review the system, data, and security documents before implementation planning.

## 4. Language-support contract

AlgoCove is multi-language by design, not a JavaScript product with later translations.

- First-class language IDs are `python`, `javascript`, `typescript`, `java`, `cpp`, and `c`.
- The curriculum graph, DSA concepts, readiness, mastery evidence, and review scheduling are language-neutral.
- Learners may choose one or more preferred languages and may start a new attempt in any supported language.
- Every executable problem in the launch curriculum must have reviewed starter/signature contracts, harnesses, canonical solutions, common-error guidance, and shared semantic fixture coverage for all six languages.
- JavaScript and TypeScript are distinct learner experiences; TypeScript includes type-check/transpile behavior and TypeScript-specific diagnostics.
- C and C++ are distinct learner experiences even if they share parts of a compiler image or toolchain.
- The UI must display actual language availability and runtime status. It must never silently translate, fall back, or mark one language's result as another's.
- Adding a seventh language requires a new reviewed language profile, runtime image, content/conformance coverage, operational capacity, and architecture/security approval. It must not require changing mastery semantics.

## 5. Architecture principles

1. **Learning policy is deterministic application logic.** An LLM may explain but may not decide authorization, hint limits, mastery, publication, or retention.
2. **The database is the system of record.** PostgreSQL owns transactional product state, curriculum state, learner evidence, content metadata, and retrieval metadata.
3. **AI is an optional, degradable dependency.** Fixed reviewed hints and authored lessons must preserve core learning when a provider fails or budgets are exhausted.
4. **Store evidence, not only conclusions.** Raw mastery evidence is retained so scoring can be recalculated when the model changes.
5. **Content is governed data.** Every published item has a stable ID, version, source/license, checksum, reviewer, and lifecycle state.
6. **Private and public corpora never mix by default.** Learner code and conversations do not enter shared retrieval or model-training flows without explicit consent and a separate policy.
7. **Start exact and observable.** Exact retrieval and simple rules establish baselines before approximate indexes, rerankers, or advanced knowledge tracing.
8. **Prefer extraction over premature distribution.** A modular monolith keeps boundaries in code; measured scaling or isolation needs justify process boundaries.
9. **Accessibility is a system constraint.** Keyboard access, text equivalents, reduced motion, and low-power fallbacks are architectural requirements.
10. **Claims require reproducible evidence.** Performance, retrieval, learning, and reliability claims must cite a versioned dataset, configuration, workload, and report.

## 6. Architecture views and reading order

1. [System design](system-design.md) — who uses AlgoCove, what the system contains, and where responsibility lives.
2. [Data and AI architecture](data-and-ai-architecture.md) — how knowledge, learner evidence, retrieval, generation, and evaluation remain trustworthy.
3. [Interfaces and runtime flows](interfaces-and-runtime-flows.md) — how components collaborate without leaking responsibilities.
4. [Security, reliability, and operations](security-reliability-operations.md) — how the design fails safely and can be operated.
5. [Quality and traceability](quality-and-traceability.md) — measurable scenarios, source traceability, standards, and review checks.
6. [Product plan and closure matrix](product-plan-and-closure-matrix.md) — end-to-end journeys, plan horizons, gates, loopholes, and non-goals.
7. [ADRs](../adr/README.md) — why the expensive-to-reverse decisions were selected.

The [implementation contracts](implementation-contracts.md) resolve roadmap, judging, evidence and recovery details. The [review findings](review-findings.md) record corrections and remaining validation gates. [DESIGN.md](../../DESIGN.md) is the approved UI input; architecture review does not replace it.

## 7. Capability map

| Bounded context | Owns | Depends on |
|---|---|---|
| `identity-profile` | Account linkage, learner goals, time budget, preferences, privacy choices | External identity provider only |
| `curriculum-content` | Concepts, prerequisites, learning objects, problems, licenses, publication | None |
| `roadmap-planning` | Timeboxed plan intent, AI plan proposals, deterministic schedule validation, replanning, daily/weekly plan projections | identity-profile, curriculum-content, mastery-review |
| `code-execution` | Language/runtime manifests, compile/run orchestration, sandbox policy, test execution, normalized results | None; implements an application-owned execution port |
| `practice-assessment` | Sessions, attempts, test outcomes, misconception observations, hint allowance, external handoff journal | identity-profile, curriculum-content, code-execution |
| `visualization` | Trace protocol, trace validation, checkpoints, accessible rendering contracts | curriculum-content |
| `mastery-review` | Evidence ledger, interpretable mastery projection, review scheduling, recommendation explanation | practice-assessment, curriculum-content |
| `tutor-retrieval` | Intent, retrieval, fusion, evidence package, tutor generation, citations, abstention | curriculum-content, practice-assessment policy |
| `content-operations` | Authoring workflow, validation, chunking, embedding, evaluation, promotion | curriculum-content, tutor-retrieval ports |
| `platform-operations` | Audit, telemetry, rate limits, budgets, feature flags, configuration, health | All runtime contexts |

Dependencies point toward stable providers and must remain acyclic. Cross-context data changes occur through application commands and domain events, not direct table mutation from another context.

## 8. Decision status language

| Status | Meaning |
|---|---|
| `PROPOSED` | Designed but not approved; may change during architecture review |
| `ACCEPTED` | Approved for later planning and implementation |
| `DEFERRED` | Intentionally excluded until a trigger or measurement exists |
| `REJECTED` | Considered and not selected; rationale retained |
| `SUPERSEDED` | Replaced by a later ADR; history retained |

Active ADRs are currently `PROPOSED`; ADR-0004 remains `SUPERSEDED`.

## 9. Architecture review gates

### Gate A0 — product and scope alignment

- Initial learner and six-language scope are approved.
- Four initial patterns and learning modes are approved or explicitly revised.
- Original/licensed content boundary is accepted.
- Outbound-only external practice handoff and no automatic provider synchronization are accepted.
- Configurable plan horizons and AI-proposal/deterministic-validation boundaries are accepted.
- 2D-first visualization and isolated server-side multi-language execution scope are accepted.

### Gate A1 — structural architecture

- Modular-monolith core, dedicated code-execution trust boundary, and worker extraction triggers are approved.
- Context ownership and dependency directions are approved.
- PostgreSQL + pgvector baseline and Chroma/Redis deferral are approved.
- API/event contracts and consistency rules are approved.

### Gate A2 — assurance architecture

- Threat model and privacy/retention decisions are approved.
- SLO proposals and failure/degradation behavior are approved.
- Backup/restore targets and evaluation/promotion gates are approved.

A proposed implementation plan and task ledger may be prepared for review, but application code must not begin until A0-A2 are approved and the relevant phase checkpoint is explicitly authorized.

## 10. Open owner decisions

1. Are minors permitted? If yes, consent, privacy, analytics, and retention requirements materially change.
2. Will AlgoCove initially serve individuals only, or must organizations/classes and tenant administration exist in V1?
3. Should account deletion be immediate hard deletion where legally possible, or a recoverable grace period followed by purge?
4. Is the authored corpus English-only at launch?
5. Is social login required, or can the first release use magic-link/email authentication?
6. What maximum monthly AI budget and per-learner budget should drive circuit breakers?
7. Which deployment region and applicable privacy regime should be assumed when cloud planning begins?
8. Which sandbox technology satisfies the approved isolation, startup-latency, language-compatibility, and operating-cost criteria?
9. Which exact compiler/runtime versions form the first supported execution matrix?

These are intentionally not resolved by guessing. The proposed design isolates them so they can be decided before implementation.

## 11. Explicit exclusions from this architecture phase

- Package or framework version pinning
- Vendor selection for authentication, hosting, email, object storage, or observability
- Redesigning the approved visual brand system in [DESIGN.md](../../DESIGN.md)
- Application implementation before architecture and phase-gate approval
- Production deployment or infrastructure provisioning
- Scraping or importing third-party coding-platform content
- Automatic synchronization or verification of third-party coding-platform accounts
- Selection or provisioning of the production sandbox platform
- 3D visualization implementation
- Chroma, Redis, Kafka, Kubernetes, or multi-region deployment
