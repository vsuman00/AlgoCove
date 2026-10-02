# Real Phase 1–7 product and production 3D UI completion

**Direction:** Owner narrowed scope on 2026-10-03 to real implementation through Phase 7, clean production-quality learner GUI and production 3D UI. No deployment, age/country restrictions, privacy-policy work, later-phase implementation or full-course authoring in this task.

Preserve existing authentication, authorization, source privacy, execution isolation and deterministic evidence/planning contracts. Test fixtures remain useful in tests; release application routes must not substitute fixtures for persisted user/content state.

## Ordered work

- [x] U1: Replace learner Home's repository showcase with actual next action, plan/review context and separated learning signals; clean learner/staff navigation.
- [x] U2: Implement production visual foundation, canonical logo assets, licensed self-hosted typography and shared responsive component states.
- [x] U3: Render actual reviewed/learner trace state in an interactive 3D stage with equivalent keyboard/text/reduced-motion behavior; never fabricate trace events.
- [x] U4: Compose the full guided workspace, real planner and review/progress/onboarding screens with consistent light/deep-ocean shells and finished states.
- [x] U5: Replace fixture-only content administration paths with authenticated governed PostgreSQL reads/writes and real lifecycle state.
- [ ] U6: Run current-head real six-language execution journeys with actual routes/database/signed callbacks, plus all Phase 1–7 regression gates; clean temporary resources.
- [x] U7: Inspect desktop/mobile states, fix layout/interaction issues, record screenshot evidence and review outstanding visual asset approvals.
- [ ] U8: Update source/evidence/task records, commit and push; preserve accurate validated/open distinctions.

## UI acceptance

- Useful next actions and real data, no engineering task/command/demo/test narratives in learner pages.
- Loading, empty, signed-out, invalid, submitting, unavailable, stale/conflict, success, offline and retry states are implemented where relevant.
- Actual plan capacity, prerequisite/history and evidence provenance remain visible; no hardcoded course completion or mastery values.
- 3D rendering follows the deterministic trace contract. Text and accessible 2D views remain equivalent; interaction stays usable at narrow widths and with reduced motion.
- Functional destinations only; privileged commands enforce authorization independently of navigation.
- Shared typography/assets/tokens and controls follow DESIGN.md.
- Browser, database and execution evidence are labelled by actual environment; no hosted-ready or full-course claims.

The owner's explicit production 3D request supersedes ADR-0007's proposed 2D-first presentation choice for this local UI work. Renderer-neutral trace semantics and security/evidence boundaries remain unchanged. Resolve renderer details with measured performance and accessibility evidence.

## Current verification

Local gates pass: 238 unit/component/architecture tests, 62 PostgreSQL integration tests, production build, 30 accessibility checks, 3 roadmap/offline journeys and 5 execution-category browser checks. Twenty-eight responsive route samples pass. Fresh mandatory Linux real-host CI and final resource cleanup remain in U6; commit/push and CI evidence reconciliation remain in U8. See [implementation evidence](../docs/architecture/phase7-production-ui-evidence-2026-10-03.md).
