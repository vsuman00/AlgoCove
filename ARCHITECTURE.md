# AlgoCove architecture

AlgoCove is a guided Data Structures and Algorithms mastery platform for students and job seekers learning through Python, JavaScript, TypeScript, Java, C++, or C. Its architectural purpose is to support a measurable learning loop: recommend the next useful activity, let the learner struggle productively, provide the smallest safe intervention, collect mastery evidence, and schedule a later retrieval check.

This is an architecture-only baseline. It is intentionally not an implementation plan and does not authorize product code.

## Architecture set

| Document | Purpose |
|---|---|
| [Architecture index](docs/architecture/README.md) | Status, scope, reading order, decision gates, and traceability |
| [System design](docs/architecture/system-design.md) | Product, domain, C4, component, runtime, deployment, and repository views |
| [Data and AI architecture](docs/architecture/data-and-ai-architecture.md) | Data ownership, ERD, content lifecycle, mastery evidence, retrieval, tutor, and evaluation |
| [Interfaces and runtime flows](docs/architecture/interfaces-and-runtime-flows.md) | Commands, queries, events, APIs, error contracts, idempotency, and sequence diagrams |
| [Security, reliability, and operations](docs/architecture/security-reliability-operations.md) | Trust boundaries, threat model, privacy, SLOs, resilience, observability, backups, and incident readiness |
| [Quality and traceability](docs/architecture/quality-and-traceability.md) | Quality scenarios, requirements traceability, standards, status matrix, and review checklist |
| [Decision records](docs/adr/README.md) | Proposed architecture decisions, alternatives, and consequences |
| [Implementation plan](tasks/plan.md) | Proposed dependency-ordered phases, task acceptance criteria, verification, risks, and handoff rules |
| [Task ledger](tasks/todo.md) | Proposed phase checkpoints and implementation checklist |
| [Implementation contracts](docs/architecture/implementation-contracts.md) | Edge cases, trusted judging, evidence, roadmap state/calendar and recovery contracts |
| [Architecture review](docs/architecture/review-findings.md) | Findings, corrections, requirement coverage and remaining validation gates |
| [Approved UI design](DESIGN.md) | Existing visual direction, tokens and screen references |

## Current architecture gate

`GATE A0 — PROPOSED, AWAITING HUMAN APPROVAL`

No choice in these documents is considered accepted until the owner reviews the open decisions in the architecture index. No implementation, cloud deployment, production-readiness claim, or measured performance claim exists yet.

The implementation plan is ready for review but does not authorize Phase 1. Phase 0 decisions and checkpoint G0 must be approved first.
