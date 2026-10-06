# Tutor delivery operations — Task 44

## Composition and availability

The application owns `AllowedTutorAction`, request/response/model configuration contracts and the `TutorRepository` port. `packages/tutor` implements policy, validation, a deterministic local generation fixture, a narrow approved transport adapter and the orchestration service. It imports no persistence, provider SDK or web delivery code. PostgreSQL and Next.js are adapters.

The normal web runtime composes the repository with **no generation or embedding adapter**. An authenticated learner can request durable authored fallback; core learning does not require a model or general worker. Setting `TUTOR_ENABLED=true` alone does not activate a provider. The server-owned `createTutorRuntime` composition supports explicitly supplied embedding/generation ports and pinned retrieval/curriculum versions. No browser or model can choose these ports/configurations. Live activation still requires the AI/privacy owner's provider/model/region/data-policy decisions in the [review findings](review-findings.md) and Task 45 evaluation/promotion. This task neither selects a vendor nor creates an account, deployment or approval.

`approvedGenerationAdapter` requires a provider, model, region, data policy and approval reference. A server-owned transport receives only the structured generation DTO and an abort signal; it receives no application tools, callbacks, repositories, credentials or progress commands. SDK/network translation belongs in that transport. Stable failure categories never retain the underlying provider body/error message. The approval-gated transport seam is tested with a local fixture, not live vendor traffic.

## Policy and private code

Admission rechecks active database learner access, an owned viable attempt/session, original published available content and current rights. The server derives mode, state, content version and hint ceiling before retrieval or generation. Requests cannot supply roles, scope, candidate text, source, language, ceiling or model configuration.

Generated answers are restricted to tier-one clarification, regardless of the requester's previously exposed tier. Higher-tier hint requests bypass retrieval/generation and use the exact authored unit. Guidance remains progressive; tier six requires a submitted attempt and mode permission. Generation receives selected evidence units at tier zero or one only. Current schema/citations, exact version/title/item bindings, policy/prompt/retrieval/model versions, output bounds and prohibited solution/tool patterns are checked on the entire candidate. Low-confidence evidence forces fallback. Pattern scanning is defense in depth and does not prove absence of semantic solution leakage; Task 45 remains the quality release gate.

Code is read only for `intent=debug` with explicit `shareCode=true`, and only if the configured provider permits it. The DTO contains at most 8,000 characters of the owned, unexpired, learner-saved source draft. The server pins draft ID and saved revision in the action; changed source invalidates completion and cached debug-answer serving. Unsaved/oversized/missing source or a restrictive data policy yields authored fallback. Code is not stored in tutor requests, evidence packages or default telemetry. The learner's bounded question is part of the confidential request. Ordinary clarification never reads or sends the source draft.

## Durable request protocol

`POST /api/tutor` accepts one of:

- `{action:"start",input:{attemptId,intent,query,requestedTier,shareCode,idempotencyKey}}`: validate/admit and return `pending` with no answer, or a safe budget fallback state.
- `{action:"complete",requestId}`: claim this owned request once, perform bounded optional work and return a persisted validated answer or authored fallback.
- `{action:"cancel",requestId}`: fence pending/running work and settle its budget.

`GET /api/tutor?requestId=…` returns only owned current state or a saved response. Every response is private and `no-store`. There is no raw token/candidate stream. Pending/running/cancelled payloads contain no response text. The panel shows status while completion runs, supports cancellation and retries the same idempotency key after network uncertainty. Account/language/restart changes remount the panel and discard stale UI delivery.

Requests are durable foreground operations, not detached background jobs: after the admission response, the client explicitly calls completion. A random claim fences duplicate completion. A cancelled or expired claim cannot write an answer even if its provider ignores cancellation and returns late. An ambiguous running request is never rerun against a provider; it may finish, be cancelled, or expire. This task adds no tutor topic to the general worker and performs no model call inside a database transaction.

The request expires after 15 seconds. Owned reads close expired requests; admission additionally recovers up to 20 expired owned requests before counting concurrency. Safe terminal state and budget settlement commit together. No raw candidate is persisted on failure. A missing fallback unit is represented as unavailable guidance, not an invented answer.

## Persistence and assistance

`0031_tutor_delivery.sql` adds private requests, immutable accepted response/model configuration snapshots and immutable conservative assistance records. Before commit, the repository rechecks current owned context and all evidence-source eligibility, including unselected candidates, and locks current source/configuration/curriculum rows. Responses bind exact evidence and generation configuration lineage. Response, assistance, an authored hint exposure when applicable, terminal request state and budget settlement commit atomically. Failed persistence leaves no partial answer/assistance.

The same owner/key/input returns its persisted receipt. A changed request conflicts; cross-owner reads/cancellation fail closed. Response reads recheck current content rights and enabled retrieval/model/curriculum configuration. Withdrawal prevents serving historical answers. Rows remain immutable historical records; later privacy deletion/legal-purge work is not implemented here.

Generated clarification records tier-one assistance without advancing the authored hint ladder. Authored fallback also records its actual hint exposure. Execution assessment, authored reasoning assessment and external-readiness assistance snapshots now include the conservative maximum across authored hints and tutor assistance. Provider output cannot manufacture correctness, mastery observations or progress projection mutations.

## Budgets and bounds

Task 51's existing transactional optional-operation ledger and circuit breaker are extended with `tutor_generation`: 20 requests/day, six/minute, one concurrent operation, three failed operations before cooldown, and a conservative 28,000 character-unit reservation per admitted request. Admission happens before provider work. Prompt/context is bounded to 16,000 characters and messages to 4,000; complete candidates are capped at 12,000 characters. The quota is a conservative local work bound, not a token price or measured vendor bill. Live token/cost limits require the model/data policy decision and provider-specific transport enforcement.

Generation is bounded to four seconds and receives cancellation; the executable embedding composition races a two-second deadline even when a port ignores its signal. Retrieval has Task 43's remaining SQL deadlines. Provider failure/refusal, malformed/injected output, citation/tier mismatch, insufficient evidence and context/privacy rejection all use an owned authored fallback. There is one generation attempt and no cross-provider retry or privacy-policy downgrade.

## Verification

Run `pnpm verify`, `pnpm test:integration`, a production build, standard E2E, execution-browser and accessibility suites. [tutor.test.ts](../../tests/integration/tutor.test.ts) includes actual PostgreSQL transactions and a Chromium network bridge to the real repository/retrieval/service. Only authentication and HTTP transport are controlled seams; fallback/validation/claim/cancellation/assistance/idempotency use real code and SQL. The browser checks pending, cancellation, fallback, rejected/locked-solution canary absence in client payloads and persisted-answer retry without another provider invocation. It is not live Clerk/vendor or production-load evidence.

[The shared retrieval fixture](../../tests/integration/support/retrieval-fixture.ts) creates and drops its own database and roles. Never point migrations or fixture provisioning at the retained learner database. [Phase 9 evidence](phase9-evidence.md) records final commands/counts and remaining approval gates.
