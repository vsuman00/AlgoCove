# AlgoCove architecture decision records

Active records are `Proposed` unless individually accepted; ADR-0004 is superseded. ADR-0008 was accepted by the owner on 2026-10-02 to authorize Phase 6’s evidence-ledger architecture. Approval changes status in the record; rejected or superseded records remain in history.

| ADR | Decision | Status |
|---|---|---|
| [ADR-0001](0001-modular-monolith-first.md) | Modular monolith first, extraction by measured trigger | Proposed |
| [ADR-0002](0002-postgresql-pgvector-hybrid-retrieval.md) | PostgreSQL + pgvector hybrid retrieval; Chroma deferred | Proposed |
| [ADR-0003](0003-nextjs-application-and-deferred-worker.md) | Next.js application backend with deferred Node worker | Proposed |
| [ADR-0004](0004-browser-worker-javascript-execution.md) | Browser-worker JavaScript execution only in first release | Superseded before acceptance by ADR-0011 |
| [ADR-0005](0005-versioned-governed-content.md) | Immutable, governed, versioned learning content | Proposed |
| [ADR-0006](0006-grounded-provider-neutral-tutor.md) | Provider-neutral, evidence-grounded tutor with deterministic policy | Proposed |
| [ADR-0007](0007-active-2d-visualization-trace-protocol.md) | Active 2D visualization with renderer-neutral trace protocol | Proposed |
| [ADR-0008](0008-evidence-ledger-for-mastery.md) | Append-only evidence ledger and replaceable mastery projection | Accepted |
| [ADR-0009](0009-transactional-outbox-for-async-work.md) | Transactional outbox and idempotent asynchronous consumers | Proposed |
| [ADR-0010](0010-deployment-neutral-single-region-first.md) | Deployment-neutral design and single-region first hosted stage | Proposed |
| [ADR-0011](0011-isolated-multilanguage-code-execution.md) | Isolated server-side execution for six first-class languages | Proposed |
| [ADR-0012](0012-outbound-external-practice-handoff.md) | Outbound-only handoff to external practice providers | Proposed |
| [ADR-0013](0013-configurable-timeboxed-roadmap-planning.md) | Configurable timeboxed plans with AI proposals and deterministic validation | Accepted for local Phase 7 |
| [ADR-0014](0014-validate-before-display-and-trust-evidence.md) | Validate tutor content before display; trusted judging and evidence provenance | Proposed |
| [ADR-0018](0018-production-spatial-trace-presentation.md) | Spatial trace presentation with equivalent flat and textual operation | Accepted for local Phase 1–7 |
| [ADR-0019](0019-published-learning-releases.md) | Published learning releases | Accepted; local implementation complete, independent publication pending |
| [ADR-0020](0020-destination-and-collection-identity.md) | Separate practice destinations and collections | Accepted; local implementation complete, independent publication pending |
| [ADR-0021](0021-synchronized-algorithm-walkthroughs.md) | Synchronized algorithm walkthroughs | Accepted; local implementation complete, independent publication pending |
| [ADR-0022](0022-dsa-interview-session-boundary.md) | DSA interview session boundary | Proposed |
| [ADR-0023](0023-learner-owned-sheets-and-sharing.md) | Learner-owned sheets and explicit sharing | Proposed |
| [ADR-0024](0024-typed-interview-modes.md) | Typed interview modes with separate assessment rules | Proposed |

## Lifecycle

`Proposed -> Accepted -> Superseded or Deprecated`

An expensive-to-reverse change requires a new ADR that links to the record it changes. Do not rewrite historical reasoning after implementation begins.
