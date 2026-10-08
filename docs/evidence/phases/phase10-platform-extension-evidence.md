# Phase 10 platform extension evidence

2026-10-07. Tasks **45b–45g and 50a–50c are complete for the owner-authorized local engineering scope**, against ADRs 0019–0021 and DESIGN section 29. [Journey coverage](./phase10-platform-extension-coverage.md) maps J01–J19/E01–E19 to delivered evidence and explicit later-phase boundaries. Independent persistent-publication signatures, live-provider activation, hosted rollout and Phase 11 are separate.

## Delivered

| Task / cards | Implementation and acceptance |
| --- | --- |
| 45b / C1 | [Shared query, asset and interaction contracts](../../architecture/shared-learning-contract.md), bounded filters, public/private views, exact pins, compatibility and rollback |
| 45c / C2–C3 | SQL-backed canonical slugs/aliases, latest eligible published discovery, typed learning brief/lesson/checkpoints, persistent stage focus, owned exact-attempt resume and additive immutable release pins; original, four pilot and distinct disposable fixtures |
| 45d / C4 | Canonical platform/problem destinations separate from legacy source/collection enums; ambiguous URLs quarantined for independent reconciliation; IDs, source URLs, journal ownership, memberships and ordinal retained; canonical deduplication and private progress overlay |
| 45e / C5 | Validated schema-3 timeline and schema-2 pilot adapter; stable pseudocode line IDs, variables, narration and visual/text state; step/play/pause/speed/restart/scrub; legacy schema-1 renderer retains explicit container adapter; server records assistance before revealing references |
| 45f / C6 | Delivered shell routes, topics/lessons/sheets, validated same-origin authentication/onboarding continuation and cancellation, workspace return links; `/plan` and `/roadmap` retain one authority; mounted panels preserve drafts; best-effort unsaved-work unload warning |
| 45g / C7 | Staff-owned typed release editing, safe exact preview and preflight, lesson/prerequisite validation, six-tier hints, recall/transfer assets, exact asset/language pins; edits invalidate reviews and alter reviewer revision; existing independent technical/pedagogical/evaluator/publisher workflow publishes transactionally; withdrawal hides public projections and new commands |
| 50a / C8 | Learn/topic/lesson/curated-sheet discovery; bounded search/language/pagination, URL filter context, loading/no-match/unavailable/retry states; ordered membership occurrences separate from canonical identity; internal learning, optional media and reviewed external solve roles; private self-report/submitted-attempt overlays do not award mastery |
| 50b / C9 | Shared eligibility, exact content/problem versions, prerequisite graph and explicit estimate policy v1; canonical collection counts and deduplicated required units; deterministic AI-off planning, scoped capacity/coverage rejection, preview/accept/replan/history preserved |
| 50c / C10 | [Complete scoped journey/edge report](./phase10-platform-extension-coverage.md), connected Linux/gVisor verification and browser recovery/accessibility checks; later private/shared sheet/interview/privacy lifecycle features remain explicitly deferred |

Migrations **0035–0038** are additive. They register routes, retain exact historical attempt pins, store immutable atomic typed release packets/manifests, separate destinations from memberships and expose shared discovery/exercise availability. Published metadata is not rewritten. Typed lesson/approach/scenario artifacts live atomically inside an immutable release packet; version-qualified manifest roles identify each asset. Existing pilot bundles retain their import/review workflow. Unsupported new runtime adapters still require separate approved harness/conformance work; the distinct typed fixture is persistence/panel/publication-contract evidence, not activation of new execution-host curriculum.

## Verification

| Check | Result and scope |
| --- | --- |
| `pnpm verify` | Passed: formatting, ESLint, root/web/worker types, approved tokens, **507 tests / 83 files**, documentation links and secret checks |
| `pnpm test:integration` | **143 passed**, three Linux-only cases skipped on macOS; all **38 migrations**, checksums/idempotency/runtime privileges, disposable databases and roles |
| Focused pilot/extension PostgreSQL tests | **9 passed**, including four governed pilots, unrelated SQL route/alias, typed release publication, stale-review rejection, withdrawal, canonical reconciliation, ordered duplicate occurrences and cross-owner progress isolation; all 24 pilot/language workspaces retain their exact attempt pins and explicit resume ID |
| Production build | Passed with topics, lessons, sheets, authenticated return and staff preflight routes |
| Chromium end-to-end | **62 passed**: old journeys plus new discovery/filter/pagination/retry, typed workspace/stage draft preservation, curated memberships, auth cancellation, alias reload, four synchronized traces, six-language switching, roadmap preview/history and offline recovery |
| Browser accessibility | **32 passed**; additional axe assertions in the extension and four-pilot browser cases; keyboard, reduced motion, 320px and zoom coverage |
| Actual Linux/gVisor connected loop | **3 passed in 310.82s**; all **24 pilot/language journeys**, 93 report entries, real wrong-answer/pass/compile/limit results, reference/reasoning accounting, signed callbacks, cancellation/killed-host recovery/missing images. [New report](../artifacts/phase10-extension-linux-learning-loop-2026-10-07.json) preserves exact bundle checksums |

The Linux run used the existing isolated `algocove-phase10-assurance` VM, Node 22.22.0 and pinned pnpm 12.4.2. Synthetic authentication/reviewer actors stayed in disposable tests. Final URL-filter, accessible-label, loading-button and collection-projection refinements were additionally verified on macOS/browser; no broader Linux claim is inferred for those presentation refinements. Owned database services and VM were stopped after verification.

## Corrections and limits

Browser checks caught a language-filter update restoring a stale URL; one atomic query update now preserves filter context. Stage numbers are hidden from accessible button names. Reasoning actions wait for authenticated workspace bootstrap. Invalid slug syntax still returns a real 404; valid dynamic slugs use the published API's unavailable state instead of a fixed route allowlist. Missing walkthroughs/prerequisites/language pins fail preflight, unsafe fields/media/transcripts fail validation, and release edits cannot reuse stale reviewer revisions.

The local default pnpm 9 differed from the repository pin. Dependency/lockfile operations were restored to **pnpm 12.4.2**, retaining direct dependency pins and the required internal visualizer dependency. The pre-existing dirty lockfile was regenerated during that correction; no reset of user-owned changes, dependency upgrade, commit or push was performed.

Browser transport fixtures are not database-backed authentication proof or independent human publication signatures. The real Linux loop covers shipped pilot execution, while the new generic release and reconciliation workflows have actual PostgreSQL integration evidence. Manual screen-reader review remains outside the owner's browser-only scope. Private/shared sheets, interviews, account export/deletion, complete-course coverage, live AI and persistent rollout remain their separately planned work. At the engineering verification checkpoint, no persistent user/staging database had been migrated. The subsequent owner-approved [release preparation](./phase10-release-readiness.md) backs up and upgrades the persistent local database through 0038. No commit, push, PR, deployment or Phase 11 implementation has been performed.
