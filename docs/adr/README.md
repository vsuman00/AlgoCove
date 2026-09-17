# AlgoCove architecture decision records

Active records are currently `Proposed`; ADR-0004 is superseded. Approval changes status in the record; rejected or superseded records remain in history.

| ADR | Decision | Status |
|---|---|---|
| [ADR-0001](0001-modular-monolith-first.md) | Modular monolith first, extraction by measured trigger | Proposed |
| [ADR-0002](0002-postgresql-pgvector-hybrid-retrieval.md) | PostgreSQL + pgvector hybrid retrieval; Chroma deferred | Proposed |
| [ADR-0003](0003-nextjs-application-and-deferred-worker.md) | Next.js application backend with deferred Node worker | Proposed |
| [ADR-0004](0004-browser-worker-javascript-execution.md) | Browser-worker JavaScript execution only in first release | Superseded before acceptance by ADR-0011 |
| [ADR-0005](0005-versioned-governed-content.md) | Immutable, governed, versioned learning content | Proposed |
| [ADR-0006](0006-grounded-provider-neutral-tutor.md) | Provider-neutral, evidence-grounded tutor with deterministic policy | Proposed |
| [ADR-0007](0007-active-2d-visualization-trace-protocol.md) | Active 2D visualization with renderer-neutral trace protocol | Proposed |
| [ADR-0008](0008-evidence-ledger-for-mastery.md) | Append-only evidence ledger and replaceable mastery projection | Proposed |
| [ADR-0009](0009-transactional-outbox-for-async-work.md) | Transactional outbox and idempotent asynchronous consumers | Proposed |
| [ADR-0010](0010-deployment-neutral-single-region-first.md) | Deployment-neutral design and single-region first hosted stage | Proposed |
| [ADR-0011](0011-isolated-multilanguage-code-execution.md) | Isolated server-side execution for six first-class languages | Proposed |
| [ADR-0012](0012-outbound-external-practice-handoff.md) | Outbound-only handoff to external practice providers | Proposed |
| [ADR-0013](0013-configurable-timeboxed-roadmap-planning.md) | Configurable timeboxed plans with AI proposals and deterministic validation | Proposed |
| [ADR-0014](0014-validate-before-display-and-trust-evidence.md) | Validate tutor content before display; trusted judging and evidence provenance | Proposed |

## Lifecycle

`Proposed -> Accepted -> Superseded or Deprecated`

An expensive-to-reverse change requires a new ADR that links to the record it changes. Do not rewrite historical reasoning after implementation begins.
