# Roadmap proposal gateway and Phase 9 activation

## Current state and authorization

Task 45a's provider-neutral adapter, HTTPS gateway boundary, promotion checks, budget accounting, opt-in UI and validator/persistence integration are implemented locally. The owner requested completion of Phase 9 and then accepted the recommended path on 2026-10-06: complete implementation and synthetic verification with production AI-off until a specific configuration is approved. This authorizes implementation and local verification, not an unnamed provider, processing region or private learner-data policy.

The [review findings](review-findings.md) require the AI/privacy owner's model/provider, region, context-policy, budget and validated-latency decision before live Task 45a. No named primary/fallback decision, approved gateway account, live synthetic-provider benchmark or corresponding human review has been supplied. Production activation is therefore pending. F9's technical checks can be verified locally; Phase 10 still requires the human owner's explicit authorization.

## Provider boundary

`PlanProposalPort` connects Task 37's workflow to `createRoadmapProposalAdapter`. The primary and fallback `RoadmapGenerationPort` share the provider-neutral gateway architecture. `approvedRoadmapGenerationAdapter` requires versioned provider/model, approval reference, region and data-policy metadata and refuses private code. It copies declared metadata fields only. Vendor SDKs, account credentials, regional routing and retention guarantees belong in the separately approved HTTPS gateway; no vendor or cloud account was selected by this implementation.

The request contains operation/prompt/policy/model versions, bounded horizon/date/capacity/study-day constraints, excluded dates and baseline item indices, kinds, dates, durations, frozen state and prerequisite indices. It excludes learner/session IDs, goal, target role, timezone, code, raw learning evidence/history, titles, links and collection names. Schedule constraints can still be personal data; the required privacy decision must approve this exact allowlist. The learner explicitly opts in through **Use optional AI sequencing**. AI-off remains the default.

Each gateway returns exactly `{items:[{index,day}]}`. Every existing item must appear once. The server reconstructs every target, version, language, title, URL, duration, prerequisite, reason code and frozen field from its own baseline. Non-review display due dates that originally copied the scheduled day are recomputed by the server; real catalog deadlines and review windows remain authoritative in `validateRoadmap`. Foreign or duplicate indices, omitted items, extra fields, oversized output and moved frozen items are rejected. No provider can accept a plan or mutate learning evidence.

## Validation, fallback and persistence

Primary output must pass reconstruction and deterministic capacity/prerequisite/catalog/date validation. Only then is it eligible for delivery. Rejected or timed-out primary output can use one separately configured fallback; both attempts remain inside Task 37's 1,500 ms proposal deadline, with a maximum 600 ms generation deadline each. An adapter ignoring abort is fenced by the race. Both providers failing yields the original baseline preview. Insufficient reviewed coverage rejects the requested scope before provider work. Changed preferences/catalogs are checked again by the existing SQL candidate save and learner-accept commands.

The active plan never changes during generation. `buildOwnedRoadmap` saves a candidate, while `commandOwnedRoadmap` separately requires explicit acceptance and the expected active-version token. Request receipts keep logical retries stable. Any unconfigured, unapproved, mismatched, rolled-back or failed optional path preserves the authored/AI-off workflow.

Task 51's `plan_proposal` policy is now version 2: 20 daily requests, six per minute, one concurrent operation and 56,000 reserved character units per request (two attempts, each at most 16,000 prompt plus 12,000 candidate characters). Daily reservation ceiling is 1,120,000 units. These are conservative reservations, not billed-token or currency estimates. Thirty-second abandoned plan reservations are settled as failures before new admission. This recovery does not release code-execution reservations. Real model-specific pricing and spend/latency approval are still needed for live activation.

Migration `0033_roadmap_generation_evidence.sql` stores immutable metadata only: bundle/model/provider/prompt/policy versions, validated/rejected outcome, latency and bounded character counts, with a configuration FK and canonical checksum. Raw provider replies, goals, source and learner identity are not stored in this table. Recording failure closes the optional path. Metadata is not a learning/mastery observation.

## Promotion-bound runtime

`createRoadmapOptional` composes server-owned ports and budgets. The production path resolves the current accepted Task 45 configuration, verifies immutable suite/run records and current human-review grants, and requires:

- the exact primary/fallback model-manifest checksum, including HTTPS route identities, in `generationVersion`;
- `roadmap.prompt.v1` and `roadmap.policy.v1`;
- `roadmap.catalog.v1` in both catalog retrieval/index pins;
- the currently reviewed curriculum version in `corpusVersion`;
- approved primary/fallback metadata and a nonfixture production configuration.

The configuration is checked before provider work and again before validated return. Rollback and revoked review grants disable previously composed ports. Every fixture channel selection is an explicit test composition; browser fields cannot select model/provider/gateway or channel. The HTTP route authenticates before body processing, accepts declared build fields only and returns no-store responses.

`getRoadmapOptional` requires all server settings and a matching production promotion. `ROADMAP_PROPOSAL_ENABLED=true` alone cannot activate a provider. The example environment leaves it false. Credentials remain server-only, outside model-manifest JSON, request DTOs, evidence and errors. HTTPS URLs reject embedded credentials, query/fragment secrets and redirects. Response streaming is buffered and capped at 12,000 characters/48,000 bytes; no partial provider text reaches the learner.

## Remaining concrete live activation decision

Before changing production settings, record and review all of the following:

| Decision | Required evidence |
| --- | --- |
| Primary and fallback | Named provider/model versions and approved HTTPS gateway routing |
| Regional/privacy controls | Processing region, retention/training settings and approved schedule-only context allowlist |
| Budget | Model-specific tokens/prices, request/spend ceilings and approved 1,500 ms validated-response target or a reviewed policy change |
| Evaluation | Declared roadmap suite/config/code versions, real provider runs on synthetic data, zero critical failures and measured billed usage/latency |
| Human review/promotion | Named independent reviewer, rubric/sample scores, accepted production decision and retained authored/off rollback target |
| Phase transition | Human owner explicitly authorizes Phase 10 |

The recommended operational order is to evaluate synthetic requests against the approved gateway first, then review/promote the immutable bundle, then opt in the production flag. A gateway transport test or fixture review score does not satisfy these live approvals. No credentials or retained learner database changes are required for local implementation verification.

## Verification

`pnpm test:adversarial` exercises all five horizons, primary/fallback/malformed/injected/foreign/duplicate/missing/over-capacity paths, real date changes, changed capacity/catalog availability, insufficient coverage, approval withdrawal and evidence failure. `pnpm test:web` covers HTTPS request bounds/error redaction and route opt-in/server ownership. `pnpm test:integration` verifies promotion-bound SQL composition, metadata persistence, separate acceptance, outage preservation, quota exhaustion, abandoned reservation recovery and rollback. `roadmap-provider.spec.ts` drives the real gateway/policy through a controlled browser HTTP seam for primary, fallback and outage previews; real SQL ownership/atomicity remains a separate integration boundary.

The [Phase 9 evidence](phase9-evidence.md) records current commands, counts and approval limitations. Fixtures are synthetic/original and exist only in disposable databases; no real vendor quality, billing, regional controls or private learner processing has been claimed.
