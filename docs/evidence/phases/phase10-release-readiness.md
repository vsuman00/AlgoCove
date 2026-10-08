# Phase 10 release readiness and Phase 11 preparation

2026-10-07. The owner approved completion of the remaining tasks and preparation for Phase 11: “I approved, go to complete these task and ready for the next phase 11”. Owner authorization is recorded; actual independent publication decisions remain required by the approved architecture and database guards.

## Completed release preparation

- Phase 10 implementation and local verification remain complete; see [extension evidence](./phase10-platform-extension-evidence.md) and [journey coverage](./phase10-platform-extension-coverage.md).
- Recreated the failed Docker container while retaining the existing `algocove_algocove-db-data` persistent volume. This is the configured local `algocove` database, not a disposable test database.
- Created a private, custom-format pre-migration backup at `.tmp/learner-data-backups/algocove-before-phase10-release-2026-10-07.dump`. Its SHA-256 is recorded in the [database readiness receipt](../artifacts/phase10-persistent-release-readiness-2026-10-07.json). No learner data or environment secrets are included in that public receipt.
- The initial migration attempt encountered missing later-phase schemas and rolled back. Normal role/schema bootstrap resolved that prerequisite. Applied migrations 0018–0038 as `algocove_admin`; retained and verified the original 17 migration checksums. Replay applied zero migrations.
- Corrected ignored local environment files to use `algocove_admin` for migrations and `algocove_app` for application requests, retaining the operator connection. Private copies of the previous files accompany the backup.
- Verified health watermark 0038 / 38 migrations, all five existing learner records, a non-superuser runtime without role/database creation privileges, and denial of runtime table creation in a rolled-back transaction.
- Verified both pilot and typed-learning-release publication triggers remain enabled. No staff grants, authored packets, reviews or publication receipts were fabricated.

The persistent database is left running for the real staff workflow. No commit, push, PR, remote CI run, worker, Linux VM, hosted deployment or live AI activation was started.

## Remaining publication dependency

The persistent database contains one authenticated learner and only unauthenticated seeded author/reviewer/evaluator accounts; there is no publisher. It contains zero imported pilot bundles and zero pilot review records. These facts prevent actual independent publication. Owner approval supplies the owner decision, not the missing staff identities or their review decisions.

The owner has been asked to identify the actual author, technical reviewer, pedagogical reviewer and publisher accounts. The two reviewers must be distinct from the author and each other; publication requires a separate publisher. Their active grants and reviews must be recorded through the governed workflow. Seeded identities must not be promoted as human reviewers.

Use the [publication runbook](./phase10-evidence.md#concrete-publication-and-manual-review-runbook) for import, exact-checksum six-kind and standard reviews, language/exercise publication, publisher validation, external mappings, derivation and connected persistent learner qualification. Match the four bundle hashes in the [review record](./phase10-review-record.md#reviewed-bundle-identities). Editing a packet invalidates existing review evidence. The gate remains open until audited persistent publication and qualification receipts exist.

Manual screen-reader review remains outside the owner's browser-only scope; remote CI remains deferred under the keep-local instruction. Neither is claimed complete.

## Phase 11 handoff

Tasks 52–54 remain unimplemented: privacy export/deletion/retention, telemetry/SLOs/alerts, and restore/rollback/incident rehearsal. The code, local engineering evidence and persistent schema are prepared for that work. Owner preparation authorization is recorded in both planning ledgers. Independent publication completion remains explicit; this record does not certify all release gates as passed.

For an unsuccessful local rollout, stop application writers and preserve a post-failure backup before restoring the pre-migration dump into a separately named database. Verify the restored migration watermark and learner data before switching configuration. Do not down-migrate immutable published records or overwrite the current persistent volume. The backup exists, but a completed restore rehearsal is not claimed here; Task 54 owns that evidence.

## Subsequent Phase 11 instruction

The owner subsequently set this publication task aside and authorized full Phase 11 implementation. The pending staff question is no longer the active task and does not block that authorized local work. [Phase 11 evidence](./phase11-evidence.md) records completed local assurance and migration 0040; this historical readiness receipt remains a record of the 0038 preparation. Independent publication is still pending, not silently approved.
