# Phase 7 implementation evidence

**Date:** 2026-10-03

**Authorization:** The owner approved Phase 7 on 2026-10-02 and explicitly required complete implementation and testing. Local testing, commits and GitHub publication remain authorized. Live deployment remains excluded.

**Status:** Tasks 34, 35, 36, 51 and 37 and technical F7 checks are COMPLETE on localhost. Phase 8 remains unstarted and requires owner authorization.

## Scope and contracts

Implementation follows [the Phase 7 plan](../../../tasks/plan.md#phase-7-configurable-roadmap-planning), [roadmap state/calendar contracts](../../architecture/implementation-contracts.md#2-roadmap-data-and-state), [ADR-0013](../../adr/0013-configurable-timeboxed-roadmap-planning.md), [roadmap interfaces](../../architecture/interfaces-and-runtime-flows.md#roadmap-planning), [data ownership](../../architecture/data-and-ai-architecture.md) and the [product closure matrix](../../architecture/product-plan-and-closure-matrix.md).

The reviewed two-pointer pilot currently contains one original exercise and its introduction, plus existing reviewed review obligations. Comprehensive DSA and complete named-sheet coverage require later content breadth. The learner selects the pilot explicitly; comprehensive requests receive a reasoned rejection and alternatives. Six months does not manufacture six months of repeated work.

The runtime composition is AI-off, with a complete deterministic path. The provider-neutral port is exercised with fixture adapters. Task 45a owns live activation and provider configuration/evaluation. Phase 8 owns external readiness/handoff; external-only collection entries remain coverage metadata.

## Implementation and verification map

| Task | Implementation | Evidence |
|---|---|---|
| 34 | Private previews and expiration/staleness; explicit acceptance with expected active token; immutable accepted snapshots/items; one primary owner-scoped state; pause/resume/completion/archive and supersession; append-only check-ins/corrections | Acceptance races, ownership, stale tokens, lifecycle, history, rollback and privacy tests |
| 35 | Calendar horizons 1/2/3/4/6; study sessions; due reviews; prerequisites; required and optional work; configurable recovery reservation; indivisible-session rejection; sparse-content alternatives | Horizon/capacity/buffer/missed-day loops; representative snapshot; month-end/leap-year and beyond-end review fixtures |
| 36 | Content/rights/language/link eligibility; occurrence uniqueness; collection deduplication; due windows/buffer/capacity; pinned history; moved/removed/added/retained/blocked preview; reacceptance | Invalid-plan fixtures; old/new version comparison; missed-session recovery, timezone/goal changes, language practice and cross-version corrections |
| 51 | Atomic reservations; request/unit caps, rolling rate and pending concurrency; idempotent settlement; operation breakers/cooldown/probe; authorized reset/evaluation port; code-run integration | Concurrent admission, exhaustion, replay/conflict, rollback, finish deduplication, cooldown/reset and unchanged core writes under shedding |
| 37 | Strict bounded fixture proposal port; validation and malformed/injected/over-capacity/failure/timeout/budget fallback; complete preferences/preview/accept/lifecycle/check-in/history/replan UI | Proposal/route tests; complete Chromium journey, infeasibility and accessibility/narrow-width tests |
| F7 | Home uses eligible accepted work plus due reviews; outside-plan actions are labelled; Progress projects historical reported adherence separately from mastery | Read-model integration and adherence projection fixtures |

### Source map

- Domain: roadmap.ts, roadmap-scheduler.ts, roadmap-validator.ts, plan-adherence.ts, budget.ts.
- Application: roadmap-intent-use-cases.ts, roadmap-use-cases.ts, plan-proposal-fixture.ts, progress-read-model.ts.
- Persistence: migrations 0022–0024; roadmap intent/schedule/catalog/budget repositories; practice and progress repositories.
- Web: authenticated /api/planning/intent and /api/planning/roadmap; planning-preferences.tsx and roadmap-workspace.tsx; Home/Progress projections.
- Tests: roadmap intent/scheduler/proposal/adherence and route units, real PostgreSQL roadmap.test.ts, roadmap browser journeys, existing learning/execution regressions.

## Policy choices

### Calendar, coverage and capacity

- Calendar-month addition clamps month ends, including leap years. Conflicting explicit targets are rejected.
- Inputs declare IANA timezone, nonempty study weekdays/languages, registered collections, and 15–480 minutes per study day.
- Recovery policy v1 reserves 15% of remaining capacity by default, rounded up; learners can configure 5–40%. Recovery capacity is reserved before required/optional content.
- Authored pilot estimates are an introduction (20 minutes) and reasoning/trace/coding session (50 minutes). Oversized sessions are rejected, never divided into unreviewed pieces. Estimates are not guarantees.
- Study dates are local calendar labels, avoiding elapsed-hour DST errors. Reviews retain Phase 6 elapsed-UTC windows resolved into local dates. Overdue reviews remain recoverable. Beyond-end reviews remain visible in the queue and completion summary.
- Preferred languages are alternatives; an internal activity pins the first supported preference. Historical activities retain their original language. Switching after completion creates a new, reasoned language-practice occurrence without implying proficiency from concept evidence.
- Collection coverage reports total, internally supported, external-only and unavailable entries. Overlapping memberships do not duplicate required work. No copied content, automatic ingestion or account synchronization is introduced.

### Acceptance, lifecycle and history

- Previews expire after 24 hours and become stale when intent or active tokens change. Publication rechecks eligibility and fixed history server-side.
- Writes serialize on the learner. Retry receipts precede conflict checks; changed facts using one key conflict. Old receipts cannot roll back the database pointer.
- Acceptance, snapshot/items, active pointer, lifecycle journal, receipt and outbox commit together. Deferred ownership foreign keys connect active tokens to actual journal events. Raw history mutation, illegal transitions and mismatched targets fail closed.
- Pausing freezes prospective adherence obligations. Reviews remain independently visible. Resuming keeps the deadline. Changes to horizon/date/timezone/capacity/goal require preferences, a preview and explicit acceptance.
- Past/completed activities remain fixed with original timezone/language. Future work moves off missed sessions. Past missed required work receives a new recovery occurrence and reason; the original outcome remains historical.
- Check-ins are learner reported and create no attempt result, mastery or external verification. Corrections append reversals, including across earlier accepted versions. Schedules and original timestamps remain immutable.
- Completion is a schedule state, not a mastery certificate. Required future work must be completed; historical missed work remains visible. Archived/completed plans cannot resume directly.

### Optional-operation controls

| Policy v1 | Planner proposals | Code execution |
|---|---|---|
| Daily requests | 20 | 120 |
| Rolling-minute requests | 6 | 12 |
| Pending concurrency | 1 | 3 |
| Daily reserved units | 200 | 120 |
| Units per request | 10 | 1 |
| Breaker threshold / cooldown | 3 failures / 60 seconds | 3 failures / 60 seconds |

These are server-owned local policies. Proposal units are conservative allowance units, not real token billing or provider prices. Live-provider costing and production deployment controls remain Tasks 45a and 53.

Code-run reservation commits with run/attempt/outbox. Verified terminal delivery settles once. Learner wrong-answer/compile/runtime outcomes do not trip infrastructure breakers. Unresolved runs retain pending slots; elapsed time cannot admit overlapping replacement work. Execution-control fencing and admission limits remain in force.

Optional provider failure, timeout, invalid output, denied admission or unavailable budgeting returns the baseline. Ambiguous reservation retries do not repeat provider calls. After cooldown a breaker admits one pending probe and closes on success; operator reset is authorized and audited. The evaluator/operator port returns aggregate reserved-unit/pending/failure evidence.

Core authored content, drafts, attempts, planning inputs and deterministic AI-off planning remain independent of optional allowance availability.

## Verification

| Gate | Result |
|---|---|
| pnpm verify | 232 unit/web/architecture tests; formatting, lint, root/web/worker types, tokens, docs and secrets pass |
| pnpm test:integration | 55 real PostgreSQL tests across 24 migrations pass; 2 unchanged optional Linux execution-host tests skipped locally |
| pnpm build | Production build passes with both planning endpoints and /plan |
| pnpm test:a11y | 25 Chromium checks pass on localhost |
| pnpm test:e2e | 3 Chromium journeys pass: offline/reconnect, complete roadmap workflow and infeasible full-course recovery |
| pnpm security:audit | No known vulnerabilities found |

Authenticated browser journeys use explicit API fixtures. PostgreSQL persistence, API authentication/ownership, conflict/retry receipts, quotas and rollback are independently tested. Browser fixtures make no live Clerk, live AI, hosted infrastructure or new hostile-code runtime claim; execution gates retain separate evidence.

The 320px overflow discovered in the workflow was repaired with bounded select/button/fieldset sizing and wrapping. The complete workflow passes at that width with no automated accessibility violations.

## Handoff and cleanup

No Phase 7 implementation item is postponed. F7 technical gates are checked. Owner authorization for Phase 8 is the next gate; no external readiness/handoff or live provider is activated.

Tests use pinned pnpm 12.4.2 and a temporary native PostgreSQL 17.11/pgvector 0.8.6 cluster on loopback port 54329 with 64 MB shared buffers. Test files drop their isolated databases and roles. After verification the owned cluster, generated default cluster, log and temporary PostgreSQL/pgvector/krb5 formulas were removed. Filesystem and socket checks confirmed their absence and closed database/browser test listeners. No VM was created and no live deployment occurred. Shared libraries, dependencies and build output remain available.
