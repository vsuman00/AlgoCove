# Worker operations

## Scope and credentials

Task 41 extends the existing PostgreSQL outbox. The standalone consumer runs bounded reconciliation jobs and, when explicitly enabled, existing draft-expiry cleanup. Content derivation, embedding and evaluation adapters require their owning modules to supply consumers; the standalone command leaves those topics pending until that implementation is configured. Task 42 owns actual content indexing. No deployment or live provider is activated by these commands.

Use server-side secret configuration, never command-line connection strings:

- `WORKER_DATABASE_URL`: dedicated maintenance-worker login used by `consume`.
- `WORKER_OPERATIONS_DATABASE_URL`: controlled operations connection used by inspection, maintenance admission and replay. The supplied actor must also hold current, unrevoked database role grants.
- `DATABASE_ADMIN_URL`: provisioning/migration credential, never the running worker credential.

Apply approved migrations, including `0028_worker_effects.sql` and `0029_content_indexes.sql`, before provisioning. `pnpm db:worker-role` reads the administrator and worker URLs and creates a **new** dedicated role. It refuses to widen an existing role. Its grants permit outbox delivery, immutable effect receipts, expectation state changes, canonical publication/checksum metadata and deletion of expired drafts. It cannot read learner source, saved draft text, authored problem statements or role grants, or create application tables. Future module consumers need separately reviewed grants for their own data access.

## Bounded commands

The following identifiers are examples; use a real server-owned operator actor and inspected event identity.

```sh
pnpm worker --help
pnpm worker inspect usr_0000000000000001 100
pnpm worker enqueue usr_0000000000000001 reconcile 100
pnpm worker consume 100
pnpm worker replay usr_0000000000000001 evt_0000000000000001 5 "dependency restored"
```

Inspection and reconciliation admission require the `operator` grant. Inspection reports topic backlog, oldest age, expired claims, dead-letter reason/attempt metadata, derivation states and published content lacking registered expectations. It excludes source text and job payloads. Enqueue and replay append safe audit events in the same transaction as their queue changes.

`consume` processes at most 1–1000 events per invocation and stops on idle. A scheduler may repeat bounded invocations; no always-on hosting configuration is supplied here. SIGINT/SIGTERM stops new claims after the current bounded operation. Database effect transactions have a two-second statement deadline. Module-owned provider work must run outside these transactions with its own deadlines and idempotent final commit.

## Replay and reconciliation

Inspect a dead letter first. Repair its dependency, then replay the exact inspected lifetime attempt count with a safe reason of 8–160 characters. Replay checks current grants and event state and rejects a stale count. It preserves event identity and payload, records the previous reason and attempts, and starts a fresh bounded retry budget. Lifetime attempts remain monotonic to fence stale claims. Invalid descriptors cannot be replayed unchanged; the owning module must admit a valid replacement event rather than editing the original payload. Do not automatically replay all poison events.

Reconciliation releases expired claims and repairs acknowledged derivation deliveries only when their expectation remains pending and no effect receipt exists. It preserves the logical event identity. Retired, unavailable, expired-rights or checksum-mismatched content becomes obsolete. Missing consumers, pending derivations and missing registrations remain visible; transport delivery does not mark an index ready. Task 42 must reconcile its actual derived artifacts and readiness.

Effect receipts and database effects commit atomically. A crash after commit but before acknowledgement causes delivery again; the receipt prevents repeating the committed database effect. A crash before commit rolls back both. The claim's lifetime attempt and lease fence every receipt, acknowledgement, retry and dead-letter transition.

## Existing draft expiry

Retention is disabled by default. A privacy administrator may enqueue existing expiry cleanup, and an operator must explicitly enable its consumer:

```sh
pnpm worker enqueue usr_0000000000000001 retention 100
WORKER_RETENTION_ENABLED=true pnpm worker consume 100
```

