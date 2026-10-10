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

Task 55 remains in progress because isolated execution hosts, separately supervised worker processing, durable deletion recovery, telemetry operations and environment security review are not all provisioned/qualified. Execution and live tutor/roadmap generation remain disabled. Tasks 55a, 56 and 57 remain unchecked: positive MFA/stale reverification and callback/full ownership qualification, independent configuration/image promotion, historical PITR/deletion replay, load, complete privacy/accessibility assurance and the named pilot-readiness decision still need evidence. Current successful release/lifecycle/rollback checks are recorded in the follow-ups below. The six-hour Neon Free history window is a capacity limit, not recovery assurance. No real learner cohort or production release is admitted by the successful web smoke test.

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

Final local follow-up verification passes 587 tests, including three Preview safety cases (production-target cancellation, commit mismatch and redacted provider rejection), formatting, lint, types, tokens, documentation and secret checks. The development dependency audit passes its existing policy with the previously documented unpatched dev-only braces advisory. This historical read-only check was superseded by the successful merged-main gated release recorded below.

## Merged-main release and free hosted assurance

PR #2 merged at `181e45cd606b4e71bb9d60f791b4f2ec382abff7`. [Merged-main CI 38032305983](https://github.com/vsuman00/AlgoCove/actions/runs/38032305983) passed all three required jobs. [Gated Preview release 38032958408](https://github.com/vsuman00/AlgoCove/actions/runs/38032958408) then passed exact-SHA admission, deployment, protected health/readiness smoke and temporary-access revocation. The retained release receipt identifies `dpl_8cmaGMsEcLYmkc473uXmBpju7GKa`, immutable [Preview](https://algocove-99zu7ueex-vsuman00s-projects.vercel.app), target Preview and region `sin1`. This proves the repository token can deploy through the scoped API. Automatic main Git deployments are now disabled by the merged configuration; the observed deployment was created after successful CI. The stable staging and production aliases were not promoted by this workflow.

The expanded opt-in hosted harness passes these checks against that exact merged-main Preview:

- Reserved development email-code sign-in, application identity and sign-out.
- Fresh first-factor privacy export returns only the authenticated account despite a forged target field, with `Cache-Control: no-store`; an unrelated Origin returns HTTP 400. A second real synthetic account cannot export the first account even when its learner ID is supplied; both exports exclude the other account.
- A temporary operator grant on an unenrolled synthetic account rejects both operator and learner request contexts with HTTP 403. Removing that grant restores learner access immediately in the same provider session while operator access remains denied.
- Backend session revocation is confirmed by Clerk and application authentication becomes HTTP 401 within the bounded 75-second refresh window. This does not claim instantaneous invalidation of an already-issued JWT.
- `/`, `/learn`, `/sheets` and `/review` pass automated WCAG A/AA checks and 320px overflow checks. These checks do not replace manual assistive-technology evaluation or authenticated content/interaction coverage.

Two hosted tests passed. The separate positive TOTP test remains blocked: after the owner reported enabling MFA, backend provisioning rejects `totp_secret` and the real client enrollment API explicitly returns “This feature is not enabled on this instance.” The configured development host is `ready-grackle-8159.clerk.accounts.dev`. The harness now uses actual client enrollment and second-factor verification, with no ticket-based MFA bypass; positive operator admission is not counted as verified. Synthetic provider accounts and their exact database fixtures are cleaned up even on failure.

A live exact-SHA preflight against cancelled candidate `48d27582ac42e862e7fcb68bd4861b80e11f1380` rejected admission with `release_ci_rejected`; no deployment request followed. This supplements unit rejection cases but is not a complete provider-side failing-CI rollout exercise.

## Hosted application rollback rehearsal

A separate alias `algocove-rollback-drill-vsuman00.vercel.app` was assigned to current deployment `dpl_8cmaGMsEcLYmkc473uXmBpju7GKa`, rolled back to CI-passed PR artifact `dpl_9zvyLrKAvtYx1S9djzhojNk8FZxx` (source `6a5593be99146bbe7dbdddfd3573142bcc421808`), then returned to the current deployment. At 11:50:06, 11:50:29 and 11:50:40 UTC, each assignment passed application liveness/readiness HTTP 200 and signed-out session HTTP 401 against the existing additive schema 0040. Original staging/production aliases and database state were preserved.

These independently built artifacts contain identical application source trees. The drill proves alias reversal and schema-compatible startup, not rollback across a behavior-changing release or independent content/AI/runtime configuration rollback. Temporary alias/deployment access links are revoked after qualification.

## Independent image release gate

