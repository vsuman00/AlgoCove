# ADR-0008: Store an evidence ledger and derive mastery projections

## Status

Proposed
## Date

2026-09-17

## Context

A single mutable mastery score hides how assistance, delay, misconceptions, explanations, and confidence produced it. The scoring model will evolve as pilot evidence grows; historical data must remain usable and explainable.

## Decision

Store append-only, deduplicated, versioned mastery evidence linked to attempts/reviews. Derive a per-learner/per-concept projection with an interpretable versioned policy. Preserve assistance depth and distinguish immediate completion from delayed independent transfer. Permit full projection rebuild and side-by-side policy comparison.

## Alternatives considered

- **Mutable numeric score only:** rejected because it is not reproducible or explainable.
- **Complex ML knowledge tracing at launch:** rejected because there is insufficient data and it makes early decisions opaque.
- **Full-system event sourcing:** rejected because only targeted evidence/audit domains need append-only semantics.

## Consequences

- More records and projection/reconciliation logic are required.
- Recommendations can expose reason codes and uncertainty.
- Policy changes do not erase learning history.
- Evidence retention/deletion must follow learner privacy policy.

