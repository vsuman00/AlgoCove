# Phase 7 implementation evidence

**Date:** 2026-10-02

**Authorization:** The owner approved Phase 7 in this chat after Phase 6 was committed and pushed. Local testing and GitHub publication remain authorized. Live deployment remains excluded.

**Status:** Phase 7 IN PROGRESS. Task 34's private planning-input save/read path is implemented and verified. Accepted schedules and the remaining Phase 7 capabilities are not complete.

## Contracts reviewed

The slice follows [Task 34](../../tasks/plan.md#task-34-implement-roadmap-intent-and-immutable-plan-versions), [roadmap data/state and calendar contracts](implementation-contracts.md#2-roadmap-data-and-state), [data architecture](data-and-ai-architecture.md), [roadmap interfaces](interfaces-and-runtime-flows.md#roadmap-planning), and the [product closure matrix](product-plan-and-closure-matrix.md). Planning owns learner intent; practice retains learning outcomes. Preferences do not establish a validated or accepted schedule. Live AI activation remains Task 45a-owned.

## Implemented slice: private planning inputs

- `/plan` exposes goal, target role, 1/2/3/4/6 calendar-month horizon, start date, resolved target date, explicit timezone, daily capacity, study weekdays, implementation languages, and registered supporting collections.
- Calendar-month addition clamps to the final valid day of the destination month, including leap years. An explicit API target date that conflicts with the preset is rejected. New writes cannot backdate the start in the selected timezone.
- Capacity is bounded to 15–480 minutes per study day. Weekdays and languages must be nonempty distinct supported values; collection IDs must be distinct registered identities. Selecting a collection does not promise internal coverage, copied content or account synchronization.
- Authenticated `GET/POST /api/planning/intent` derives ownership from the session, uses `Cache-Control: no-store`, rejects malformed inputs and reports unavailable persistence honestly. Browser-supplied learner IDs cannot choose the owner.
- Migration `0022_roadmap_intents.sql` adds the planning schema's stable primary intent, immutable preference revisions, version-specific collection references and deduplicated command receipts. Bootstrap now grants the runtime role bounded access to the planning schema; existing databases must rerun role/schema bootstrap before migration.
- Save commands serialize on the learner, enforce expected revision tokens, and commit the revision, current pointer, collections, receipt and outbox event atomically. Concurrent identical saves replay one receipt; changed facts using the same key conflict. Two competing edits cannot silently overwrite each other.
- A lost-response retry retains the original receipt, including across a local-date boundary or after a newer revision exists. Old receipts never roll the current pointer back. A fresh backdated command remains invalid.
- Immutable history and composite ownership foreign keys reject direct rewrites and cross-owner command references. Learner privacy cascades can remove inputs; this is not completion of the later account-deletion workflow.
- The page preserves unsaved edits after a conflict, offers explicit reload, and labels saved preferences as planning inputs. It exposes no fake schedule, automatic acceptance or unimplemented AI action.

## Verification

| Gate | Result |
|---|---|
| `pnpm verify` | 211 unit/web/architecture tests and format/lint/root-web-worker types/tokens/docs/secrets gates pass |
| `pnpm test:integration` | 42 tests pass across 22 migrations; 2 unchanged optional Linux execution-host tests skipped |
| `pnpm build` | Production build passes with `/plan` and the planning-input endpoint |
| `pnpm test:a11y` | 25 Chromium checks pass on the localhost production build |
| `pnpm test:e2e` | Existing offline/reconnect recovery scenario passes |
| `pnpm security:audit` | No known vulnerabilities found |

New pure tests cover supported horizons, month-end and leap-year clamping, timezone date boundaries, mismatched target dates and invalid preferences. Route tests cover authentication-before-persistence, owner derivation, normalized input, unavailable persistence and invalid save tokens.

Seven real PostgreSQL scenarios cover concurrent save deduplication, ownership, invalid collections, conflicting edits, immutable revision history, old receipts, midnight replay, outbox rollback, deferred pointer integrity, cross-owner foreign keys and learner privacy cascades. Every integration file owns and drops its isolated database and roles.

Two new browser scenarios exercise preference save/reload, four-month clamping, collection selection, preserved input after conflict, signed-out recovery, keyboard navigation, 320px layouts and automated accessibility. Authenticated browser data uses explicit route fixtures; database persistence and API authentication/ownership are independently tested. No new live Clerk-provider, hosted infrastructure or hostile-code execution claim is made.

## Remaining Task 34 and Phase 7 work

1. Candidate and immutable accepted schedule versions, explicit acceptance with an expected active-version token, and one active primary plan.
2. Kind-specific plan item targets, pause/resume, completion, supersession, and preserved cross-plan outcomes/adherence.
3. Task 35: deterministic scheduler, capacity/prerequisites, reserved reviews/buffers and truthful sparse-content infeasibility.
4. Task 36: full plan validator and accepted replan previews that preserve completed/past work.
5. Task 51: atomic budgets, quotas, rate limits and circuit breakers.
6. Task 37: validated fixture-only AI proposal/fallback and schedule create/review/accept/pause/replan journeys.

Task 34 and F7 remain unchecked for these requirements. The next slice continues Task 34's accepted-version and lifecycle contracts. No new phase approval is needed to continue the already authorized Phase 7 work.

## Local operation and cleanup

Use pinned pnpm 12.4.2. For an existing local database, run `pnpm db:roles` before `pnpm db:migrate`; authentication and a configured runtime database are required to save private preferences. No execution host or Linux VM is needed for this slice.

Tests used a temporary native PostgreSQL 17.11/pgvector 0.8.6 cluster bound to loopback port 54329. All test databases/roles are dropped, the cluster is stopped and removed, generated default cluster and logs removed, and temporary PostgreSQL, pgvector and krb5 formulas uninstalled. No VM was created. Shared libraries, workspace dependencies and build output remain available.
