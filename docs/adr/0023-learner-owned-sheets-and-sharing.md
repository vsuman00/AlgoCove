# ADR-0023: Learner-owned sheets and explicit sharing

**Status:** Proposed

**Date:** 2026-10-07

## Context

Curated collections and private learner composition have different ownership and publication requirements. The reference advertises custom shareable sheets, but its private implementation was not inspected.

## Proposed decision

- Extend the collection module with owner-scoped private sheets, stable section/membership IDs and optimistic revisions. Reuse canonical references and progress overlays without duplicating learning evidence.
- Save, reorder, copy and delete through authorized, bounded, idempotent commands. Unknown URLs cannot become trusted catalog entries automatically.
- Sharing is an explicit publication of a sanitized immutable snapshot. Learner notes, source, attempts, journals and progress are excluded. Private edits do not silently alter shared snapshots.
- Use operational revocation and current availability checks on public reads. Shared URLs do not imply authentication; unlisted snapshots must contain only public-safe fields.
- Define visibility, moderation, reporting, abuse controls, retention and deletion before enabling sharing. Existing private-data export/deletion applies to owned records.

## Alternatives and tradeoffs

Making every sheet a curated content publication overloads authoring governance. Publishing live private rows risks accidental disclosure and unstable links. Snapshots require version/revocation handling but create a reviewable disclosure boundary. Collaborative editing and external bulk import are outside the first scope.

## Migration and acceptance

Tasks 59a–59b follow curated discovery and privacy controls. Existing curated references and journals retain identity. Acceptance covers cross-user access, revision conflicts, duplicate/reordered members, public payload minimization, copying attribution, withdrawal, revoked cache entries and deletion. Implementation waits for this decision and phase authorization.

See the [journey and edge-case contract](../architecture/website-journeys-and-coverage.md) and [implementation plan](../../tasks/plan.md). This record authorizes no implementation.