This removes only drafts and saved revisions whose existing expiry timestamp has passed. It introduces no new retention policy and performs no account, final-submission, audit or backup purge. An absent or disabled retention consumer leaves its events pending.

## Degraded operation

Stopping the worker or leaving providers unconfigured preserves published authored problem and hint access and draft saving. Execution remains a separate isolated service: queued or unavailable results must remain visibly queued or unavailable and never become a passing assessment. The Task 41 browser fixtures exercise both conditions; they are not live-provider or isolated-host execution evidence.

## Content indexing (Task 42)

Use a fresh dedicated content worker role and approved migration `0029_content_indexes.sql`. Run provisioning with `WORKER_CONTENT_ENABLED=true` and the new role's `WORKER_DATABASE_URL`; an existing maintenance role is never widened. This role reads authored problem/hint and curriculum metadata and writes index candidates, with no learner draft access or deletion. It cannot mutate content or enable models/evaluation references. Canonical row locking is exposed by a narrowly scoped function; no general content-update grant is needed.

```sh
WORKER_CONTENT_ENABLED=true pnpm db:worker-role
pnpm worker index usr_0000000000000001 cnt_0000000000000001 derive
WORKER_CONTENT_ENABLED=true pnpm worker consume 100
pnpm worker inspect usr_0000000000000001 100
```

Operations use `WORKER_OPERATIONS_DATABASE_URL` and an active `operator` grant. New original-content publications enqueue derivation automatically in the publication transaction; `index ... derive` backfills existing published versions. It resolves the current canonical checksum server-side. The job contains no source text. Draft, withdrawn and rights-expired sources cannot be admitted. Licensed metadata is excluded from the publication indexing path; no copied third-party payload is indexed.

Inspection now includes index-state counts and bounded embedding configuration metadata. Keep these distinctions visible:

| State | Meaning |
| --- | --- |
| Expectation `pending` | Artifact job not completed |
| Expectation `ready` | That artifact job committed |
| Index `candidate` | Derived artifacts exist; retrieval promotion has not occurred |
| Index `quarantined` | Validation or output failed; safe failure reason recorded |
| Index/expectation `obsolete` | Source unavailable, withdrawn or no longer current |
| Index `ready` | Requires the later evaluated approval and enabled nonfixture configuration |

The pipeline's versioned instruction-marker scan is conservative defense in depth. It does not prove semantic injection safety. A malformed or injected source is quarantined with a safe reason; it is never partially indexed. Correcting published teaching content requires a successor governed version. Policy/configuration changes create new immutable derivation/embedding versions and require their owning module's reviewed configuration change, rather than editing existing artifacts.

### Local embedding fixture

The standalone CLI currently offers only an explicit local/test fixture, with no network call or provider key:

```sh
WORKER_CONTENT_ENABLED=true WORKER_EMBEDDING_MODE=fixture pnpm worker index usr_0000000000000001 cnt_0000000000000001 embed
WORKER_CONTENT_ENABLED=true WORKER_EMBEDDING_MODE=fixture pnpm worker consume 100
```

Derive the source first. Fixture mode is rejected in production, and fixture configurations cannot be enabled for retrieval. The vectors prove delivery/storage/lineage behavior, not semantic quality. Live embedding adapters, budget admission and evaluation/promotion remain subject to the later architecture gates. Leaving embedding mode `disabled` leaves embedding jobs pending.

Content and retention consumer modes cannot be enabled in the same process. Use separate dedicated roles/invocations. A content worker may run bounded reconciliation but cannot clean learner drafts. Retirement invalidates active eligibility immediately; no worker catch-up is required to exclude withdrawn content. Historical artifact purge and backup expiry remain the later privacy workflow's responsibility.

For isolated automated web builds/servers, `ALGOCOVE_TEST_DIST_DIR` selects a test output directory under `.next`; leave it unset for ordinary development. This keeps automated verification from taking the developer server's lock or replacing its artifacts.
