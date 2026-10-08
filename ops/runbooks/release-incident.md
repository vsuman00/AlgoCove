# Application release incident

Owner: release/platform operator. Severity: page for a release causing sustained request failures or private-data exposure.

Containment: stop the rollout and new optional admission. Keep affected accounts blocked. Freeze the current build ID, migration watermark and configuration version; do not reset the dirty checkout or rewrite published content.

Evidence: retain artifact identifiers, deployment timing, aggregate failures and safe trace correlation. Exclude secrets, raw code, learner answers and request bodies.

Recovery: select the independently retained previous immutable application artifact. Start it against the additive migrated schema and verify readiness, owned synthetic saved-work recovery and the prior learning route. If schema compatibility fails, stop writers and choose a forward fix or an isolated restore with current deletion-ledger replay. Content and AI rollbacks use their own governed versions; a runtime-image rollback must preserve the approved sandbox boundary.

Communication: the release owner reports affected capabilities, containment and next update time. Privacy and curriculum owners assess disclosure/evidence impact. Only the authorized release owner resumes a hosted rollout; this local runbook sends no messages or deployment commands automatically.

Demonstration: the [local receipt](../../docs/evidence/restore-drills/phase11-local-drill-2026-10-07.json) records distinct current/prior build IDs serving readiness and learning on the restored 0040 schema. This is local rollback compatibility evidence. Task 57 repeats the procedure against deployed staging infrastructure.
