# Phase 6 implementation evidence

**Date:** 2026-10-02

**Scope:** Authorized localhost implementation; no hosted deployment or Linux VM.

**Status:** Task 30 submission evidence path implemented and tested. Task 30 remains PARTIAL for additional reviewed explanation/confidence/transfer sources; Tasks 31–33 and F6 remain open.

## Governing documents

Implementation follows [Task 30](../../tasks/plan.md#task-30-implement-append-only-mastery-evidence-and-projection-v1), [ADR-0008](../adr/0008-evidence-ledger-for-mastery.md), the [evidence/transaction contracts](implementation-contracts.md), [data architecture](data-and-ai-architecture.md), [runtime flows](interfaces-and-runtime-flows.md), [security and privacy](security-reliability-operations.md), and [quality traceability](quality-and-traceability.md). Phase 6 authorization accepts the ledger architecture; it does not approve guessed numeric scoring thresholds or establish learning efficacy.

## Implemented

- `0018_problem_concept_mapping.sql` binds stable concepts to an exact problem version, with rationale and author. Published/retired mappings are immutable and mapping changes serialize with content publication. The local seed supplies the reviewed two-pointers mapping and is tested twice for idempotency.
- `0019_assessment_assistance.sql` adds immutable assessment assistance snapshots. The submission transaction and persisted hint disclosure share a learner row lock that permits foreign-key reads. Assistance is cumulative across attempts and languages for the same problem version. Disclosures after a submission do not rewrite its observation. Legacy observations retain NULL assistance and cannot become independent evidence.
- The practice-owned observation and version 2 outbox payload commit with the terminal result. Boolean and NULL values now survive payload sanitization; source text remains absent and only its digest is retained.
- The mastery-owned consumer loads canonical committed practice facts by event ID, ignoring caller-supplied verdicts. The learning-owned mapping port only returns published/retired concept mappings.
- `0020_mastery.sql` adds the mastery schema's append-only evidence ledger, immutable policy definitions, replaceable per-learner/concept/policy projections, and terminal outbox dead letters. Evidence deduplicates by observation/concept and source event/concept. Evidence insertion, projection updates and projection outbox events are atomic.
- The deterministic rule projector sorts source observations by observed time and ID. Its watermark identifies the complete immutable source set; PostgreSQL compacts that token using SHA-256. Equal-count backfills cannot reuse a watermark simply because the latest observation is unchanged. Operator replay restores an empty read model, and a different policy can be compared without changing source facts or the learner's default policy.
- The relay uses leased claims, bounded retry delays, a maximum attempt count and persisted dead letters. Lost acknowledgements may replay the handler without duplicating evidence or projection events.
- Authenticated `GET /api/mastery/{conceptId}?afterObservation={observationId}` scopes ownership from authentication and returns `ready` or `projection_pending`, the policy version, watermark, descriptive band, reasons and language outcome counts. Another learner's observation returns 404. Responses use `Cache-Control: no-store`.
- Completed submission run-status responses include an owned observation receipt and concept projection status. Run-only execution remains outside assessment credit. When no observation receipt is supplied to the mastery endpoint, it detects ledger/read-model mismatch but cannot promise that every queued source event has been consumed.

## Policy v1 and limits

These bands describe observed evidence, not a validated learning score:

| Latest qualifying verified concept outcome | Band |
|---|---|
| No verified concept outcome | `unassessed` |
| Wrong answer, runtime failure or resource limit | `needs_practice` |
| Pass with historical assistance unknown | `completion_unclassified` |
| Pass with any persisted assistance | `assisted_completion` |
| Pass without assistance, without verified delayed transfer | `independent_completion` |
| Pass without assistance plus reviewed verified delayed-transfer facts | `independent_delayed_transfer` |

Compile/type errors affect only the language outcome overlay. Infrastructure faults and cancellation affect neither concept credit nor language proficiency. Model-advisory, self-reported and interaction-only correctness cannot become verified concept evidence. Full-solution disclosure is always assisted completion. Reason codes retain relevant history; they do not assert that immediate test success proves conceptual understanding or retention.

The current persisted source adapter supplies correctness and assistance. Explanation, confidence, delay and transfer fields are explicitly NULL because no immutable reviewed source for those facts has been connected here. The pure policy handles reviewed explanation/transfer fixtures and compares an explanation-requiring policy, but those fixtures are not live learning evidence. Confidence is retained as a nullable source fact and does not independently certify mastery. Task 31 must establish review/transfer sources and scheduling; structured-check observations and confidence provenance still need a reviewed immutable ingestion path before Task 30 is marked complete.

Evidence UPDATE and direct DELETE are rejected. Source/learner privacy cascades can remove evidence, and projections can be rebuilt afterward; this is not completion of the later account-deletion workflow. Rebuilding a comparison projection does not publish it as the learner policy. New content still needs reviewed problem/concept mapping authoring before publication. Progress and review interfaces are not implemented by this slice.

## Local operation

For an existing database, rerun role/schema bootstrap with the operator connection before migrations so the mastery schema and runtime grants exist:

```sh
pnpm db:roles
pnpm db:migrate
pnpm db:seed:practice
pnpm mastery:consume --limit=100
pnpm mastery:rebuild usr_eeeeeeeeeeeeeeee cpt_aaaaaaaaaaaaaaaa
```

The bounded consumer uses `DATABASE_URL`; operator rebuild uses `DATABASE_ADMIN_URL`. This is an explicit local CLI, not an automatically deployed daemon. Dead letters retain event identifiers and a bounded reason; source data and credentials are not printed. Correct the source/dependency before an operator resets a dead letter for replay.

## Verification

Verification uses Node.js 26.5.0, pinned pnpm 12.4.2 and a temporary native PostgreSQL 17.11/pgvector 0.8.6 server bound to loopback. This slice tests application/database behavior using trusted-result fixtures; it does not repeat unchanged Linux gVisor judging or claim new hostile-code execution evidence.

- PostgreSQL: **27 passed, 2 opt-in execution-host tests skipped**, across **20 migrations**. Six mastery integration scenarios cover concurrent duplicate delivery, pending/owner checks, empty-model rebuild, side-by-side policy comparison, cumulative cross-language assistance, transactional rollback, append-only rejection/privacy cascade, lost acknowledgement and persistent dead letters. Both operator CLI paths execute against the isolated database.
- `pnpm verify`: **193 unit/web/architecture tests pass**, along with formatting, lint, domain/application/web/worker type checks, generated tokens, documentation links and secret checks. Worker type checking is now included in the repository/CI verification command.
- Production build: passes, including the new mastery route.
- Browser: **16 Chromium accessibility checks and 1 offline/reconnect draft-recovery scenario pass** against the production build on localhost. These are unchanged UI regression checks, not a new review/progress interface.
- Dependency audit: **no known vulnerabilities found** with the existing pinned dependency graph. The lockfile change only adds the worker application/domain workspace links; frozen installation passes.

## Cleanup and host state

The temporary PostgreSQL server is stopped and port 54329 is closed. All isolated test databases and roles were dropped, both task-generated PostgreSQL clusters and the cluster log were removed, and the temporary PostgreSQL 17, pgvector and krb5 packages were uninstalled. No Linux VM was created or left running. Earlier native test setup updated the existing Homebrew ca-certificates, OpenSSL 3 and xz packages; those shared library updates remain installed. Repository dependencies and build output remain available for local development.
