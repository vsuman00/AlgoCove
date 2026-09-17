# ADR-0001: Use a modular monolith before service extraction

## Status

Proposed
## Date

2026-09-17

## Context

AlgoCove has multiple business capabilities but begins as one product, one browser client, one database, and a small team. Microservices would add network failure, duplicated authentication, distributed tracing, contract deployment, and data-consistency work before traffic or team boundaries are known.

## Decision

Build one deployable web application whose internal bounded contexts have explicit dependency rules. Extract a process/service only after a measured independent-scaling, isolation, failure-containment, runtime, client-contract, or team-ownership need exists. Hostile multi-language code execution already meets the security/runtime-isolation criterion and is therefore a separate execution plane from its first hosted use. The next likely extraction is an asynchronous content/evaluation worker.

## Alternatives considered

- **Microservices from the start:** rejected because operational and consistency costs do not solve a current constraint.
- **Unstructured monolith:** rejected because direct cross-module access would make later change unsafe.
- **Serverless functions per feature:** rejected as the primary architecture because function boundaries do not automatically create domain ownership and complicate long-running work.

## Consequences

- Local development and transactions remain simple.
- Architecture tests must enforce module boundaries.
- Core product modules may scale only with the application until extracted; the execution plane scales and deploys independently by design.
- Extraction requires explicit contracts and data ownership, which this architecture establishes in advance.
