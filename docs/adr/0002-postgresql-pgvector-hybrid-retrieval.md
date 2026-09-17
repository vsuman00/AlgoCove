# ADR-0002: Use PostgreSQL and pgvector for initial hybrid retrieval

## Status

Proposed
## Date

2026-09-17

## Context

The corpus is initially small, relational filters and exact content versions are essential, and content publication must remain consistent with search eligibility. Operating PostgreSQL plus a dedicated vector database would create synchronization, backup, filtering, and failure-mode complexity.

## Decision

Use PostgreSQL as the source of truth, PostgreSQL full-text search for lexical candidates, and pgvector for dense candidates. Fuse candidates with a versioned reciprocal-rank policy. Start with exact vector search; add an approximate index only after benchmark evidence. Keep a vector-store port so Chroma can be benchmarked later without entering the domain contract.

## Alternatives considered

- **Chroma plus PostgreSQL:** deferred until independent vector scale or measured quality/latency benefit justifies dual-store operations.
- **Vector-only retrieval:** rejected because exact DSA terms, constraints, and API names require lexical retrieval.
- **External search engine:** deferred because the initial corpus and operational envelope do not require it.

## Consequences

- Transactions, permission filters, versions, and embeddings remain close.
- Retrieval SQL must remain inspectable; do not hide it behind a generic repository.
- PostgreSQL load must be measured as corpus/traffic grows.
- A future second index is populated from an outbox, never synchronous dual writes.

