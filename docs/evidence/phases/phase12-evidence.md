# Phase 12 staging foundation evidence

Recorded 2026-10-10. Phase entry is owner-authorized. Task 55 is **in progress**; Tasks 55a, 56 and 57 remain incomplete. See the [staging guide](../../deployment/staging.md) for configuration and remaining hosted decisions.

## Repository verification

- `pnpm verify`: 548 core tests pass; lint, types, formatting, design tokens, documentation links and secret checks pass.
- Focused database lifecycle suite: 15 tests pass against disposable PostgreSQL, including restricted runtime, owner rejection and inherited privileged-role rejection. Local plaintext transport correctly fails the hosted transport check.
- Production Next.js build passes.
- `pnpm test:hosted-startup`: three tests pass against that build. Local liveness remains available without hosted credentials; unsafe hosted initialization returns HTTP 500 without leaking a credential canary; configuration-only preflight explicitly reports that it has not checked a database.

These are local engineering results. No hosted identity, migration, restore/PITR, load or pilot-readiness claim follows from them.

## Provider actions

Vercel project `algocove`, ID `prj_y4QC0yhk2h2frXDs8l3H0yn9IjJK`, was created in team `vsuman00s-projects`. The project API confirms Next.js and Node 22.x. Monorepo root, external workspace inclusion and pinned install/build commands were submitted successfully; the subsequent successful hosted build verifies that this workspace builds on Vercel. No Git auto-production link was enabled.

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
