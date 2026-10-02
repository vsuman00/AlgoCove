# Phase 6 implementation evidence

**Date:** 2026-10-02

**Scope:** Authorized localhost implementation. No hosted deployment or Linux VM.

**Status:** Tasks 30–33 and the three technical F6 checks are COMPLETE for the published local learning bundle. The owner subsequently approved Phase 7 on 2026-10-02; its implementation is tracked in [Phase 7 evidence](phase7-evidence.md).

## Governing documents

Implementation follows [the Phase 6 plan](../../tasks/plan.md#phase-6-mastery-review-recommendation-and-progress), [ADR-0008](../adr/0008-evidence-ledger-for-mastery.md), [implementation contracts](implementation-contracts.md), [data architecture](data-and-ai-architecture.md), [runtime flows](interfaces-and-runtime-flows.md), [security and privacy](security-reliability-operations.md), and [quality traceability](quality-and-traceability.md). These descriptive policies are implementation rules, not calibrated learning scores or evidence of learning efficacy.

## Task 30: Immutable sources and reproducible mastery

- Migrations 0018–0020 retain exact problem/concept mappings, cumulative assistance snapshots, deduplicated evidence, immutable policies and replaceable projections. Migration 0021 adds canonical structured explanation/review observations with real source types and foreign keys. Non-code checks never fabricate code runs or language passes.
- Code submission correctness and cumulative assistance are server-observed. Explanation correctness is graded from an immutable saved reasoning revision using private reviewed choice keys. Free-form prose remains advisory. Confidence is optional and explicitly learner-reported; it cannot independently certify mastery.
- Review observations persist actual server timestamps, elapsed delay, reviewed rubric, exercise identity and transfer provenance. An unseen authored transfer scenario is a different task from the original problem. Reusing an exercise is recall, never a new independent transfer. Incorrect reviews remain evidence and schedule more practice.
- Source observation, digest, activity and outbox writes commit atomically. Authenticated routes derive ownership from the session; retries with identical facts replay the receipt, while changed facts conflict. The consumer reloads canonical persisted sources. Ledger insertion, projection, review reconciliation and projection outbox updates are atomic.
- Signed execution callbacks and learning-source endpoints attempt projection delivery after the source commit. A failed projection leaves a durable pending receipt; the leased CLI relay retries, deduplicates lost acknowledgements and records exhausted deliveries as dead letters.
- SHA-256 watermarks identify the complete source set. Rebuild restores an empty model across code, explanation and review sources without altering facts or existing review identities. Comparison policies remain separate from the learner default.
- `PUT /api/content/concept-mapping` requires author permission and an owned draft. Mapping changes invalidate prior technical/pedagogical reviews and validation. Published mappings remain immutable and serialize with publication. New content requires a reviewed successor version.
- Review exercise publication requires four distinct author, technical reviewer, pedagogical reviewer and publisher identities with active grants, valid bounded private keys and rights metadata. Published keys are immutable; retirement removes new availability. Local seed actors are development fixtures, not evidence of a production human approval process.

### Mastery policy v1

| Latest qualifying checked concept outcome | Band |
|---|---|
| No checked completion | `unassessed` |
| Wrong answer, runtime failure or resource limit | `needs_practice` |
| Pass with historical assistance unknown | `completion_unclassified` |
| Pass with persisted assistance | `assisted_completion` |
| Pass without assistance | `independent_completion` |
| Pass without assistance on an unseen, delayed reviewed transfer task | `independent_delayed_transfer` |

An explanation alone cannot establish completion. Compile/type failures affect only the language overlay; infrastructure failures and cancellations earn neither concept credit nor study activity. Full-solution disclosure remains assisted. Historical reason codes explain prior evidence; immediate correctness does not prove retention. The same problem's prior disclosure remains cumulative across languages, while a new independent transfer exercise has its own unassisted source.

Evidence updates and direct ledger deletion are rejected. Source/learner privacy cascades invalidate projections for rebuild; the later account-deletion workflow remains Phase 9-owned.

## Task 31: Review scheduling and recovery

Review policy v1 uses elapsed UTC days: 1 day after practice-needed/assisted/unclassified outcomes, 3 days after independent completion, and 7 days after independent delayed transfer. Each due window lasts 24 hours. These are declared scheduling defaults, not empirically optimized retention intervals.

A learner/concept/watermark/policy has one schedule; one open item per learner/concept is enforced in PostgreSQL. Events retain scheduling, supersession, deferral, answer and completion history. Projection replay does not shift an existing origin's window. Timezone changes affect presentation without changing UTC obligations.

`/review` and authenticated `GET/POST /api/review` show upcoming, due, overdue, deferred, completed and pending states. Learners can defer prospectively by one hour to thirty days; the page offers a 24-hour recovery action. Overdue items remain answerable and do not themselves change mastery or streaks. Retired/unavailable content stays recoverable as an unavailable queue item and cannot be graded or recommended. Public exercises omit private answer keys.

## Task 32: Explainable next action

`GET /api/learner-home` and the Home page present one action and up to two distinct alternatives. Deterministic ordering prioritizes due reviews, practice-needed concepts and less recently practiced eligible content, with stable identifiers resolving ties. Required prerequisites use current independent evidence, and pending sources cannot grant prerequisite credit. Preferred language is included in the action URL and honored by the workspace.

Cold starts receive an authored introduction; missing profiles prompt setup. Goal text supplies explicit context, without inferred skills or promised outcomes. Every action has machine-readable reasons and learner-readable explanations. Only published, available content with valid rights, published manifests and an implemented workspace route can be recommended. An unavailable language or missing prerequisite produces a reasoned unavailable state.

## Task 33: Separate progress and consistency

`/progress` and authenticated `GET /api/progress` expose `asOf`, policy version and profile timezone, with separate sections for:

- Internal concept mastery and code-language outcomes, including pending source/projection states.
- Confidence calibration observations: self-reported confidence alongside checked outcomes, without an invented ability score.
- Review health: due, overdue, deferred, completed and pending counts.
- External journal: append-only learner-reported handoff/completion/correction, canonical reviewed outbound references, and command deduplication. No scraping, provider credentials or external completion verification. These reports never become internal mastery or verified study activity.
- Plan adherence: explicit `no_accepted_plan`, with null adherence counts. Accepted plans belong to Phase 7; session completion is shown separately.
- Consistency policy v1: one active day per captured learner-local date for a checked code assessment, checked saved explanation, or answered review, including incorrect answers. Review-only days count. There are zero grace days and no automatic rest days. Prospective pauses bridge gaps without adding active days, for at most 365 calendar days.

Activity captures its timezone/date once. Profile changes apply to new activity; historical facts remain unchanged. Current streaks and active-day totals are scoped to the current captured timezone and labelled accordingly. Pause requests carry the displayed timezone and conflict if another tab changes the profile before submission. Backdated pauses and invalid calendar dates are rejected.

## Local operation

Use the repository's pinned pnpm 12.4.2 and Node >=22.18:

```sh
pnpm db:roles
pnpm db:migrate
pnpm db:seed:practice
pnpm mastery:consume --limit=100
pnpm mastery:rebuild usr_eeeeeeeeeeeeeeee cpt_aaaaaaaaaaaaaaaa
```

Bootstrap grants before migrating an existing database. Consumer uses `DATABASE_URL`; operator rebuild uses `DATABASE_ADMIN_URL`. The local seed supplies original reviewed reasoning/transfer fixtures and remains idempotent. Browser learning sources update automatically when delivery succeeds; run the bounded consumer as a recovery/backlog operation. Diagnose and repair source/dependency failures before resetting a dead letter for replay. No new hosted daemon is deployed.

## Verification

Testing uses the existing Node toolchain, pinned pnpm 12.4.2 and temporary PostgreSQL 17.11/pgvector 0.8.6 bound to `127.0.0.1:54329`.

| Gate | Result |
|---|---|
| `pnpm verify` | 203 unit/web/architecture tests; formatting, lint, root/web/worker types, tokens, docs and secret checks pass |
| `pnpm test:integration` | 35 pass across 21 migrations; 2 unchanged opt-in execution-host tests skipped |
| `pnpm build` | Production build passes with all new pages and endpoints |
| `pnpm test:a11y` | 23 Chromium checks pass against localhost production build |
| `pnpm test:e2e` | Offline/reconnect draft recovery passes |
| `pnpm security:audit` | No known vulnerabilities found |

Database tests cover real immutable structured sources, private-key grading, source/outbox/activity rollback, owner isolation, changed-fact conflicts, concurrent duplicate answers/delivery, delay and transfer provenance, overdue recovery, deferral, wrong/repeated reviews, deterministic scheduling/rebuild, CLI consumption, self-report separation/correction, timezone preservation, prospective pause fences, mapping review invalidation and published-key/duties constraints.

Browser checks exercise the rendered overdue review, answer/confidence receipt, deferral, populated progress, pause payload/timezone, keyboard recovery, narrow layouts, cold start, preferred language, due-review and language-unavailable recommendations. Authenticated browser data is supplied by explicit route fixtures; actual database behavior and route authentication/ownership are independently tested. This does not claim a new live Clerk-provider handshake or repeat unchanged Linux gVisor execution. The first problem remains the supported local bundle; broader curriculum and learning-outcome claims require later gates.

## Cleanup and next phase

All isolated test databases and roles are dropped. The temporary server is stopped, port 54329 is closed, generated PostgreSQL clusters/log removed, and temporary PostgreSQL 17, pgvector and krb5 formulas uninstalled. No VM was created. Previously existing shared CA/OpenSSL/xz updates remain installed; workspace dependencies and build output remain available.

The owner approved Phase 7 after this handoff and separately authorized GitHub publication. Task 34's roadmap intent and immutable plan versions are tracked in [Phase 7 evidence](phase7-evidence.md). Production deployment remains excluded.
