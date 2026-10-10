# Phase 12 staging foundation evidence

Recorded 2026-10-10. Phase entry is owner-authorized. Task 55 is **in progress**; Tasks 55a, 56 and 57 remain incomplete. See the [staging guide](../../deployment/staging.md) for configuration and remaining hosted decisions.

## Repository verification

- `pnpm verify`: 548 core tests pass; lint, types, formatting, design tokens, documentation links and secret checks pass.
- Focused database lifecycle suite: 15 tests pass against disposable PostgreSQL, including restricted runtime, owner rejection and inherited privileged-role rejection. Local plaintext transport correctly fails the hosted transport check.
- Production Next.js build passes.
- `pnpm test:hosted-startup`: three tests pass against that build. Local liveness remains available without hosted credentials; unsafe hosted initialization returns HTTP 500 without leaking a credential canary; configuration-only preflight explicitly reports that it has not checked a database.

These are local engineering results. No hosted identity, migration, restore/PITR, load or pilot-readiness claim follows from them.

## Provider actions

Vercel project `algocove`, ID `prj_y4QC0yhk2h2frXDs8l3H0yn9IjJK`, was created in team `vsuman00s-projects`. The project API confirms Next.js and Node 22.x. Monorepo root, external workspace inclusion and pinned install/build commands were submitted successfully; the subsequent successful hosted build verifies that this workspace builds on Vercel. Later inspection of the main merge found an automatic production deployment; the release follow-up below records that behavior and the corrective configuration.

Appwrite managed PostgreSQL was initially proposed. The owner subsequently selected Neon Free in Singapore within a strict $0 budget. Supporting execution/worker infrastructure, recovery assurance and hosted policy decisions remain open.

## Free staging provisioning follow-up

The owner set a hard $0 budget and selected Neon Free in Singapore. Project `bold-sky-06853855`, PostgreSQL 17, was created under the connected Free organization. All 40 migrations applied; rerunning the migration runner skipped all 40. Generated migration/runtime credentials are held outside Git with private permissions. The owner/operator grant permits migration-role assumption without adding privileges to the runtime role.

Direct and pooled runtime qualification both passed `verifiedClientTransport`, `runtimeRole`, `pgvector` and `phase11Schema`. PostgreSQL's backend SSL view returned false behind the provider proxy, so the preflight now verifies the pinned client's TLS socket, CA authorization and hostname instead. The local plaintext integration fixture remains rejected.

