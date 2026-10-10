# Phase 12 hosted pilot readiness

Decision: **NOT READY — no real learner cohort admitted.** Recorded 2026-10-10. Phase entry approval permits implementation; it does not replace the named human readiness decision required by Task 57.

| Gate | Current evidence | Remaining requirement |
| --- | --- | --- |
| Architecture, unit, adversarial and retrieval checks | Follow-up code revision `16791c4` passes 613 core tests and all three CI jobs in run 38065210903 | Current protected Preview web smoke passes; full deployed matrix remains |
| Hosted web and database | Current Singapore Preview, Neon Free/restricted runtime/TLS/pgvector/schema and 11 JavaScript assets pass bounded checks; known server credentials absent from checked assets | Complete provider secret/network review; separately isolated execution and worker infrastructure |
| Authentication and authorization | Real development sign-in/out, backend revocation, export/origin rejection and active-session role removal pass; unenrolled staff rejected | Positive privileged MFA remains provider-blocked; two-account privacy export isolation passes; other ownership, callback and stale-reverification checks remain |
| Release admission | Exact-SHA web/image gates, signed complete runtime manifests, real A→B→A pointer reversal and tampered-signature/stale-command rejection pass. Isolated hosted synthetic AI configuration promotion/rollback and failed-review/privacy/production-fixture rejection pass | Running hosted-runtime telemetry/compatibility and approved real-cohort content/configuration remain; synthetic scores are not independent human approval |
| Runtime isolation and capacity | Local/Linux CI conformance and gVisor evidence | Isolated hosted execution, network isolation and six-language capacity measurements; execution remains disabled by owner choice |
| Background processing and privacy | Local worker/privacy implementation and drills | Supervised hosted workers, independently durable deletion ledger and hosted privacy recovery |
| Recovery | Neon snapshot restored into a separate branch; schema 0040, pgvector, restricted role and TLS checked | Historical PITR with known data markers, asset restore, deletion replay and application RPO/RTO |
| Curriculum rights and publication | Read-only staging operator inventory confirms zero content versions and zero current published-rights versions | Independently reviewed, rights-approved curriculum must actually be published before learner admission |
| Accessibility, security, load and SLO | Local/CI suites and bounded hosted smoke | Four deployed pages pass automated WCAG and 320px checks; full matrix, manual accessibility, measured capacity and operating alerts remain |
| Operational and policy ownership | Local incident/support runbooks | Named hosted incident/support/privacy owners, hosted retention/minor policy and active pilot-stop procedure |
| Human readiness decision | No signed pilot approval recorded | Named owners sign a decision referencing the exact candidate and evidence |

The [plan](../../tasks/plan.md) requires: “Sandbox isolation, authorization, privacy, current content rights and hosted restore are non-waivable release gates.” Execution being disabled narrows today's synthetic staging capabilities; it does not satisfy these gates for the planned six-language pilot.

See [Phase 12 evidence](phases/phase12-evidence.md), [identity evidence](identity.md), and the [release procedure](../deployment/release.md). This document must remain NOT READY while a non-waivable gate or the named human decision is missing. Passing CI, a Vercel production target, or a working landing page is insufficient to admit learners.
