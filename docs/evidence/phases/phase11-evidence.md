# Phase 11 implementation and local assurance evidence

Started 2026-10-07; final verification 2026-10-08 (Asia/Kolkata). Tasks 52–54 are implemented and verified for the owner-authorized local scope. Authorization: “leave it rigth now this, start for the phase 11, analyse this phase and start the full implementations.” Independent Phase 10 publication has been set aside; its runtime guards remain intact. The evidence below was captured before repository publication. On 2026-10-08 the owner authorized committing and pushing all accumulated changes and running GitHub CI; this supersedes the earlier keep-local instruction. Phase 12 has not begun.

## Implemented behavior

| Task | Delivered behavior | Evidence |
| --- | --- | --- |
| 52 | SDK-reverified owned export; explicit deletion confirmation; atomic pending state; denied sign-in/write/callback/retry resurrection; fenced cancellation/purge; derived/audit/outbox cleanup; immutable tombstone; bounded hold/retention; independent durable deletion ledger; backup-expiry inventory; scoped browser recovery removal | Privacy SQL/HTTP integration, populated curriculum and tutor purge tests, two browser journeys, least-privilege checks |
| 53 | Structured allowlisted measurements; constrained request/trace IDs; HMAC session correlation; typed SQL telemetry; critical request instrumentation; authored/provider separation; learning/technical aggregate separation; SLO/burn evaluation; enabled heartbeat and privacy-backlog alerts; operator API and CLI | Serialization canaries including allowed-field injection, missing-heartbeat/synthetic-burn tests, safe SQL projection and expiry, live local aggregate CLI |
| 54 | Isolated synthetic database/asset restore; deletion-ledger replay; outbox/index reconciliation; owned saved work/attempt resume; application/content/fixture-AI/image rollback; cancellation outage/retry game day; incident procedures and owned-environment cleanup | [Passed restore receipt](../restore-drills/phase11-local-drill-2026-10-07.json), [restore runner](../../../ops/restore/README.md), incident runbooks |

[Operational policy](../../architecture/phase11-operational-policy.md) defines local defaults, privileges, scheduling and deployment limits. The explicit ownership inventory and dependency order live in migration 0039; 0040 adds bounded operational samples, heartbeat and retention. Purge authority requires the schema-owned security-definer function, matching pending subject and current fenced lease; a runtime-set GUC cannot bypass immutability. New private writes lock/recheck active account state. The execution host now waits for active teardown before acknowledging cancellation, persists an unconfirmed-teardown marker across restarts, and rejects cancellation acknowledgements while that marker exists. Two controlled-runner tests verify this boundary; host delivery/pump diagnostics use fixed reason codes rather than arbitrary exception text. An incomplete cancellation or failed ledger fsync prevents purge, and an unexpired hold prevents claims/completion.

Export queries remove internal claims/leases and return version/context explanations. The HTTP integration uses the actual route with a mocked **server** authentication adapter and real PostgreSQL: a body-supplied verification/other learner cannot grant access; fresh server verification allows owned export and explicit deletion; post-purge status returns a minimal receipt without identity recreation. Browser checks use HTTP fixtures and validate download, confirmation, interruption/retry, accessibility and owner-scoped local recovery removal. An actual hosted Clerk reverification modal and real learner deletion are not claimed.

## Verification results

| Command/check | Actual result |
| --- | --- |
| Repository-pinned pnpm 12.4.2 `verify` | Passed formatting, ESLint, root/web/worker types, generated tokens, **516 tests**, document links and secret scan |
| `test:integration` | **152 passed; three existing Linux/gVisor-only cases skipped** on macOS; disposable databases and roles removed |
| Populated retention/privacy verification | Held expired drafts survive; released expired drafts/revisions are swept; remaining owned history purges to zero while public curriculum survives |
| Production `build` | Passed; privacy/settings and operator/privacy endpoints included |
| Chromium `test:e2e` | **64 passed**, including two privacy journeys |
| Chromium `test:a11y` | **32 passed**; privacy journey additionally checks axe |
| Chromium `test:execution-browser` | **6 passed** against the clean production build |
| `ops:restore-drill` | Passed actual local restore, four rollback paths, cancellation game day, deletion-ledger replay and cleanup |
| Local persistent preparation | [Receipt](../phase11-persistent-readiness-2026-10-07.json): migration watermark 0040; all five original accounts active; dedicated privacy worker cannot read drafts/outbox payloads; runtime cannot invoke purge; two backups registered |
| Local privacy worker / alert CLI | Worker returned idle; aggregate evaluator ran with no pending/held deletions, no active evaluated alert and null SLOs where no samples existed |

Repository publication preparation on 2026-10-08 repeated the frozen-lockfile install, full repository verification, database integration, production build and all three browser suites from a clean export of the staged files, without ignored local environment files or build caches. Results matched the table above. The fallback authentication assertion now checks the intended encoded return destination. Next.js and its ESLint configuration are pinned to 16.3.8, with the sharp security override retained at 0.35.5; the full dependency audit passes with the documented unpatched development-only braces exception. GitHub Actions remains the remote verification record for the pushed revision.

The final local restore receipt measures a **0.208 s snapshot window**, **one deliberately lost post-snapshot synthetic write**, and **0.485 s restore-to-database-journey recovery**. The measurement excludes prior artifact capture/build and later rollback checks. Hashes for the four immutable assets, dump and minimal ledger, distinct application build IDs, exact prior runtime digest, and cleanup confirmations are in the receipt. Current and prior production builds serve readiness on the additive restored schema using local test configuration. The runtime digest smoke uses Docker Desktop; it does not requalify the Linux/gVisor boundary already tested in Phase 10.

## Operational entry points

- `/settings/privacy` and `/api/privacy`: learner privacy controls and minimal status.
- `/api/admin/privacy`: recently reverified, actively granted privacy-administrator hold/release.
- `/api/admin/operations` and `pnpm ops:alerts`: aggregate operations and actionable symptom evaluation.
- `pnpm db:privacy-worker-role`, `pnpm privacy:consume` and `pnpm privacy:consume --retention`: dedicated role provisioning and bounded processing.
- `pnpm ops:restore-drill`: isolated local rehearsal; requires the separately retained prior build and available local reference stack.

Runbooks: [database/service](../../../ops/runbooks/service-degradation.md), [provider](../../../ops/runbooks/provider-failure.md), [worker](../../../ops/runbooks/worker-recovery.md), [privacy](../../../ops/runbooks/privacy-incident.md), [sandbox](../../../ops/runbooks/sandbox-incident.md), [content](../../../ops/runbooks/content-incident.md), [release](../../../ops/runbooks/release-incident.md). Each records owner/severity, containment, payload-free evidence, recovery and communication responsibilities. No notification or deployment was sent.

## F11 scope and remaining release gates

Local Phase 11 engineering assurance passes. Local privacy defaults and the reliability envelope are implemented and explicitly labelled; unresolved Task 4 hosted legal/retention/region/targets still need owner decisions before real-learner hosting. Terminal execution latency, live provider reliability, hosted pager delivery, deployed network/sandbox security, representative load, durable cloud backup destruction and staging PITR are not inferred from this local evidence. Task 57 must repeat deployed staging restore and incident qualification.

At the time of this local evidence capture, independent publication, manual assistive-technology review and remote CI were the distinct Phase 10 release gates previously recorded. Repository publication and remote CI are now authorized; actual curriculum publication remains set aside and is not marked completed. Phase 12 requires its own owner authorization and hosted decisions. The persistent learners were not deleted or used in the synthetic drill, and existing private backups/environment copies were preserved.
