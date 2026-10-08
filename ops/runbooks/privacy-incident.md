# Privacy deletion backlog and recovery

Owner: privacy administrator. Severity: page for a pending/purging deletion older than 24 hours, or immediately for suspected disclosure.

Containment: retain `deletion_pending` account state and deny all new private work. Do not reactivate an account to clear a backlog. Preserve a minimal deletion receipt and external restore ledger; do not retain raw private payloads as incident evidence.

Recovery: verify the configured cancellation relay, outstanding run acknowledgements, hold reason/expiry and dedicated privacy-worker permissions. Run `pnpm privacy:consume`; failed cancellation keeps the job fenced until its lease expires and a retry claims it. Use `--retention` for bounded expired draft and seven-day technical telemetry cleanup. No provider call occurs inside a purge transaction. An authorized privacy administrator can place/release a bounded hold through `/api/admin/privacy` after recent identity verification; operations are audited.

Reconciliation: completion requires zero rows in the explicit owned-data inventory, no tutor responses/attempt pins/private delivery/audit payloads, an unlinked identity and an immutable deleted-account tombstone. Public curriculum attribution may retain an unlinked identifier. Track backups independently until actual expiry/destruction; a completed primary purge does not mean every backup is destroyed.

Restore safety: obtain the current deletion ledger separately from the backup, reapply it before serving traffic or workers, and verify the deleted sign-in subject cannot recreate an account. A backup alone is insufficient authority to reopen private accounts.

Communication: privacy administrator and incident owner determine recipient, impact and update cadence. This local implementation makes no legal notice or hosted retention claim.

The privacy CLI writes its separate minimal deletion ledger before purge; ledger fsync failure blocks deletion and remains retryable. Preserve the ledger outside the database backup and include requested deletions, not only completed ones, in restore reconciliation. Duplicate request entries are harmless and must not reopen an account.

The execution host acknowledges active cancellation only after confirmed teardown. A durable `host_teardown_failure` marker blocks acknowledgement across restarts. Keep the host quarantined and the account pending until the execution operator confirms resource teardown; restarting or clearing database leases alone is insufficient.
