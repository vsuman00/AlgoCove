# AlgoCove implementation task ledger

**Status:** Phase 2 identity/profile evidence is complete from owner-verified Clerk sign-in/sign-up and profile use. Phase 3 technical implementation and manual browser validation are complete. The owner authorized Phase 4 transition work on 2026-09-17. Tasks 20, 21, 22, 23, and the bounded Task 24 abuse/control slice are complete with local and remote evidence. Task 19's gVisor candidate matrix passed remotely in final CI run [35263785032](https://github.com/vsuman00/AlgoCove/actions/runs/35263785032), and the GHCR release, Trivy, SBOM/provenance, and Cosign gates passed in run [35261137554](https://github.com/vsuman00/AlgoCove/actions/runs/35261137554). Phase 4 remains open only for the explicit security-owner decision on the candidate runtime; runnable content publication remains blocked.
**Detailed acceptance criteria:** [Implementation plan](plan.md)  
**Ordering:** Follow phase/document order, not numeric sorting. Suffix tasks close review gaps; Task 51 is intentionally before live AI. Parent packages need bounded subcards before coding.  

**Phase 5 transition (2026-09-18):** The owner directed Phase 5 implementation. Task 25 is complete with domain session/attempt state machines, owner-scoped PostgreSQL persistence, optimistic fencing, atomic language reset, and live PostgreSQL race evidence. Task 25a's implementation slice is complete locally with an application execution port, descriptor-only durable dispatch, exact trusted-result matching, immutable assessment observations, atomic outbox persistence, signed worker terminal handoff, authenticated callback transport, replay handling, and lost-response reconciliation; real isolated-host execution and six-language result evidence remain open. Task 25b is complete with replaceable private current drafts, explicit saved revisions, optimistic fencing, TTL, owner-scoped deletion, and Chromium evidence for reload, offline, reconnect, conflict, expiry, and logout cleanup. Task 26 is complete at the contract/application/database layer with versioned structured pseudocode, append-only revisions, owner fencing, and deterministic authored-evidence readiness. Task 27 is complete for the versioned trace protocol and isolated accessible renderer; workspace composition remains in Task 29. Task 28 is complete for deterministic authored hints, cumulative exposure, write-before-display, idempotency, ceilings, and the solution-review gate; workspace composition remains in Task 29.

