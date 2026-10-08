# Frontend and backend verification through Phase 9

Date: 2026-10-06. Scope: accumulated Phase 8–9 implementation, associated UI repairs and the owner's requested frontend/backend verification. This record supplements [Phase 9 evidence](./phase9-evidence.md) and [Phase 8 evidence](./phase8-evidence.md). It does not close live provider approval or authorize Phase 10.

## Fixes and regression coverage

- Onboarding save failures now leave the form available for correction and retry. Safe validation messages are shown for rejected fields; connection failures use a generic recovery message. Two component tests and two Chromium journeys cover these cases.
- Visual screenshot inspection found cramped tutor controls. The question field now fills its container and action buttons wrap with spacing and a 44px minimum height. A mobile browser regression checks button spacing and size. Readiness operations reuse existing content form styling; a new accessibility journey checks load failure, retry, invalid JSON, successful command submission and 320px reflow.
- The full dependency audit discovered [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q). The workspace now pins transitive `source-map-js` to the patched 1.2.2 release. Production audit passes. The full audit passes its existing narrow exception for the unpatched development-only `braces` advisory; that exception was not expanded.
- A controlled mutation inverted the new evaluation configuration approval condition. The retrieval evaluation test rejecting live configurations without approval failed as expected. The original file was restored and its SHA-256 verified before final tests.

- Further component review reproduced a late cancellation response overwriting a newer tutor result. Both successful and failed cancellation responses are now fenced by the same request epoch as generation; two regression tests failed before the fix and pass after it.
- Initial GitHub quality CI reported 132 database tests passing and two browser-backed integration cases failing because Chromium was installed after integration. The workflow now installs Chromium before those tests and also runs the execution-result browser suite. A fresh CI run is required to verify this ordering.

## Coverage inventory

The checkout has 13 page components, 19 shared UI components and 31 API route handlers. The following maps their feature groups to current tests. Rendering and behavior are covered at different layers; this is a declared regression suite, not a claim of exhaustive coverage of every possible state or input.

| Pages / component group | Browser and component coverage |
| --- | --- |
| `/`, home experience, preview stage, shell, brand and icons | All-pages audit; comprehensive UI: algorithm stepping, reset, navigation, responsive layout, reduced motion, hydration and console errors |
| `/learn/[problemId]`, problem workspace, trace renderer/workspace, tutor and external readiness | Comprehensive UI and guided-problem accessibility; draft-sync, companion-journey and worker-offline E2E; six execution-browser cases; workspace/trace/readiness component tests; tutor PostgreSQL browser journey |
| `/onboarding` | Profile save/accessibility, rejected field and failed connection recovery in Chromium and component tests; onboarding accessibility |
| `/plan`, `/roadmap`, planning preferences and roadmap workspace | Preference save/reload/conflict/calendar accessibility; complete create/preview/accept/miss/pause/resume/replan/history journey; primary/fallback/outage proposal journeys and infeasible goals |
| `/review`, `/progress`, learning views | All-pages audit and Phase 6 accessibility: review confidence, explanation checks, recovery and learning signals |
| `/execution-readiness` | Runtime matrix browser audit and accessibility |
| `/admin/content`, `/admin/content/[id]`, content operations and staff navigation | Library/private workflow accessibility and browser audit; forbidden access, retry, disabled publication and mobile detail view |
| `/admin/readiness`, readiness content | Browser audit; load/retry, JSON errors, command submission and mobile accessibility |
| `/sign-in`, `/sign-up`, auth controls/links and Clerk status | Browser audit and mobile layout; auth configuration/route and session-sync component tests. Live hosted Clerk login is a separate boundary |
| Unknown route / 404 | Recovery browser audit |

| Backend group | Verification |
| --- | --- |
| Authentication, onboarding, content and private ownership | Actual route-handler tests; database lifecycle, authorization and publication integration tests |
| Practice drafts, execution, reasoning, hints, review, mastery and progress | Route tests; practice/Phase 6 integration; trusted execution-result browser tests; bounded Docker smoke/conformance/abuse fixtures |
| Planning, baseline validation, acceptance, quotas and optional proposal | Route/gateway tests; roadmap-provider SQL integration; adversarial validation; real proposal/policy code behind a controlled browser HTTP seam |
| External preparation/companion | Policy, route and component tests; Phase 6 SQL and connected browser scheduling/telemetry journeys |
| Worker, indexing and retrieval | Worker/content-indexing/retrieval integration; scoped roles, leases, replay, retirement, immutable evidence and permission filtering; labelled retrieval fixtures |
| Tutor, evaluation and promotion | Tutor and evaluation-promotion integration; privacy, cancellation, retries, quotas and rollback; adversarial and retrieval-evaluation projects |

## Final local results

- `pnpm verify`: **460 tests passed**; format, lint, application/web/worker types, tokens, docs and secret checks passed.
- Disposable PostgreSQL integration: **134 passed, two optional Linux-host cases skipped**; lifecycle verifies **33 migrations**. A dedicated cluster on port 54439 isolated verification from the existing repair database on port 54329.
- Production build: passed in `.next/publication-review`. Browser suites used that completed build without rebuilding during a run.
- Chromium standard E2E: **47 passed with four workers**. The previously recorded parallel reset instability did not reproduce in this run or the preceding 40-case parallel run.
- Execution-browser: **six passed**.
- Accessibility: **32 passed**; automated axe checks and mobile reflow/recovery scenarios.
- Four pinned execution image profiles built; smoke fixtures passed for all six supported languages.
- Language conformance: **36 correct-result and six mutation cases passed** across six languages and six fixtures.
- Sandbox abuse: **14 bounded terminal outcomes passed** on Docker Desktop's Linux VM, with residue checks. This does not substitute for the stronger Linux runtime gate.
- Pinned pnpm 12.4.2 frozen install, production dependency audit, full audit with its existing documented exception and Git whitespace checks passed.

Screenshots are generated under `test-results/browser-audit`; traces are retained on failure. These local generated artifacts are excluded from version control. The repository CI separately runs Linux execution and stronger runtime/real learning-loop gates after publication.

## Limits and publication scope

Browser tests combine actual UI with controlled identity/HTTP fixtures; selected integration journeys exercise actual SQL and application services through that seam. Live hosted identity, real provider model quality, independent live evaluation, regional/privacy approvals and production activation are not claimed. No new live provider was enabled. Tasks 41–45 are implemented locally; Task 45a's live activation gate remains pending as documented in the plan.

All scoped source, migrations, tests, dependency pin and evidence documents are included in the authorized publication. No retained learner database was migrated; the existing repair PostgreSQL server was preserved. GitHub publication and post-push CI status are reported separately from this local verification record.
