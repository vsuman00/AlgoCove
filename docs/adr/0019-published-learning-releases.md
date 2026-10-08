# ADR-0019: Published learning releases

**Status:** Accepted for local Phase 10 implementation, 2026-10-07; delivery evidence remains task-specific
**Date:** 2026-10-07
**Scope:** Owner instruction on 2026-10-07 authorizes the remaining Phase 10 extensions against the new architecture. The [shared learning contract](../architecture/shared-learning-contract.md) resolves implementation contracts. Independent publication, live-provider and later-phase gates remain separate.

## Context

The current pilot uses a fixed problem lookup. Lessons, sheets, planning and future interview sessions need consistent availability and exact compatible assets.

## Proposed decision

- Introduce a published learning catalog behind application queries. Topics, problems, lessons, approaches, scenarios and collection memberships have stable identities and immutable versions.
- A learning release binds exact lesson, problem, rubric, pseudocode, trace, hint, runtime-manifest and transfer versions. Validate compatibility and required assets before publication.
- Keep relational identities, foreign keys and uniqueness in PostgreSQL; use bounded, schema-validated JSON for typed instructional assets.
- Separate public summaries, authorized learner assets and restricted evaluation material. Publication does not grant every reader access to every asset.
- Attempts and plans retain exact release pins. Withdrawal prevents new work and follows existing in-flight policy without rewriting history.
- Use the existing modular monolith, worker and outbox. Server components call application queries directly; client panels own interactive drafts and playback.

## Alternatives and tradeoffs

Independent JSON blobs per page would be quicker initially but duplicate identity and availability logic. A new CMS/service adds deployment and authorization boundaries before they are needed. Release composition adds authoring validation and migration work.

## Migration and delivery

Task 45b defines the contract; 45c adds catalog/workspace reuse before new curriculum. Preserve legacy routes and pilot attempts. Add asset kinds through reviewed migrations, never infer implemented support from conceptual diagrams.

## Acceptance evidence required

Publish an existing pilot and a distinct test fixture; demonstrate exact pins, unsupported-asset rejection, withdrawal handling, ownership and restricted-payload exclusion.

See the [learning platform architecture](../architecture/learning-platform-evolution-2026-10-07.md), [implementation plan](../../tasks/plan.md) and [design contract](../../DESIGN.md). Existing accepted decisions remain in effect until an explicit acceptance or supersession decision is recorded.