[Execution image release 38049656304](https://github.com/vsuman00/AlgoCove/actions/runs/38049656304) admitted merged main and successfully built, scanned, signed and verified Python and JavaScript/TypeScript images. The Java scan found fixable high-severity OpenSSL vulnerabilities and an unused `/usr/bin/pebble` Go binary; Java signing was blocked and the C/C++ matrix job was cancelled by fail-fast. This is genuine failed-scan gate evidence, not a complete four-profile release. The follow-up Java Dockerfile upgrades distribution packages before removing package managers and removes the unused binary. A new admitted revision and successful scans/signature verification are required before the complete image set is approved. Publication alone never enables hosted execution.

Follow-up local `pnpm verify` passes 587 core tests and its formatting, lint, type, token, documentation and secret checks. The patched amd64 Java image builds with OpenSSL package `3.5.5-1ubuntu3.7`, no `/usr/bin/pebble`, UID 65532 and the unchanged OpenJDK 25.0.4 toolchain. Network-disabled, read-only normal Java compilation/execution passes and the malformed-source fixture is rejected. Remote vulnerability/signature admission remains separate from these local smoke results.

## Complete patched image publication

[Execution image release 38051107552](https://github.com/vsuman00/AlgoCove/actions/runs/38051107552) succeeds at code revision `1ca3381c4838913bc1183ff598358ce2b1e2fc84`, admitted by [CI 38050385353](https://github.com/vsuman00/AlgoCove/actions/runs/38050385353). All three required CI jobs pass, including the stronger gVisor/real-learning-loop gate. Linux quality evidence reports 587 core tests, 153 integration tests passed/three skipped, and 102 browser checks passed.

All four image jobs build with provenance/SBOM, pass the configured fixable HIGH/CRITICAL vulnerability gate, sign the immutable digest and verify GitHub workflow identity plus OIDC issuer. This supersedes the incomplete first publication attempt; the failed first Java scan remains useful evidence that signing was blocked. Passing the configured scan does not claim the absence of every vulnerability.

| Profile | Published immutable reference |
| --- | --- |
| python | `ghcr.io/vsuman00/algocove/execution-python@sha256:5084af38fd491b1c8dcd748ffc0d88d95aade02f6f38d27c011cdf5387af3e0e` |
| javascript-typescript | `ghcr.io/vsuman00/algocove/execution-javascript-typescript@sha256:b3261286fba1dc45c23c5f3a78df8c038d7b7f4a11eb12f87f664428a48a1024` |
| java | `ghcr.io/vsuman00/algocove/execution-java@sha256:109905625bbb7f0c2f2d6e3d289d806297f473400da21e37eecf2d8de5eec228` |
| c-cpp | `ghcr.io/vsuman00/algocove/execution-c-cpp@sha256:04b4a9d95fb36a915659d00b2f2f44b930f5c0d0ed8a8115a9a7a4e186c3196d` |

Publication approves this scanned/signed artifact set; it does not provision an execution host, promote a runtime manifest or enable learner execution. The later ADR-0025 commit changes planning documentation only and proposes free production-MFA qualification. Separate content/AI/runtime configuration lineage and the full pilot gates remain open.

## Tasks 55–57 follow-up: independent runtime release controls

The owner clarified that this follow-up targets Tasks 55, 56 and 57 and leaves Task 55a unchanged. Task 55a's recorded engineering/hosted evidence remains as written; this clarification is not a new provider-MFA test result.

Task 56 now adds canonical complete four-profile runtime manifests and six-language image mappings. The image workflow assembles the set only after successful profile jobs, reverifies exact-source CI and image signatures, then signs and verifies the manifest. The operator promotion/rollback command verifies current CI, release-job membership, exact-source manifest and image signatures before changing an atomic pointer under a lock. Immutable local decision receipts retain previous/target digests, source commit/run, timestamp and operator OS UID. Execution remains disabled and no host is started by promotion.

Twenty-six focused tests pass: complete/mixed/missing/duplicate source sets, immutable digests, unknown/enabling fields, signature/CI rejection, foreign workflow/repository, skipped jobs, stale pointer, rejected rollback, retained-map corruption, canonical signature bytes and positive audited promotion/rollback. These injected tests prove local control behavior, not live signatures. Live artifact qualification and exact-revision CI are recorded separately when available. [Operator procedure](../../deployment/release.md#independent-runtime-manifest-promotion).

Tasks 55 and 57 retain the original non-waivable requirements: a separately isolated host/worker, durable privacy recovery, content rights, measured hosted capacity and the named readiness decision. The existing $0 constraint and disabled hosted execution do not satisfy those requirements. No pilot is admitted by this slice.
