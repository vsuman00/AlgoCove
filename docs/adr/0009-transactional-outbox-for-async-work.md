# ADR-0009: Use a transactional outbox for asynchronous side effects

## Status

Proposed
## Date

2026-09-17

## Context

Content indexing, analytics, notifications, evaluation, and retention may happen asynchronously. Updating the database and then publishing a job can lose work on process failure; publishing first can expose uncommitted state.

## Decision

Commit state changes and an outbox event in the same PostgreSQL transaction. A relay/worker delivers events at least once. Consumers deduplicate by event ID and enforce idempotent business effects. Reconciliation detects old unpublished events and incomplete derived state.

## Alternatives considered

- **Synchronous dual write:** rejected because partial failure creates drift.
- **Distributed transaction:** rejected because external providers/queues do not justify its complexity.
- **Database polling without event identity:** rejected because deduplication and lineage would be weak.

## Consequences

- Async delivery is reliable without claiming exactly-once transport.
- Outbox growth, lag, and poison events require operations and alerts.
- Events and consumers must remain schema-compatible.
- PostgreSQL can serve as the initial queue substrate; Redis/another broker remains optional.

