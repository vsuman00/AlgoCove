# Phase 12 hosted pilot readiness

Decision: **NOT READY — no real learner cohort admitted.** Recorded 2026-10-10. Phase entry approval permits implementation; it does not replace the named human readiness decision required by Task 57.

| Gate | Current evidence | Remaining requirement |
| --- | --- | --- |
| Architecture, unit, adversarial and retrieval checks | Local repository verification: 587 tests pass; merged foundation CI passed all three jobs | Merged-main CI passed; deployed lifecycle and bounded accessibility checks passed; full deployed matrix remains |
| Hosted web and database | Singapore Vercel Preview, Neon restricted runtime, TLS, pgvector and 40 migrations verified | Complete environment security review |
| Authentication and authorization | Real development sign-in/out, backend revocation, export/origin rejection and active-session role removal pass; unenrolled staff rejected | Positive privileged MFA remains provider-blocked; two-account privacy export isolation passes; other ownership, callback and stale-reverification checks remain |
| Release admission | Exact-SHA gate rejects failed, missing, skipped, pending and duplicate jobs; web/image workflows use it | Credential-bound merged-main Preview and dedicated alias reversal pass; all four image profiles are scanned/signed/verified; separate configuration/runtime promotion lineage remains |
| Runtime isolation and capacity | Local/Linux CI conformance and gVisor evidence | Isolated hosted execution, network isolation and six-language capacity measurements; execution remains disabled by owner choice |
| Background processing and privacy | Local worker/privacy implementation and drills | Supervised hosted workers, independently durable deletion ledger and hosted privacy recovery |
| Recovery | Neon snapshot restored into a separate branch; schema 0040, pgvector, restricted role and TLS checked | Historical PITR with known data markers, asset restore, deletion replay and application RPO/RTO |
| Curriculum rights and publication | Local engineering completed; staging published sheets empty | Independent current publication/rights approval |
| Accessibility, security, load and SLO | Local/CI suites and bounded hosted smoke | Four deployed pages pass automated WCAG and 320px checks; full matrix, manual accessibility, measured capacity and operating alerts remain |
| Operational and policy ownership | Local incident/support runbooks | Named hosted incident/support/privacy owners, hosted retention/minor policy and active pilot-stop procedure |
| Human readiness decision | No signed pilot approval recorded | Named owners sign a decision referencing the exact candidate and evidence |

The [plan](../../tasks/plan.md) requires: “Sandbox isolation, authorization, privacy, current content rights and hosted restore are non-waivable release gates.” Execution being disabled narrows today's synthetic staging capabilities; it does not satisfy these gates for the planned six-language pilot.

See [Phase 12 evidence](phases/phase12-evidence.md), [identity evidence](identity.md), and the [release procedure](../deployment/release.md). This document must remain NOT READY while a non-waivable gate or the named human decision is missing. Passing CI, a Vercel production target, or a working landing page is insufficient to admit learners.