The first GitHub run failed with a late administrator-termination error during disposable database cleanup. Cleanup now waits for PostgreSQL to observe client disconnects and drops without FORCE. The complete local integration suite then passed 153 tests, with three Linux-only checks skipped on macOS. [GitHub CI run 38027225249](https://github.com/vsuman00/AlgoCove/actions/runs/38027225249) subsequently passed all three jobs on Linux at commit `504c46febd973a60fc8f16493fd2f101de4d2440`: repository quality, execution/conformance/sandbox contracts, and the stronger gVisor runtime/real learning loop.

Preview environment creation through the connector was denied with HTTP 403. The owner uploaded the prepared web environment manually and instructed deployment. The resulting preview passes application configuration/database readiness. Environment-variable inventory/read-back remains unavailable through the connector; runtime smoke checks do not prove every stored variable or provider account setting.

## First verified hosted web deployment

Verified 2026-10-10, approximately 05:38–05:42 UTC:

- Deployment `dpl_8c3c6C8St2w4yVhGteFDZDp4cF5i`, source commit `504c46febd973a60fc8f16493fd2f101de4d2440`, state `READY`, target `null` (Vercel Preview).
- Stable staging origin: [algocove-staging-vsuman00.vercel.app](https://algocove-staging-vsuman00.vercel.app). Immutable deployment: [algocove-afajlebfu-vsuman00s-projects.vercel.app](https://algocove-afajlebfu-vsuman00s-projects.vercel.app).
- Deployment metadata confirms function region `sin1`. Hosted build logs confirm pinned pnpm 12.4.2 installation and successful Next.js 16.3.8 compilation. Build duration was approximately 83 seconds, from Vercel's `buildingAt` to `ready` timestamps.
- Deployment protection stayed enabled. Tests used a temporary authenticated access link held privately, with no access token, cookies, traces or credentials committed.
- `/api/health`: HTTP 200, `status: live`, `service: algocove-web`, `Cache-Control: no-store`.
- `/api/readiness`: HTTP 200, `status: ready`, configuration and database checks both `ok`, `Cache-Control: no-store`.
- Anonymous `/api/auth/session` and `/api/review`: HTTP 401 with application `unauthenticated` responses. The connector fetch tool initially misclassified the session endpoint's 401 as deployment protection; a browser cookie context confirmed that the application's own authentication rejected it.
- `/api/learning/sheets`: HTTP 200 with an empty published collection list. The separate curriculum-publication gate remains open; no production/local learner database was copied into staging.
- Chromium loaded `/`, `/sign-in`, `/learn`, `/sheets` and `/review` with HTTP 200. The actual Clerk identifier input and sign-in heading rendered; there was no missing-configuration/local sign-in fallback and no browser page errors. No account was created or signed into, so this is entry-point evidence, not authenticated lifecycle/MFA evidence.
- Clerk's UI identifies the configured instance as **development mode**. These keys are suitable for the current synthetic staging check, not evidence of production identity configuration.
- Sixteen first-party JavaScript assets loaded across these pages (747,457 bytes) contained no matches for the known server Clerk key, runtime database URL/password or telemetry correlation key. This bounded scan does not inspect every asset, unknown secret or provider-side log.
- A bounded runtime-log query found no error/fatal groups for this deployment during the 30-minute inspection window. This is smoke evidence, not an SLO measurement.

The first deployment request returned a production target despite the supplied `preview` string. It was cancelled while building (`dpl_5u7umApVHGHcjemQKunSrxJuf3dJ`). Retrying with the API's documented omitted-target preview default produced the verified deployment above. No production promotion was performed.

The hosted inspection found a misleading “local environment” label in the shared Clerk connection notice; the follow-up changes it to environment-neutral wording.

## Remaining Phase 12 requirements

Task 55 remains in progress because isolated execution hosts, separately supervised worker processing, durable deletion recovery, telemetry operations and environment security review are not all provisioned/qualified. Execution and live tutor/roadmap generation remain disabled. Tasks 55a, 56 and 57 remain unchecked: actual sign-in/sign-out/revocation/reverification/MFA, complete gated promotion/rollback drills, hosted restore, load, privacy/accessibility assurance and the named pilot-readiness decision still need evidence. The six-hour Neon Free history window is a capacity limit, not recovery assurance. No real learner cohort or production release is admitted by the successful web smoke test.

## Release and identity hardening follow-up

The owner merged PR #1 into `main` at `1e8644c0a922c85d74f8d6bfabcd9449eb563731`. [CI run 38029436366](https://github.com/vsuman00/AlgoCove/actions/runs/38029436366) passed all three jobs. Vercel automatically created production-target deployment `dpl_GKNSzo4BdGbLXiTcDq3BKQYVmdRn` before CI completed. Its health/readiness passed and execution remained disabled; this provider target does not constitute pilot approval.

Follow-up source commits implement strict five-minute privileged MFA using Clerk-verified first/second-factor ages, hosted-marker admission on Vercel, and exact-revision CI admission. Local `pnpm verify` passes 584 tests plus formatting, lint, types, tokens, documentation and secret checks. The release gate was also exercised successfully against both prior source `9cf66c8e2d17cb38cfdff368400e350a7d521163` and merged main `1e8644c0a922c85d74f8d6bfabcd9449eb563731`.

The [release procedure](../../deployment/release.md) defines the new gated Preview workflow and independent image admission. Automatic `main` deployments are disabled in the proposed Vercel configuration; this has not yet been merged/read back as active provider policy. [PR #2](https://github.com/vsuman00/AlgoCove/pull/2) carries these changes. Its automatic Preview at source `48d27582ac42e862e7fcb68bd4861b80e11f1380` is `dpl_HeVwQ6VTyCG1dDdZnEMqiGtoUZrD`, READY, target Preview. Provider automatic Preview creation is separate from the gated release workflow.

## Isolated hosted database snapshot recovery

At 06:17:53 UTC, snapshot `snap-twilight-lab-b349z7qm` was created from staging branch `br-winter-truth-b3qk2wzu`, with expiry 2026-10-11 06:30 UTC. At 06:18:03 UTC, restoration with `finalize: false` created separate branch `br-aged-mouse-b3tkd3bo`; it became READY at 06:18:04 UTC. No existing branch was replaced or finalized, and original endpoint `ep-ancient-star-b338mxn4` remained attached to staging.

The restored branch reports 40 migrations, watermark `0040`, pgvector present, and a runtime role without superuser, createdb or createrole. A direct restricted-runtime check passes verified TLS transport, runtime-role qualification, pgvector and Phase 11 schema checks. The restore API returned in approximately 3.46 seconds; successful SQL qualification was available within approximately 30 seconds of invocation, including operator orchestration. These timings describe database readiness only, not application RTO. No deliberate pre/post-loss marker was written, so no workload RPO is claimed.

Restored endpoint `ep-dry-cake-b3viqenn` uses 0.25 CU minimum/maximum. Suspension was requested after inspection. The snapshot occupies the Free plan's manual snapshot allowance until expiry; the separate branch remains available for review and is not attached to the web application. Existing application environment credentials were unchanged. Hosted asset recovery, historical PITR, deletion-ledger replay and application recovery remain unqualified.

The [pilot readiness matrix](../pilot-readiness.md) lists the remaining non-waivable gates and maintains a NOT READY decision.

## Real staging authentication lifecycle

`pnpm test:hosted-auth` passes the development-instance email-code journey against immutable Preview `dpl_HeVwQ6VTyCG1dDdZnEMqiGtoUZrD`. The test creates a unique reserved Clerk test email and temporary account, uses Clerk's client-side email-code verification helper, observes application `/api/auth/session` returning HTTP 200 with the learner role, signs out, then observes HTTP 401 with `authenticated: false`. It deletes only its own provider account and exact provider-subject database mapping/learner fixture afterward. No real email recipient, persisted browser session, trace, screenshot or video is used.

The password helper initially produced no active session under the instance's verification requirements; it is not counted as a successful password/MFA flow. Email-code testing exercises the configured development verification path, not production identity assurance or privileged MFA. A temporary Vercel share cookie grants deployment access separately from Clerk authentication; revocation was requested after testing. Real backend session revocation, privileged MFA/reverification, callback and cross-account qualification remain pending. The harness requires development keys and an immutable project Preview, and must never run against live Clerk keys.

The owner supplied `VERCEL_TOKEN` through GitHub, initially as an environment secret and then as a repository secret. The first credential check [run 38031087186](https://github.com/vsuman00/AlgoCove/actions/runs/38031087186) was rejected by Vercel with “User not found (404)” before any deployment. The owner replaced the secret. CLI account lookup still returned 404, but the scoped project API check passed in [run 38031339069](https://github.com/vsuman00/AlgoCove/actions/runs/38031339069), confirming access to the expected project/team. The release workflow now uses that API path. This read-only credential result does not prove deployment-write permissions or a completed deployment workflow.

Final local follow-up verification passes 587 tests, including three Preview safety cases (production-target cancellation, commit mismatch and redacted provider rejection), formatting, lint, types, tokens, documentation and secret checks. The development dependency audit passes its existing policy with the previously documented unpatched dev-only braces advisory. The complete hosted release workflow remains unexecuted until merged; current read-only provider access is verified.
