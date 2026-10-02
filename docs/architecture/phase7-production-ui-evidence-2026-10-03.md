# Phase 1–7 real product and spatial UI evidence

**Date:** 2026-10-03. **Scope:** Owner-authorized local implementation through Phase 7, production-quality learner interface, real persisted content operations, commit and GitHub push. No live deployment. Age/country gating, privacy-policy implementation, later phases and full-course authoring are outside this change.

## Implemented

- Home loads actual next actions and separate progress signals. Empty, signed-out and unavailable states provide genuine recovery paths without fabricated activity or completion. Staff navigation follows server-owned roles; commands authorize independently.
- Guided practice uses a focused shell, shared controls, six-language editor, structured reasoning, private recovery, progressive hints and actual trusted execution categories. Account-service failures are distinct from signed-out state and can be retried.
- Trace cubes have real front/top/side faces, rotation and tilt controls, a flat equivalent, keyboard stepping, transcript and reduced-motion support. The deterministic replay state supplies every displayed value/pointer; camera interactions never change evidence. See [ADR-0018](../adr/0018-production-spatial-trace-presentation.md).
- Plans display actual capacity, schedule history, prerequisites and lifecycle controls. Review, profile and progress retain their real persisted contracts and accessible failure/empty/loading states. Learner pages no longer contain repository showcase, endpoint instructions or test-gate copy.
- Content operations now use authenticated PostgreSQL list/detail and create/manifest/review/validate/publish/retire commands. Optimistic revisions include the manifest. Author/reviewer/publisher separation, permission checks, idempotency, audit/outbox atomicity and immutable publication are enforced. Manifest edits require fresh reviews/validation. Rights withdrawals remove statement payloads; receipts contain metadata only.
- Migration 0025 permits only bounded terminal retirement of published content while preserving every other immutable field. The UI describes metadata validation accurately; it does not assert that new semantic metadata provides a compiled executable problem bundle.
- Release identity composition requires configured PostgreSQL. In-memory identities and legacy content fixtures exist only as explicit test helpers. No production route falls back to a fixture identity/content library.
- Instrument Sans, Fraunces and JetBrains Mono are self-hosted licensed Latin WOFF2 assets with source/checksum/license manifests. Canonical light/dark SVG and favicon assets are included.

## Verification

| Gate | Result / boundary |
|---|---|
| Repository verification | PASS: 238 unit/component/architecture tests; formatting, ESLint, root/web/worker TypeScript, tokens, Markdown links/fences and secret scan |
| PostgreSQL integration | PASS: 62 tests, including 7 real content-operation tests; all 25 migrations apply. Two Linux execution journeys are excluded from the macOS run and required in a separate Linux CI job |
| Production build | PASS, with real content API and existing learning routes |
| Chromium accessibility | PASS: 30 checks, including keyboard trace/camera controls, reduced motion and doubled page scale. API fixtures are explicit test seams, not live identity evidence |
| Roadmap/offline E2E | PASS: 3 journeys |
| Execution browser categories | PASS: 5 route-response fixtures, distinct from actual sandbox execution |
| Responsive engineering inspection | Seven routes at 320, 768, 1024 and 1440 pixels (28 samples), self-hosted font loaded, no page overflow/browser errors. [Screenshot manifest](../design-reviews/phase7-2026-10-03/manifest.json) |
| Dependency audit | No known vulnerabilities in the local audit; final Linux gate also audits dependencies |
| Six-language real execution | Mandatory disposable Linux CI harness added; fresh run outcome recorded after GitHub execution |

Content tests include forged roles, author/reviewer separation, optimistic conflicts, malformed/oversized input, idempotency and receipt privacy, missing languages, approval invalidation, publication immutability and terminal rights retirement. Existing Phase 1–7 tests cover ownership, hint ceilings, readiness, signed results/replay, no infrastructure-failure credit, planning capacity/prerequisites, immutable accepted plans and adherence corrections.

The Linux harness builds immutable six-language execution images, seeds reviewed local content in an owned database, runs production-built UI against actual route handlers/repositories, starts runsc with signed callbacks, and verifies wrong answers, invalid source, timeouts, correct Run/Submit, reasoning/trace/hints, reload recovery, cancellation, host-crash recovery and missing images. Authentication uses a fixture actor; live Clerk browser/provider integration is not claimed. Fresh learners keep actual Phase 7 budgets enabled. Cleanup drops owned databases/roles, stops the owned server/host and removes keys/journals; GitHub runners are disposable and PostgreSQL is explicitly torn down.

## Scope and visual approval

The reviewed content currently includes the bounded arrays/two-pointer bundle. A full DSA catalog is not claimed. This change implements production application paths rather than synthetic learner/content data; deployment configuration and release approval remain separate.

Screenshots are engineering review evidence, not an invented owner-approved reference baseline. Comprehensive manual assistive-technology review, the remaining coastal illustration and later-page reference assets are not certified by automated browser gates. Historical reports preserve their original evidence; this record updates the current implementation without rewriting their past results.

## Final run and resource cleanup

Pending completion of final browser gates and fresh GitHub CI. The temporary local PostgreSQL cluster and test-only installations will be removed after testing. No VM or live deployment was created for this change.