**Current evidence:** Phase 1, Phase 2, and the Phase 3 implementation slices pass the local gate: `pnpm verify`, `pnpm test:all`, production build, dependency audit, 13 isolated PostgreSQL/pgvector integration tests, 9 deterministic Chromium accessibility tests, Clerk adapter/route fixtures, profile ownership/version tests, authorization matrix tests, curriculum cycle/version tests, content provenance/review/tombstone tests, six-language manifest tests, reviewed external-link/domain tests, collection deduplication, and the fixture-backed author/review/publish UI. The Clerk CLI is authenticated, linked to the AlgoCove application, and has pulled development keys into the ignored `apps/web/.env.local`; enabled-key build and liveness smoke checks pass. The owner manually verified Clerk sign-up/sign-in, profile use, and the Clerk user record. The profile persistence boundary remains covered by the application path and isolated PostgreSQL tests; no separate live SQL inspection is claimed here. Task 20's signed execution-contract package and 7 focused tests pass. Task 21's execution-control and descriptor-only outbox relay slice passes 8 focused tests, the full local gate, the 13-test PostgreSQL suite with migration 0009, production build, and 9 Chromium accessibility tests. Task 22 has four pinned image profiles for six languages with SBOM/provenance, smoke evidence, and zero local Docker Scout critical/high findings; release run [35261137554](https://github.com/vsuman00/AlgoCove/actions/runs/35261137554) built and pushed all four GHCR profiles, passed the fixable CRITICAL/HIGH Trivy gate, and verified keyless Cosign signatures. Task 23's local conformance runner passes 36 correct executions, rejects six mutated solutions, and rejects spoofed/malformed/expected-value output. Task 24's local abuse runner passes 14 bounded escape/egress/resource/path/signal/cancellation/teardown fixtures with no container residue; the existing signed-result and lifecycle tests cover correlation, fencing, cancellation classification, and infrastructure-error handling. Task 19's fail-closed explicit runtime selection and gVisor candidate CI job passed the six-language normal/hostile/concurrent matrix in final run [35263785032](https://github.com/vsuman00/AlgoCove/actions/runs/35263785032), but the security-owner approval is still pending. Phase 4 still does not approve Docker `runc` for hostile learner code. The architecture A0-A2 approval records and Phase 0 planning decisions remain explicitly proposed or pending where the architecture documents say owner input is required. Phase 5 Task 25 and Task 25b now have live evidence: the PostgreSQL practice suite passes 19 tests across session, attempt, reset, draft, pseudocode, hints, run, observation, and outbox boundaries, and the Chromium draft-sync test passes offline reload, reconnect, conflict, expiry, and logout cleanup. Task 26 unit, application, and live persistence fixtures pass; readiness only accepts rubric-version-matched structured checks and exact verified-run evidence. Task 27 protocol/renderer and Task 28 hint policy/application tests pass.

**Phase 5 Task 29 update (2026-09-18):** The first guided workspace vertical slice is implemented at `/learn/arrays-two-pointer`. It composes the six-language source editor, structured pseudocode fields, reviewed trace renderer, authored-hint entry point, learner-scoped private recovery, responsive narrow layout, and a truthful disabled Run/Submit state. Authenticated workspace/draft/pseudocode/hint routes, serialized UI synchronization, focused web component checks, the production build, 16 Chromium accessibility checks, anonymous fail-closed recovery, and authenticated-fixture reload recovery pass. Real trusted execution result ingestion, correct/wrong/compile/timeout/infrastructure browser evidence, and the security-owner sandbox decision remain prerequisites for closing the end-to-end task and F5.

**Phase 5 verification update (2026-09-18):** `pnpm verify` passes (format, lint, typecheck, tokens, 127 unit/web/architecture tests, docs, secret scan); `pnpm test:integration` passes 19 live PostgreSQL tests; `pnpm build` passes; `pnpm test:a11y` passes 15 Chromium tests including guided-workspace accessibility, narrow-screen layout, and reload recovery; `pnpm test:e2e` passes the draft-sync recovery suite; `git diff --check` passes. Disposable `apps/web/.next` and `test-results` output were moved outside the repository to `/tmp/algocove-generated-20260918-round2`; dependencies and ignored environment files were retained.

**Task 29 privacy gate (2026-09-18):** Workspace recovery is now keyed by the authenticated internal learner ID and is disabled for signed-out sessions. The hint panel no longer bundles or reveals authored hint text; it records only the pending authenticated exposure handshake. The anonymous and authenticated-fixture browser checks pass.

**Phase 5 durable-sync update (2026-09-18):** The web composition root now has authenticated, owner-scoped practice routes for workspace bootstrap, source drafts, and structured pseudocode. Workspace bootstrap resolves only published, available manifests, creates or resumes an active attempt, creates the two private artifacts, and returns version tokens. Debounced authenticated UI edits use the existing optimistic application use cases through versioned PUT routes; local recovery remains learner-scoped and server failures are reported as pending rather than as a false save. Focused route/component tests, typecheck, lint, and formatting pass. Task 29 remains PARTIAL because live authenticated hint/browser evidence, trusted execution-host ingestion, result-category browser evidence, and the Phase 4 security-owner decision are still open.

**Phase 5 authored-hint update (2026-09-18):** The workspace hint control now calls an authenticated `/api/practice/hints` exposure route with a stable idempotency key. The route delegates to the existing authored-hint policy/application/database boundary and returns the hint body only after exposure persistence succeeds; signed-out, unavailable, invalid, capped, and replay behavior stays fail-closed. Focused route/component tests pass. Task 29 remains PARTIAL until live authenticated hint exposure and the execution/resume evidence are exercised in the browser.

**Phase 5 local-content update (2026-09-18):** Added the operator-only `pnpm db:seed:practice` command for the original six-language Container-with-most-water bundle. It seeds reviewed/validated/published local content, six distinct published manifests, shared semantic fixtures, and the authored hint ladder outside migrations; the command ran successfully against the local PostgreSQL role-separated database. Hosted publication is unchanged and still requires the governed content workflow.

**Phase 5 UI sync update (2026-09-18):** Serialized authenticated source/pseudocode saves through one in-flight queue so a slow versioned write cannot race a newer learner edit. The latest edit remains the only one that can move the UI to `saved` or `server_pending`, while each queued write uses the version returned by the preceding write. A focused four-test web suite passes. Task 29 remains PARTIAL because real trusted execution-host ingestion, result-category/resume browser evidence, and the external security-owner sandbox decision remain open.

**Phase 5 workspace-resume update (2026-09-18):** Added database uniqueness for one active learner session per mode, one active attempt per problem/manifest/language, and one source/pseudocode artifact per attempt. Workspace bootstrap now recovers unique-key races by reloading the committed owner-scoped row instead of returning a duplicate or fabricated workspace. The focused authenticated-route suite passes 7 tests and the live PostgreSQL suite passes 19 tests with migration 0015 applied. Task 29 remains PARTIAL only at the execution/result/security evidence boundary.

**Phase 5 durable-dispatch update (2026-09-18):** Task 25a now prepares the descriptor-only execution outbox event before the run transaction, commits that event atomically with the run request and `run_requested` attempt event, and performs ephemeral source dispatch only after commit. Relay response loss therefore leaves one durable retryable request; source is still absent from the persisted event. Code-run application tests and the live 19-test PostgreSQL suite pass. Task 25a remains PARTIAL because no approved isolated execution host/result callback is available yet.

**Phase 5 result-boundary update (2026-09-18):** The practice application now rechecks terminal-category classification and bounded result/replay/lease metadata before accepting any trusted result. A mismatched infrastructure/success result is rejected before attempt, observation, or assessment-outbox mutation; the focused code-run suite and typecheck pass. This is defense in depth, not execution-host evidence.

**Phase 5 worker-handoff update (2026-09-18):** Added the worker-side terminal handoff contract: signed worker results are accepted by execution-control, teardown is confirmed, and only the resulting terminal signed result is delivered to the application sink. Retries forward the same terminal result idempotently; teardown failure produces an infrastructure result. Seven execution-control tests and both worker/application typechecks pass. A real isolated host and authenticated application callback remain deliberately unconfigured.

**Phase 5 result-callback update (2026-09-18):** Added the authenticated internal web callback route and worker HTTP sink for terminal signed results. The callback resolves the owner from the durable run, reconstructs only bounded trusted-result fields, and delegates to the existing owner-scoped atomic attempt/observation/outbox commit; production execution now requires a server-only callback token. Signed-out callback rejection, configuration, worker transport, and typecheck fixtures pass. The callback still depends on an approved isolated host/control deployment for real result evidence.

**Phase 5 application-execution integration update (2026-09-18):** The live PostgreSQL practice suite now drives `requestPracticeCodeRun` and `ingestTrustedPracticeResult` through the application boundary, not only repository methods. It proves durable descriptor-only outbox persistence, pass/wrong-answer/infrastructure-failure result categories, no positive credit for infrastructure failure, terminal result commit, replay idempotency, and a lost dispatch response that leaves the original run retryable without creating a replacement. The suite passes 20 tests. Real isolated-host execution and six-language result evidence remain open.

**Phase 5 execution-request boundary update (2026-09-18):** Added the authenticated `/api/practice/runs` boundary and wired the workspace Run/Submit controls to send the current attempt, mode, and source only when the learner is authenticated. The UI now serializes the request state as requesting/queued/unavailable; it never fabricates a result, and the server returns dependency-unavailable until an approved execution relay is configured. The focused web suite passes 32 tests.

**Phase 5 terminal-status gate (2026-09-18):** Added migration `0016_code_run_terminal_state.sql` and persisted bounded trusted terminal category, classification, and completion time on every code run. Added the owner-scoped `GET /api/practice/runs/[runId]` status boundary; it returns only queued or completed state and never exposes source. The workspace now polls one queued run, renders server-returned pass/wrong/compile/type/runtime/limit/cancelled/infrastructure categories, and resets safely when the source or language changes. The focused web suite passes 33 tests and the live PostgreSQL suite passes 20 tests with 16 migrations. Real isolated-host delivery and security approval remain open.

**Phase 5 resume-status gate (2026-09-18):** Workspace bootstrap now includes the latest owner-scoped run status for the active attempt. Reload can restore a queued run into the same status poll or restore a committed terminal category, including infrastructure failure, without marking the learner successful. The focused web suite passes 34 tests. This proves the application/UI resume contract with fixtures; real browser result and resume evidence still depends on the approved execution host.

**Phase 5 browser-result fixture gate (2026-09-18):** Added `pnpm test:execution-browser`, a dedicated Chromium fixture suite that intercepts only the authenticated workspace/run boundaries and verifies server-shaped pass, wrong-answer, compile-error, resource-limit, and infrastructure-failure rendering. The pass case also reloads and restores the committed result from workspace bootstrap, and each case asserts that source is sent only to the run request and never returned by the status boundary. All 5 browser fixtures pass; this remains fixture-backed evidence, not approval of the isolated execution host.

**Phase 5 cancellation gate (2026-09-18):** Added the authenticated learner cancellation boundary at `/api/practice/runs/[runId]/cancel`. The workspace exposes Cancel execution only for an owned queued run, serializes cancellation/requesting state, and waits for the server-observed cancelled terminal result before rendering completion. The route, relay invocation, and synchronized UI cancellation fixture pass; real cancellation still depends on the approved execution relay and isolated host.

**Phase 5 completion sweep (2026-09-18):** The current implementation is synchronized and checklist-tracked. `pnpm verify` passes with 36 files and 141 unit/web/architecture tests; the isolated live PostgreSQL suite passes 20 tests; `pnpm build` passes and includes the authenticated `/api/practice/runs` boundary; `pnpm test:a11y` passes 16 Chromium checks; `pnpm test:e2e` passes the offline/reconnect/conflict draft recovery test; the existing six-language conformance and 14 bounded sandbox-abuse fixtures remain green. The Run/Submit controls are honest and fail closed: they send one authenticated request, show requesting/queued/unavailable state, and never fabricate a result while the approved execution relay is absent. Generated `.next`, Playwright output, `next-env.d.ts`, and `tsconfig.tsbuildinfo` were moved outside the repository to `/tmp/algocove-generated-20260918-final.CeXmz1`; only dependencies and environment files remain ignored. Task 25a and Task 29 remain PARTIAL because approved isolated-host execution, trusted result ingestion, result-category/resume browser evidence, and the security-owner sandbox decision are still open; F5 remains open for those gates and human authorization.

**Phase 5 latest revalidation (2026-09-18):** After the terminal-status slice, `pnpm verify` passes with 36 files and 142 unit/web/architecture tests; `pnpm test:integration` passes 20 live PostgreSQL tests across 16 migrations; `pnpm build` passes and exposes both `/api/practice/runs` and `/api/practice/runs/[runId]`; `pnpm test:a11y` passes 16 Chromium checks; `pnpm test:e2e` passes 1/1 draft recovery test; `pnpm test:conformance` passes 36 correct executions, 6 mutation rejections, and spoof/expected-value defenses; `pnpm test:sandbox` passes all 14 bounded abuse fixtures serially with no residue. Generated outputs were moved to `/tmp/algocove-generated-20260918-terminal.uDPKxu`; only dependencies and environment files remain ignored. Task 25a and Task 29 are still PARTIAL only at the approved isolated-host/security-owner and real browser result/resume evidence boundary.

**Phase 5 final local revalidation (2026-09-18):** After the bootstrap-resume and browser-result gates, `pnpm verify` passes with 36 files and 143 unit/web/architecture tests; `pnpm test:integration` passes 20/20 with terminal metadata persistence; `pnpm test:execution-browser` passes 5/5 fixture-backed Chromium result/resume cases; the previously verified production build, 16/16 accessibility checks, 1/1 draft-sync E2E, 36 conformance executions, and 14 serial sandbox fixtures remain green. Generated outputs were moved to `/tmp/algocove-generated-20260918-final2.y94Me1`, and the direct project tree is free of generated output directories/files; only dependencies and local environment files remain ignored.

**Phase 5 cancellation and final revalidation (2026-09-18):** Added the authenticated learner cancellation route and synchronized queued/cancelling UI flow. Current evidence is green: `pnpm verify` passes with 36 files and 145 tests; `pnpm test:integration` passes 20/20 across 16 migrations; `pnpm build` passes and exposes `/api/practice/runs/[runId]/cancel`; `pnpm test:a11y` passes 16/16; `pnpm test:e2e` passes 1/1; `pnpm test:execution-browser` passes 5/5 fixture-backed result/resume cases; `pnpm test:conformance` passes 36 correct executions, 6 mutation rejections, and spoof/expected-value defenses; `pnpm test:sandbox` passes all 14 bounded abuse fixtures serially. Generated build/test artifacts were moved to `/tmp/algocove-generated-20260918-cancel.bKE0uX`; the direct project tree has no generated output directories/files and retains only dependencies and local environment files as ignored entries. Task 25a and Task 29 remain PARTIAL because approved isolated-host execution, real trusted result ingestion, real browser result/resume evidence, the security-owner sandbox decision, and F5 human authorization remain external gates.

**Phase 5 execution-relay adapter gate (2026-09-18):** Added `apps/web/src/adapters/execution-client.ts` and wired the web composition root to create it only when `EXECUTION_ENABLED`, `EXECUTION_RELAY_URL`, and the server-only relay token are configured. Preparation validates the source checksum/length, sends no source, strictly accepts a run-bound descriptor-only outbox response, and keeps the dispatch token ephemeral; dispatch sends source only to the authenticated internal relay and cancellation is run-bound. Configuration requires relay URL/token pairing and production execution refuses to start without both plus the callback token. Focused adapter/configuration tests, `pnpm verify` (37 files, 149 tests), `pnpm test:integration` (20/20), and `pnpm build` pass. The relay service, approved isolated host, and real six-language result evidence remain external deployment gates; absent configuration still fails closed.

**Phase 5 adapter-browser revalidation (2026-09-18):** The adapter-enabled tree passes the browser gates serially: `pnpm test:a11y` 16/16, `pnpm test:e2e` 1/1, and `pnpm test:execution-browser` 5/5. The first parallel attempt was discarded because all configs intentionally use port 3100; no code failure was inferred from that contaminated run. Generated outputs were moved to `/tmp/algocove-generated-20260918-relay.gNTe6E`, and no generated output directories/files remain in the direct project tree.

**Phase 5 relay configuration hardening gate (2026-09-18):** Production execution now requires an HTTPS relay URL, while development/test allow HTTP for local internal fixtures; unsupported URL schemes and partial URL/token configuration fail during validated startup configuration. Focused configuration checks pass 10/10, and the full `pnpm verify` gate passes with 37 files and 150 tests.

**Phase 5 final browser revalidation (2026-09-18):** After rebuilding against the hardened configuration, the serial browser gates pass: `pnpm test:a11y` 16/16, `pnpm test:e2e` 1/1, and `pnpm test:execution-browser` 5/5. `pnpm build` passes and exposes the authenticated run, status, cancellation, and result-callback boundaries. Generated `.next`, `next-env.d.ts`, and Playwright `test-results` were moved to `/tmp/algocove-generated-20260918-final.ZUvq1v`; the direct project tree has no generated output directories/files. This closes the local Phase 5 implementation/revalidation slice, but not the external relay deployment, approved isolated-host execution, security-owner decision, real six-language result evidence, or F5 human authorization.

**Phase 5 execution evidence audit (2026-09-18):** Re-ran the independent execution gates: `pnpm test:conformance` passes 36 correct executions across six languages, rejects 6 mutation solutions, and rejects spoofed/expected-value verdicts; `pnpm test:sandbox` passes all 14 bounded abuse, resource, cancellation, signal, and teardown fixtures with no residue. These are qualified fixture/security evidence, not real learner-run evidence. The remaining unchecked Phase 5 items require deployment of the approved isolated host and relay, real six-language learner result/category/resume runs, the pending security-owner decision from Phase 4, and explicit human authorization for Phase 6.

**Phase 5 local environment run gate (2026-09-18):** Added the ignored root `.env` for local database/operator commands and aligned the workspace/app `.env.local` files with the role-separated PostgreSQL runtime and existing Clerk development keys. Removed blank relay placeholders that violated optional-secret validation; `EXECUTION_ENABLED=false` remains deliberate until the approved relay exists. `pnpm db:start`, `pnpm db:roles`, `pnpm db:migrate`, and `pnpm db:seed:practice` pass; `pnpm build` passes; `pnpm dev` returns `/api/health` 200 and `/api/readiness` 200 with database readiness. Next.js agent-file generation is disabled, and no `AGENTS.md`/`CLAUDE.md` clutter is created during the dev run.

**Phase 5 Task 29 browser repair and revalidation (2026-09-18):** Reproduced the reported UI failure in the actual localhost browser. The existing port-3000 process was a stale `pnpm start`, and the current dev server then exposed a real compile blocker: `@algocove/visualizer` was imported by the guided workspace but missing from `apps/web` dependencies. Added the workspace dependency, regenerated the valid lockfile, and restarted the configured dev server on port 3000. Browser evidence now passes for authenticated hint reveal, source/pseudocode recovery after navigation, reviewed trace completion through step 7, Python/JavaScript switching with Python draft preservation, and no post-fix page console errors. `pnpm typecheck`, `pnpm test:web` (39/39), and `pnpm build` pass. Run/Submit remains truthfully disabled while `EXECUTION_ENABLED=false`; Task 25a, Task 29, and F5 remain open for approved isolated-host result ingestion, real result/resume browser evidence, and human security authorization.

**Phase 5 review-remediation update (2026-09-19):** CodeRabbit findings are resolved without changing the external execution boundary: relay calls now have a five-second abort deadline; bootstrap preserves divergent learner-local recovery and immediately queues durable source/pseudocode writes; partial terminal result records fail closed instead of disappearing; trace rendering/replay reject duplicate-key and post-completion ambiguity; authored-hint race recovery matches both hint and problem version; and migration `0017_hint_kind_tier_constraint.sql` aligns database hint rows with the six-tier domain ladder. The design contract now has one sidebar navigation model and prohibits developer-local visual-authority paths. `pnpm test` passes 153 unit/web/architecture tests, `pnpm test:integration` passes 21 isolated PostgreSQL tests across 17 migrations, and typecheck/lint/format/docs/token/secret gates pass. Task 25a, Task 29, and F5 remain PARTIAL/open only for the existing approved-isolated-host, real learner result/resume browser evidence, security-owner decision, and human authorization gates.

**CI recovery update (2026-09-19):** The post-review GitHub Actions failure was traced to a pnpm 9-generated lockfile being consumed by CI's pnpm 12.4.2 and mutable sandbox-probe image tags drifting after the last successful gVisor matrix. The lockfile was regenerated with pnpm 12.4.2, and the candidate probe now uses the exact immutable image digests from passing run [35264360185](https://github.com/vsuman00/AlgoCove/actions/runs/35264360185). A local pnpm-12 frozen install and the six-language normal, hostile-boundary, and concurrent sandbox matrix pass. The next CI run remains the remote confirmation.

## Phase 0: Resolve gates and freeze the build contract

- [ ] Task 1: Approve product semantics and launch slice
- [ ] Task 2: Freeze the development toolchain and command surface
- [ ] Task 3: Define local adapter contracts and provider decision deadlines
- [ ] Task 4: Freeze privacy, retention, budgets, and pilot targets

### Checkpoint G0: Build authorization

- [ ] Tasks 1-4 are approved.
- [ ] A0-A2 and P0-P4 are accepted or explicitly narrowed.
- [ ] Human owner authorizes Phase 1 only.

## Phase 1: Establish the repository foundation

- [x] Task 5: Create root workspace and quality manifests — IMPLEMENTED; pnpm 12 lockfile metadata, release-age policy, and narrow `unrs-resolver` lifecycle-build approval now match CI, with clean frozen install, quality scripts, secret scan, and dependency audit passing.
- [x] Task 6: Create the minimal web application shell — IMPLEMENTED; routes, error boundary, production build, HTTP smoke checks, keyboard recovery, and browser accessibility checks pass.
- [x] Task 6a: Integrate approved design tokens and page-shell contracts — IMPLEMENTED for the Phase 1 shell; Tailwind token mapping, traceable Home/Workspace/Roadmap checklist, desktop/narrow shell review, and missing-asset tracking are complete. Full future screen fidelity remains phase-owned.
- [x] Task 7: Create package boundaries and architecture tests — IMPLEMENTED; import-boundary fixtures, architecture tests, and typecheck pass.
- [x] Task 8: Implement validated configuration and request primitives — IMPLEMENTED; focused configuration, ID/time, request-context, error-redaction, and secret-boundary tests pass.
- [x] Task 9: Establish PostgreSQL, pgvector, migrations, and integration harness — IMPLEMENTED; fresh isolated databases prove role bootstrap, pgvector, migrations, checksums, runtime readiness, DDL denial, bookkeeping denial, and rollback.

### Checkpoint F1: Foundation

- [x] All Phase 1 quality commands pass: `pnpm verify`, `pnpm test:all`, `pnpm build`, `pnpm test:integration`, `pnpm test:a11y`, and `pnpm security:audit`.
- [x] Architecture tests enforce import direction.
- [x] Web shell builds and database migrations pass from an empty isolated database.
- [x] Phase 1 technical implementation is complete; the prior F1 evidence is preserved. Human transition authorization remains a governance record, not an implementation claim.

## Phase 2: Identity, authorization, and durable platform primitives

- [x] Task 10: Integrate Clerk identity and actor context — IMPLEMENTED; verified Clerk session claims map to deterministic internal opaque learner IDs, roles are loaded from the server store, provider metadata is ignored, the Clerk CLI app is linked, development keys are locally configured, sign-in/up/session route fixtures pass, and the owner manually verified live sign-in/sign-up and the Clerk user record.
- [x] Task 11: Deliver learner onboarding and profile preferences — IMPLEMENTED; PostgreSQL learner/profile migrations, owner/version use cases, Clerk-backed API, Tailwind onboarding UI, invalid-input and cross-user tests, six deterministic anonymous browser accessibility checks, enabled-key build/liveness checks, and owner-verified authenticated profile use pass. Profile persistence is covered by the application path and isolated PostgreSQL tests.
- [x] Task 12: Implement privileged roles and authorization matrix — IMPLEMENTED; every role has an explicit permission set, negative learner checks pass, and content author/reviewer separation-of-duties is enforced.
- [x] Task 13: Implement idempotency, audit, and transactional outbox foundations — IMPLEMENTED; PostgreSQL-backed claims replay/conflict safely, audit rows are append-only, payloads redact source material, outbox writes participate in transaction rollback, and concurrent claim fixtures pass.
- [x] Task 13a: Establish privacy-safe observability before service integration — IMPLEMENTED; allowlisted correlation/error fields and bounded telemetry redaction are covered by canary tests.

### Checkpoint F2: Identity and platform integrity

- [x] Onboarding works end to end — the owner manually verified Clerk sign-up/sign-in and profile use; API, verified-Clerk route, application, and isolated PostgreSQL tests pass.
- [x] Cross-user and privilege negative tests pass.
- [x] Idempotency/audit/outbox concurrency fixtures pass.
- [x] Human owner authorizes Phase 3 by directing continuation after confirming authentication and profile completion.

## Phase 3: Governed curriculum, problems, and external references

- [x] Task 14: Implement versioned concept and curriculum graph — IMPLEMENTED; cycle-safe domain validation, required/recommended/related edges, immutable published PostgreSQL snapshots, and pinned-version resolution port pass unit and integration checks.
- [x] Task 15: Implement immutable content/problem lifecycle and provenance — IMPLEMENTED; original/licensed provenance, checksums, separated reviews, validation blockers, immutable published/retired versions, rights tombstones, and safe historical projections pass lifecycle and database checks.
- [x] Task 16: Define six-language problem manifests and semantic fixtures — IMPLEMENTED; exactly `python`, `javascript`, `typescript`, `java`, `cpp`, and `c` have distinct profiles/adapters, shared fixture IDs, limits contracts, and completeness validation.
- [x] Task 17: Implement external references and collection deduplication — IMPLEMENTED; allowlisted provider-specific HTTPS metadata URLs, review status, outbound navigation boundaries, and cross-collection membership deduplication pass malicious-host and overlap fixtures.
- [x] Task 18: Deliver content author/review/publish vertical slice — IMPLEMENTED as a fixture-backed admin preview; separate author/reviewer/publisher responsibilities, complete original candidate rights/reviews, six-language evidence, reviewed outbound metadata, and the Task 23 runnable-publication blocker are visible and accessible.

### Checkpoint F3: Governed content foundation

- [x] One original problem candidate has complete rights/reviews; runnable publication remains blocked until Task 23.
- [x] Six-language manifest completeness and external-link boundaries pass.
- [x] No third-party statement, solution, test, or credential is stored.
- [x] Human owner authorizes Phase 4 transition work by directing completion of the Phase 3 closure and Phase 4 readiness boundary on 2026-09-17.

**Manual F3 browser evidence (2026-09-17):** The current production build was loaded in Chromium at `/admin/content`; the candidate workflow was opened and visibly confirmed to show original provenance/rights, separate approved technical and pedagogical reviews, passed metadata validation, six language rows (`python`, `javascript`, `typescript`, `java`, `cpp`, `c`), reviewed outbound metadata, no-third-party-copy disclosure, and a disabled `Publish fixture (locked)` control with Task 23 as the blocker. The detail page had no horizontal overflow, no application console errors, and the official Chromium accessibility suite passed all 9 tests, including the 320px workflow check.

## Phase 4: Prove isolated six-language execution

**Entry status (2026-09-17):** Transition work is authorized. Task 19 must first complete the sandbox-selection spike, using the provider/sandbox decision criteria required by Task 3. No Phase 4 task is marked implemented until its acceptance criteria and evidence are complete.

- [ ] Task 19: Complete the sandbox selection spike — TECHNICAL EVIDENCE COMPLETE, SECURITY DECISION PENDING; final CI run [35264360185](https://github.com/vsuman00/AlgoCove/actions/runs/35264360185) ran the six-language matrix under explicitly selected gVisor `runsc`, and normal, hostile-boundary, and concurrent startup fixtures all passed. Default `runc` remains rejected for production until a security owner records approval, rejection, or a narrowed decision with threat-model evidence.
- [x] Task 20: Implement signed execution contracts — COMPLETE locally; schema, digest binding, Ed25519 signatures, key rotation window, expiry, result classification, replay identity, lease epoch fencing, tamper rejection, and compatibility tests pass. This does not close the unresolved Task 19 production sandbox decision.
- [x] Task 21: Implement execution-control admission and lifecycle — COMPLETE locally; internal admission/lifecycle, separate journal port, signed descriptor-only PostgreSQL relay, bounded claims/retries, and focused fault/concurrency tests pass. This does not close Task 19 or the later runtime/conformance gates.
- [x] Task 22: Build pinned runtime images for all six languages — COMPLETE; profiles, immutable base references, SBOM/provenance, smoke fixtures, and four clean local Docker Scout critical/high scans pass. Release run [35261137554](https://github.com/vsuman00/AlgoCove/actions/runs/35261137554) built and pushed all four GHCR profiles, passed the Trivy fixable critical/high gate, and passed keyless Cosign signing plus certificate identity/issuer verification.
- [x] Task 23: Prove semantic conformance across six languages — COMPLETE locally; one shared six-fixture manifest runs through six explicit adapters, 36 correct executions pass, six not-equal mutations are rejected by the trusted host judge, and lineage/spoofing/serialization checks pass. This does not override the Task 19 production sandbox blocker or authorize runnable publication.
- [x] Task 24: Pass sandbox abuse and execution-port contract gates — COMPLETE locally for the bounded fixture/control baseline; 14 abuse fixtures pass with no container residue, and Task 20/21 tests cover signed correlation, cancellation, fencing, teardown, and infrastructure classification. This does not approve Docker `runc` for hostile learner code while Task 19 remains open.

### Checkpoint F4: Execution safety

- [x] Six-language conformance is green.
- [x] Sandbox security and teardown gates are green for the bounded local fixtures and the remote gVisor candidate matrix.
- [x] Learner source may be privately stored but never executed in Next.js, general worker, browser origin or database host.
- [ ] Human security review authorizes Phase 5.

## Phase 5: Deliver the guided internal learning loop

- [x] Task 25: Implement learning-session and attempt state machines — COMPLETE; domain transitions, owner-scoped repository, optimistic concurrency, atomic language reset, focused state-machine fixtures, and live PostgreSQL ownership/race integration evidence pass.
- [ ] Task 25a: Connect real attempts to durable execution and trusted results — PARTIAL; the application port, configured HTTP execution-relay adapter, explicit Run/Submit orchestration, descriptor-only durable dispatch, exact result correlation, PostgreSQL run/observation persistence, persisted terminal status, authenticated learner cancellation, atomic assessment outbox commits, signed worker terminal handoff, authenticated result callback, idempotent replay handling, and a no-replacement reconciliation path for lost responses are implemented. The live PostgreSQL suite now exercises application request/result orchestration, pass/wrong/infrastructure classification, no-credit infrastructure handling, durable outbox persistence, replay, and lost dispatch handling; focused worker/control, callback-authentication, owner-scoped status, cancellation, adapter, and configuration fixtures also pass. Approved isolated-host execution and correct/wrong/compile/timeout/infrastructure language-matrix evidence remain open.
- [x] Task 25b: Implement recoverable source and pseudocode drafts — COMPLETE; domain/application contracts and PostgreSQL persistence for replaceable current snapshots, explicit revisions, optimistic conflicts, TTL, private ownership, recovery clearing, and Chromium reload/offline/reconnect/conflict/expiry/logout evidence pass.
- [x] Task 26: Implement structured pseudocode and readiness evidence — COMPLETE at the contract/application/database layer; structured fields are separate from executable source, explicit revisions are append-only, readiness is authored-evidence based, and owner/tutor-context negative tests plus live PostgreSQL persistence pass. The learner-facing workspace composition remains part of Task 29.
- [x] Task 27: Implement trace protocol and accessible renderer — COMPLETE for the bounded array/two-pointer protocol and renderer component; deterministic replay/transcript, invalid-event fallback, provenance disclosure, keyboard controls, reduced-motion-safe behavior, and component tests pass. Task 29 will compose it into the learner workspace.
- [x] Task 28: Implement deterministic hint ladder and authored fallback — COMPLETE at the domain/application/database layer; authored tiers, mode ceilings, cumulative exposure across attempts, idempotency, write-before-display, no-AI fallback, and premature solution-review rejection pass unit and live PostgreSQL tests. Task 29 will compose the panel without preloading locked content.
- [ ] Task 29: Complete the first end-to-end internal problem workspace — PARTIAL; the guided workspace route, six-language editor, structured pseudocode fields, reviewed trace, authored-hint entry point, learner-scoped private recovery, responsive layout, authenticated workspace/draft/pseudocode/hint synchronization, configured HTTP Run/Submit relay boundary, owner-scoped queued/completed status polling, synchronized cancellation, bootstrap resume of committed run state, terminal-category rendering, and fail-closed execution state are implemented. Focused component/route/adapter checks, production build, 16 Chromium accessibility checks, anonymous fail-closed recovery, authenticated-fixture reload recovery, and the live application execution boundary pass. Real isolated-host Run/Submit result ingestion, correct/wrong/compile/timeout/infrastructure browser evidence, and real browser resume/failure evidence remain open behind Task 25a and the security-owner sandbox decision.

### Checkpoint F5: Learning kernel milestone M2

- [ ] One original problem completes the entire internal learning loop in six languages.
- [ ] Hint, visualization, pseudocode, execution, and resume failure cases pass.
- [x] Accessibility critical path passes — 16 Chromium accessibility checks pass, including the guided workspace, narrow-screen reflow, reduced-motion shell, authenticated recovery, and synchronization flows.
- [ ] Human owner authorizes Phase 6.

## Phase 6: Mastery, review, recommendation, and progress

- [ ] Task 30: Implement append-only mastery evidence and projection v1
- [ ] Task 31: Implement spaced review and transfer scheduling
- [ ] Task 32: Implement explainable next-action recommendation
- [ ] Task 33: Implement separate progress and consistency views

### Checkpoint F6: Evidence-driven learning

- [ ] Mastery is reproducible from evidence.
- [ ] Reviews and recommendations are deterministic and explainable.
- [ ] Progress does not confuse activity with mastery.
- [ ] Human owner authorizes Phase 7.

## Phase 7: Configurable roadmap planning

- [ ] Task 34: Implement roadmap intent and immutable plan versions
- [ ] Task 35: Implement deterministic baseline scheduler
- [ ] Task 36: Implement plan validator and replan policy
- [ ] Task 51: Implement budgets, quotas, rate limits, and circuit breakers
- [ ] Task 37: Add bounded AI plan proposal and learner plan UI

### Checkpoint F7: Adaptive roadmap

- [ ] Every supported horizon produces a feasible, explainable plan or reasoned rejection.
- [ ] AI-off mode remains complete.
- [ ] Replanning preserves history and avoids catch-up overload.
- [ ] Human owner authorizes Phase 8.

## Phase 8: Outbound LeetCode practice handoff

- [ ] Task 38: Implement readiness gate and explicit practice bypass
- [ ] Task 39: Implement outbound opening and learner-confirmed journal
- [ ] Task 40: Prove the companion journey end to end

### Checkpoint F8: Adaptive practice companion milestone M3

- [ ] Timeboxed plan to independent external practice works.
- [ ] No synchronization, scraping, automation, or verification claim exists.
- [ ] Broken-link, bypass, and self-report semantics are explicit.
- [ ] Human owner authorizes Phase 9.

## Phase 9: Grounded retrieval and tutor

- [ ] Task 41: Extend the existing relay for content and AI jobs
- [ ] Task 42: Implement pedagogical derivation and versioned indexes
- [ ] Task 43: Implement hybrid retrieval and immutable evidence packages
- [ ] Task 44: Implement provider-neutral tutor and validate-before-display delivery
- [ ] Task 45: Implement tutor/retrieval evaluation and promotion gate
- [ ] Task 45a: Activate and evaluate the live roadmap proposal adapter

### Checkpoint F9: Grounded tutor

- [ ] Authored lessons/hints still work with worker and provider disabled; new code runs show queued/unavailable status without false success.
- [ ] Retrieval permission and citation tests pass.
- [ ] Critical hint-leak and prompt-injection cases have zero bypasses.
- [ ] Human owner authorizes Phase 10.

## Phase 10: Build the pilot curriculum and accessibility evidence

- [ ] Task 46: Author the arrays/hashing pilot bundle
- [ ] Task 47: Author the two-pointers pilot bundle
- [ ] Task 48: Author the sliding-window pilot bundle
- [ ] Task 49: Author the stack pilot bundle
- [ ] Task 50: Validate pilot accessibility and collection mapping

### Checkpoint F10: Pilot learning product milestone M4

- [ ] Four pattern bundles pass all six-language and content gates.
- [ ] Guided, roadmap, external handoff, review, and tutor paths work together.
- [ ] Accessibility critical journeys pass manual and automated review.
- [ ] Human owner authorizes Phase 11.

## Phase 11: Privacy, observability, resilience, and operational readiness

- [ ] Task 52: Implement privacy export, deletion, and retention workflows
- [ ] Task 53: Implement production-safe telemetry, SLOs, and alerts
- [ ] Task 54: Rehearse local restore, rollback, and incident procedures

### Checkpoint F11: Operational assurance

- [ ] Privacy, budget, telemetry, alert, restore, and incident gates pass.
- [ ] Known failures degrade safely and leave auditable state.
- [ ] Actual evidence is separated from proposed targets.
- [ ] Human owner authorizes Phase 12.

## Phase 12: Hosted pilot release

- [ ] Task 55: Provision the approved single-region staging environment
- [ ] Task 55a: Integrate hosted authentication and privileged session controls
- [ ] Task 56: Implement CI/CD, migration, image, and configuration promotion
- [ ] Task 57: Execute the hosted-pilot readiness gate

### Checkpoint F12: Hosted pilot milestone M5

- [ ] Pilot readiness is approved by the named human owners.
- [ ] The status is `hosted pilot`, not `enterprise production-ready`.
- [ ] Implementation, validation, deferred, and blocked areas are reported separately.
- [ ] Phase 13 has a proposed outline below; its detailed per-track batches and release criteria require approval before execution.

## Phase 13: Expand curriculum and qualify full-course coverage

- [ ] Task 58: Approve full-track taxonomy and coverage budgets
- [ ] Task 59: Deliver reviewed problem and visualization batches
- [ ] Task 60: Qualify coverage and learning claims before broad release

### Checkpoint F13: Coverage-qualified course milestone M6

- [ ] Detailed batch plan and supported curriculum breadth are approved.
- [ ] Every advertised track/sheet has truthful coverage and feasibility evidence.
- [ ] Broad release has a human readiness decision; interview or job outcomes are not guaranteed.
