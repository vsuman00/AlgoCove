# Phase 10 platform extension work cards

Authorization: owner instruction on 2026-10-07 to implement the remaining Phase 10 tasks using the updated architecture before Phase 11. This accepts the proposed platform direction and DESIGN section 29 for this implementation scope. Independent content publication signatures, live AI, Phase 11 and deployment remain separate. Preserve the existing uncommitted work; no commit, push or PR.

## Dependency-ordered bounded cards

| Card | Task | Exact implementation scope | Fixtures and acceptance |
| --- | --- | --- | --- |
| C1 | 45b | `docs/architecture/shared-learning-contract.md`, application catalog DTOs/validation, focused unit tests | Six query contracts, bounded filters, permissions, immutable pins, withdrawal, schema compatibility and rollback |
| C2 | 45c | Additive `0035_learning_catalog.sql`, DB catalog adapter, `problem-catalog.ts`, problem read/workspace routes and route page | Existing aliases plus distinct SQL-only fixture; draft/retired/expired/tombstoned/incomplete releases excluded; safe projections and existing attempt IDs preserved |
| C3 | 45c | Typed workspace panels/controller and existing content readers | Two unrelated published fixtures, owned drafts, language/session switch and stale-response recovery |
| C4 | 45d | Additive destination/collection mapping migration and domain/DB consumers | Same destination in two collections, ambiguous legacy links quarantined, journal IDs and ordinal preserved |
| C5 | 45e | Versioned walkthrough validation/replay, authored pilot adapters and renderer controls | All four patterns; backward scrub/step equivalence; malformed line IDs; hidden answers and schema compatibility |
| C6 | 45f | Existing shell/auth/profile routing and validated return context | J01–J04, E01–E04/E19; refresh/back/cancel, same-origin targets and mobile keyboard |
| C7 | 45g | Existing authoring preview/preflight and publication workflow | Exact asset pins, rejected invalid content, staff ownership, transactional publication and withdrawal |
| C8 | 50a | Learn/topic/lesson/sheet discovery using shared queries | Published counts/filters, partial and empty coverage, independent progress overlays |
| C9 | 50b | Shared planning adapter and existing deterministic validator | Exact supported versions, deduplication, capacity rejection, AI-off and plan history |
| C10 | 50c | Connected journey checks and coverage report | J01–J08/J11–J14/J18/J19 and applicable E IDs; browser verification with failures/recovery |

Record results per card before checking parent tasks. No parent completion follows from contract types or test doubles alone. Historical F10 local closure covers the original pilot, not these extensions.

## Current evidence

C1–C10 are complete for the owner-authorized local engineering scope. [Extension evidence](../../evidence/phases/phase10-platform-extension-evidence.md) records 507 core tests, 143 PostgreSQL tests, 62 browser and 32 accessibility checks plus three actual Linux/gVisor scenarios. [Journey coverage](../../evidence/phases/phase10-platform-extension-coverage.md) identifies fixture boundaries and deferred later features. Independent publication and persistent rollout remain separate.

## Completion run (owner instruction, 2026-10-07)

The owner explicitly requested all proposed Phase 10 extension tasks completed. Continue through C3–C10 without treating one card as the final deliverable. Exact additional files: `packages/content/src/learning-release.ts`, `packages/visualizer/src/walkthrough.ts`, `packages/db/migrations/0036_learning_releases.sql`, `packages/db/migrations/0037_destination_identity.sql`, `packages/db/src/learning-release-repository.ts`, `packages/db/src/destination-repository.ts`, catalog query/route extensions, `apps/web/src/components/learning/learning-discovery.tsx`, `learning-brief.tsx`, the direct-query lesson route, `workspace-stages.tsx`, and same-origin navigation helpers. Focused tests cover typed packet validation/replay, SQL publication/withdrawal/migration/ownership and browser discovery/return/recovery. Existing execution/provider boundaries stay in place.
