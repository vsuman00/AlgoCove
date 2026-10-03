# Real Phase 1–7 product and production 3D UI completion

**Latest audit (2026-10-03):** The owner requested a full error report before implementation continues. [GUI/frontend/backend/CI diagnosis](../docs/architecture/runtime-error-audit-2026-10-03.md) records reproduced recovery defects, the callback configuration failure and unvalidated paths. U4 is reopened for those recovery defects; U6 and U8 remain open. No implementation fixes were made during the diagnostic audit. The owner subsequently authorized repairs; see the implementation follow-up in that report for current fixes and outstanding validation.

**Direction:** Owner narrowed scope on 2026-10-03 to real implementation through Phase 7, clean production-quality learner GUI and production 3D UI. No deployment, age/country restrictions, privacy-policy work, later-phase implementation or full-course authoring in this task.

Preserve existing authentication, authorization, source privacy, execution isolation and deterministic evidence/planning contracts. Test fixtures remain useful in tests; release application routes must not substitute fixtures for persisted user/content state.

## Ordered work

- [x] U1: Replace learner Home's repository showcase with actual next action, plan/review context and separated learning signals; clean learner/staff navigation.
- [x] U2: Implement production visual foundation, canonical logo assets, licensed self-hosted typography and shared responsive component states.
- [x] U3: Render actual reviewed/learner trace state in an interactive 3D stage with equivalent keyboard/text/reduced-motion behavior; never fabricate trace events.
- [ ] U4: Finish the implemented workspace/planner/review/progress/onboarding screens, including audited language recovery, initial server synchronization failure and contextual signed-out recovery states (E3, E4, E8).
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

Current CI confirms 239 unit/component/architecture tests, 62 PostgreSQL integration tests, production build, 30 accessibility checks and 3 roadmap/offline journeys pass. The quality job skips the two real-host tests; both fail in the mandatory Linux job because callback configuration rejects an empty admin URL. The current runtime spike is skipped. Five execution-category browser fixtures and 28 responsive samples have prior local evidence; this audit adds 22 actual development-route samples. These checks do not certify actual signed-in persistence or a completed six-language journey. U6 and U8 remain open. See [current error report](../docs/architecture/runtime-error-audit-2026-10-03.md) and [implementation evidence](../docs/architecture/phase7-production-ui-evidence-2026-10-03.md).
