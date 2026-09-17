# ADR-0003: Use Next.js as the application backend and defer the worker

## Status

Proposed
## Date

2026-09-17

## Context

AlgoCove needs server-rendered UI, authenticated mutations, JSON/streaming endpoints, database access, and provider integration. A separate API service would duplicate types, authentication, deployment, and observability before another client or independent scale exists. Long-running ingestion/evaluation is unsuitable for request execution.

## Decision

Use a Next.js TypeScript application for UI delivery and synchronous application services. Use Server Actions for authenticated web mutations and Route Handlers for APIs, streaming, health, and integrations. Introduce a separate Node worker only when durable asynchronous jobs exist or request-runtime limits are exceeded.

## Alternatives considered

- **Separate NestJS/Express API immediately:** rejected until public/multi-client contracts or independent deployment are required.
- **All background work in request handlers:** rejected because timeouts and contention would harm interactive flows.
- **Python AI backend:** deferred; current AI work is external-provider orchestration rather than Python-only model computation. A Python service remains possible if later self-hosted ML creates a real runtime need.

## Consequences

- TypeScript covers the core web/domain application; learner-language compilers and runtimes remain confined to the separately governed execution plane defined by ADR-0011.
- Domain packages must not depend on Next.js so extraction remains possible.
- Hosting must support the selected streaming/runtime behavior.
- Worker contracts and outbox semantics exist before the worker is deployed.
