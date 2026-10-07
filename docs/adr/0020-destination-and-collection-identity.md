# ADR-0020: Separate practice destinations and collections

**Status:** Proposed
**Date:** 2026-10-07
**Scope:** Documentation proposal only; implementation and phase approvals remain pending.

## Context

The current provider enum mixes named sheets and destination sites. One external problem can appear in several sheets, and a sheet URL is not necessarily a solve URL.

## Proposed decision

- Model destination platform and canonical external problem separately from collection, collection version and ordered membership.
- Uniqueness belongs to platform plus canonical problem key; collection membership carries provenance, attribution and ordering independently.
- Internal mappings state their reviewed relationship, including exact counterpart, concept practice or external-only coverage. Similar concepts do not imply identical problems.
- Keep outbound practice and self-reported journals. Opening a link is not verified completion or mastery evidence.
- Allowlist destination hosts, validate URL shape and review redirects. Distinguish solve links from explanation/source-list links.

## Alternatives and tradeoffs

Keeping the existing enum avoids migration work but makes overlap, deduplication and source attribution unreliable. An unrestricted URL field loses canonical identity and validation.

## Migration and delivery

Task 45d adds reviewed mappings while preserving legacy reference IDs and journals. Reconcile ambiguous records manually, retain rollback compatibility, migrate readers and writers before retiring old fields. Do not automatically convert every existing provider to LeetCode.

## Acceptance evidence required

The same external problem in two sheets deduplicates required work without losing memberships; source-list links never masquerade as solve links; journals survive migration.

See the [learning platform architecture](../architecture/learning-platform-evolution-2026-10-07.md), [implementation plan](../../tasks/plan.md) and [design contract](../../DESIGN.md). Existing accepted decisions remain in effect until an explicit acceptance or supersession decision is recorded.
