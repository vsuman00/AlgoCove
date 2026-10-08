# Local restore and rollback rehearsal

`pnpm ops:restore-drill` uses the local compose PostgreSQL reference stack at port 54329. It creates uniquely named databases/roles with synthetic identities and seeded original content. It never restores over the persistent `algocove` database, starts a hosted service or uses real learner data.

Before the next build replaces the baseline, retain the previous production artifact under the ignored `.tmp/phase11-drills/baseline-web/`: copy its `package.json` and `.next` without cache, and link its `node_modules` to the existing web dependencies. Build the current application with the repository-pinned pnpm. Port 3107 must be unused. The initial Phase 11 baseline was retained before rebuilding.

The drill creates a PostgreSQL custom dump and immutable asset hash manifest, records an actual post-snapshot synthetic write, restores into a separate database under its own migration role, repairs runtime grants and explicitly revokes public purge-function execution. It verifies saved work, attempt pins, index lineage, outbox reconciliation and deletion-ledger replay before serving restored traffic. It then demonstrates content withdrawal rollback, fixture AI rollback to authored-off, a prior Docker image digest smoke and both current/prior production application artifacts on the restored additive schema.

The receipt reports measured snapshot duration, one deliberately lost post-snapshot synthetic write, and restore-to-database-journey elapsed time. These are local measurements, not hosted RPO/RTO targets or PITR assurance. The cancellation game day uses an unavailable dependency and controlled recovery adapter; no synthetic source is dispatched. Task 57 must repeat deployed staging restore/PITR and incident qualification.

The `finally` cleanup stops owned web processes, drops only the generated databases/roles and removes the synthetic dump, copied assets and deletion ledger. It emits a payload-free evidence receipt. The retained baseline application artifact can be removed after the drill; it contains application build files, not a restored learner database. Database backups, environment copies and artifacts from other tasks must be preserved.

The worker's actual file-ledger adapter is used in this rehearsal and fsynced before purge. Both application artifacts run through `next start` with `NODE_ENV=test`, loopback origin and disabled hosted identity/execution/provider; this avoids mistaking a local reference drill for hosted TLS/authentication assurance. Production configuration checks remain unchanged.
