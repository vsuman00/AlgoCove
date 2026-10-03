# AlgoCove architecture

AlgoCove is a guided Data Structures and Algorithms mastery platform for students and job seekers learning through Python, JavaScript, TypeScript, Java, C++, or C. Its architectural purpose is to support a measurable learning loop: recommend the next useful activity, let the learner struggle productively, provide the smallest safe intervention, collect mastery evidence, and schedule a later retrieval check.

This document began as an architecture-only baseline. The owner subsequently authorized implementation through Phase 7. Current implemented behavior and validation are recorded in the [task ledger](tasks/todo.md) and [runtime repair evidence](docs/architecture/runtime-repair-evidence-2026-10-03.md); proposed architecture decisions remain distinct from implemented code.

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

## Original architecture gate and current status

`GATE A0 — PROPOSED, AWAITING HUMAN APPROVAL`

The gate above records the original proposal. Later phase authorization and the explicit gVisor security-owner approval do not automatically accept every earlier proposed decision. Implementation and measured test evidence now exist; cloud deployment and an unqualified production-readiness claim are not authorized.

Historical Phase 0 decisions and checkpoint G0 still need consolidated reconciliation against recorded owner decisions. See the current plan for implemented phases and separate open approvals.
