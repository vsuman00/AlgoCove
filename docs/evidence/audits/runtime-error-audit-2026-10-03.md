# GUI, frontend, backend and CI error audit

**Date:** 2026-10-03, Asia/Kolkata. **Source baseline:** 2b49b624bb63a2ddee87ec91a06672a0c89ac53a on main.

**Direction:** The owner requested diagnosis and a full report before further implementation. This audit changes documentation and diagnostic artifacts only. No application fix, dependency change, credential change, deployment or VM provisioning was performed after that instruction.

## 1. Findings at a glance

The application is not currently verified as a complete working Phase 1–7 learner journey. The current real execution CI gate fails. Local pages render, but the local database is offline and execution is disabled. Several frontend recovery states also need correction.

These are separate problems with different fixes. A successful build or a styled HTTP 200 page does not demonstrate authenticated persistence or execution.

| ID | Priority | Finding | Evidence status |
|---|---|---|---|
| E1 | P1 | Actual signed execution callbacks fail before token comparison because the harness passes an empty optional database URL | Confirmed in current CI and minimal configuration reproduction |
| E2 | P1 | Local PostgreSQL is unreachable, blocking persisted learning after authentication | Confirmed readiness 503 and direct connection refusal |
| E3 | P1 | Python recovery overrides a requested TypeScript workspace | Reproduced in actual UI with explicit fixture authentication |
| E4 | P1 | Initial workspace synchronization failure has no clear server failure state | Reproduced with a deliberately unavailable workspace response |
| E5 | P2 | Execution is disabled and the isolated relay is unconfigured locally | Confirmed local configuration; feature unavailability, not a compiler defect |
| E6 | P2 | Copied environment example fails its own typed configuration schema | Reproduced directly; blank Clerk keys rejected |
| E7 | P2 | Web and operator commands load different environment files | Confirmed startup log and loader code; fresh-checkout consequence requires a separate clean-environment check |
| E8 | P2 | Signed-out Planning, Reviews and Progress offer reload as the main body action | Confirmed browser screenshots and source |
| E9 | P2 | Queued execution polling has no stalled-delivery state or overall UI deadline | Confirmed source; current callback failure demonstrates the resulting indefinite queued state |
| E10 | P2 | Passing browser fixtures do not cover the deployed Next API/auth/runtime composition | Confirmed test architecture; current real gate failure remains visible |
| E11 | P2 | Skipped runtime spike still uploads historical evidence as a job artifact | Confirmed current CI steps and checked-in report |
| E12 | P2 | Backend connection failures and diagnostic correlation are inconsistent | Confirmed error-mapping/trace source; signed-in HTTP behavior is not reproduced here |
| E13 | P2 | Workspace/catalog remains tied to one hardcoded reviewed problem | Confirmed route, UI and host judge source; broader content behavior is a capability limitation |
| E14 | P2 | Full development dependency audit has an explicitly excepted high advisory | Confirmed current quality-job warning; no remediation claim |
| E15 | P3 | Development effects, separate session consumers and retries multiply visible error lines | Confirmed local network samples and current CI log counts |
| E16 | P3 | Local Node/pnpm differ from the project toolchain | Confirmed version checks; not the cause of current callback failure |
| E17 | P3 | Native image build emits Python/package-removal errors while succeeding | Confirmed C/C++ image build logs and permissive removal commands |
| E18 | P3 | Completion documents and runtime evidence need reconciliation | Confirmed task/evidence state and current failing gate |

P1 means a core journey is blocked or the wrong workspace can be selected. P2 means recovery, coverage or trustworthy completion evidence needs repair. P3 means development noise, reproducibility or documentation needs correction. These are engineering priorities, not claims of security severity.

## 2. What was inspected and reproduced

- Actual Next development server using the existing apps/web/.env.local; no browser API interception in the broad route audit.
- Eleven destinations at 1440 and 320 pixels: 22 page samples. All returned HTTP 200, with zero uncaught page exceptions and zero document horizontal overflow. Stylesheets loaded; desktop Planning, mobile Reviews and mobile Workspace screenshots were visually inspected.
- Ten actual anonymous API GETs, including health, readiness, session, profile, Home, Reviews, Progress, planning and content administration.
- A direct read-only database connection attempt using the configured runtime URL. Both IPv6 and IPv4 loopback connections were refused on port 54329.
- Minimal configuration comparisons for empty versus omitted DATABASE_ADMIN_URL, plus parsing the checked-in .env.example.
- Two isolated browser cases comparing TypeScript navigation with and without Python recovery. Authentication and the unavailable workspace API were explicit fixture inputs. These cases diagnose frontend behavior; they do not establish live authenticated functionality.
- The current three CI jobs, their logs, step results and real-loop artifact on the exact baseline commit.
- Inventory of all 26 API route-handler files, the shared frontend/auth/runtime compositions, execution delivery path, database connection/error boundaries and relevant Phase 1–7 plans/design/evidence contracts.

The browser was signed out. Clerk's actual sign-in and sign-up forms loaded with development keys; no account was created and no credentials were submitted. Authenticated production UI states, a live signed-in persistence journey, real guardian/policy work, later phases and deployment are outside this audit's measurements. No claim is made that every possible edge case has been exercised.

Evidence files: [browser requests/states](../artifacts/runtime-error-audit-2026-10-03/browser.json), [isolated recovery cases](../artifacts/runtime-error-audit-2026-10-03/language-recovery.json), [configuration/DB facts and route inventory](../artifacts/runtime-error-audit-2026-10-03/facts.json), [CI excerpt](../artifacts/runtime-error-audit-2026-10-03/ci-failure-excerpt.txt), [actual failed loop artifact](../artifacts/runtime-error-audit-2026-10-03/real-loop-failure.json).

## 3. Current CI failure: exact causal chain

Current run: [37098737102](https://github.com/vsuman00/AlgoCove/actions/runs/37098737102).

1. The disposable Linux harness creates/migrates/seeds PostgreSQL, builds the actual UI, starts the isolated gVisor host and dispatches Python execution.
2. At 05:09:32 UTC the host finishes with category wrong_answer, phase run and teardownConfirmed true. This wrong answer is intentional test input, not an infrastructure failure.
3. The host delivers the signed result to the actual callback handler.
4. The callback logs stage authenticate_callback and errorName ConfigError, then returns HTTP 500 / internal_error.
5. The database terminal category remains null. Browser status remains queued. The first scenario expires after its 60-second result wait; the cancellation scenario also fails waiting for its terminal UI label.
6. Repeated delivery retries encounter the same invalid process environment. There are 184 callback-error log lines in this job, rather than 184 independent defects.

**Root cause E1:** [scripts/test-real-learning-loop.ts](../../../scripts/test-real-learning-loop.ts), line 140, supplies DATABASE_ADMIN_URL as an empty string to Vitest. [packages/config/src/schema.ts](../../../packages/config/src/schema.ts), line 43, accepts an optional PostgreSQL string, meaning absent or valid; empty is invalid. [loadConfig](../../../packages/config/src/index.ts), line 197, directly parses that environment. [The callback](../../../apps/web/app/api/internal/practice/results/route.ts) loads the entire validated configuration in loadCallbackToken before comparing its bearer token, parsing the signed result, querying a run or persisting an observation.

Minimal reproduction: a valid test environment with DATABASE_ADMIN_URL empty throws ConfigError with two issues for that key; the identical environment with the key omitted parses successfully. This establishes the specific failure, independent of Docker speed, signatures or PostgreSQL privileges.

**Required fix:** Construct the test process environment with operator/migration-only variables removed, and validate the assembled callback/runtime configuration before starting the expensive browser/host journey. Decide one consistent policy for intentionally blank optional settings across the app and tests. Preserve rejection of malformed nonempty URLs, secret pairing and production privilege separation.

**Verification required:** A focused regression for the real assembled harness environment, followed by the mandatory Linux six-language journey. Confirm signed callbacks return 200, terminal records commit, UI receives each actual category, cancellation succeeds, and crash/missing-image checks execute. Increasing waits cannot correct a deterministic configuration error.

The current artifact contains one dispatched Python run with terminalCategory and classification both null. It contains no completed six-language outcomes. The later five languages, host-crash sequence and missing-image matrix have not been proven against this baseline.

## 4. Local backend and environment

### E2 / E5: the page shell starts while essential services are unavailable

Actual local responses:

| Endpoint | Result | Meaning |
|---|---|---|
| /api/health | 200, live | Next process is alive |
| /api/readiness | 503; configuration ok, database unreachable | Persisted application is not ready |
| /api/auth/session | 401, unauthenticated | Audit browser has no authenticated session |
| Profile, Home, Reviews, Progress, planning, content reads | 401 | Authentication boundary correctly rejects anonymous private reads |

DATABASE_URL points to localhost:54329; no PostgreSQL listener was present before the audit. A direct SELECT 1 connection attempt produced ECONNREFUSED for both ::1 and 127.0.0.1. No SQL reached a server, so database contents, installed migrations and role grants cannot be certified for the user's current local installation.

Both local web environment copies have EXECUTION_ENABLED false, TUTOR_ENABLED false and no execution relay URL. The learner route supplies that flag to the workspace; Run/Submit controls are disabled and the UI says execution is temporarily unavailable. The API also refuses an absent relay. AI-off planning is intentionally implemented; missing AI is not the cause of these failures.

**Required fix:** Establish a reproducible local application setup with the PostgreSQL roles, 25 migrations and reviewed practice/review seed. Verify readiness before advertising private learning as usable. For actual Run/Submit testing, explicitly connect the approved isolated Linux host and signed callback configuration. Keep learner source execution in that boundary. Any temporary execution VM must be removed after tests as previously instructed. This audit created no VM.

### E6 / E7: inconsistent configuration loading

The environment example declares NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY as empty. Its comments say these may be left unset. Directly parsing that file with loadConfig produces ConfigError for both keys because the schema uses min(1). The Clerk-specific configured check, however, treats blank keys as absent. The app therefore has two different meanings of an unconfigured optional service.

The root quick-start copies .env.example to root .env, but pnpm dev runs Next in apps/web; this actual startup reports loading apps/web/.env.local. Operator CLIs load root .env through [cli-support.ts](../../../packages/db/src/cli/cli-support.ts). There are currently three local environment files. Root and web values can drift; the web copy does contain the correct Next publishable-key name now, so the old VITE key name is not the immediate current auth failure.

Configuration comments also promise validation once at startup, while practice config validation is lazy, readiness validates on request, and identity composition parses its own subset. This delays discovery and yields different failure categories.

**Required fix:** Define and test a shared local environment-loading contract for web/operator/test processes, with intentional secret scope separation. Add a redacted local preflight reporting auth, DB/schema/seed and execution connectivity. Validate the documented copied example and partial-key cases. Do not solve this by adding a fixture learner or silently weakening production requirements.

### E12: inconsistent backend failure categories and tracing

[Identity composition](../../../apps/web/src/auth/clerk-adapter.ts) creates its own database pool. The practice/planning/mastery/content compositions use the shared practice runtime. Raw driver errors generally reach toHttpStatus/toErrorEnvelope as unknown errors, becoming HTTP 500 / internal_error; the session route catches any non-authentication error and returns 503 / session_unavailable. The same database outage can therefore look different between screens.

Several response wrappers use req_0000000000000000 when no trace header is supplied. Onboarding's error handler uses that constant even when a context exists. Outside the newly instrumented callback, a failed API response does not consistently carry a matching safe server failure record. A caller-generated trace is not consistently propagated from request context.

The shared database pool sets query/statement timeouts but omits connectionTimeoutMillis. A refusal is quick in this local audit; slow/drop connections and pool-acquisition waits are a source-level risk requiring a bounded network reproduction. Readiness catches all database query errors as unreachable, including missing healthcheck-function/schema errors; its schema_missing branch only handles a successful query returning no row.

**Required fix:** Normalize connectivity/schema/configuration failures at their boundary, preserve valid business/auth error categories, generate and propagate request correlation, log safe stages/codes, and bound connection acquisition. Test a refused DB, schema missing, permission failure and slow connection independently. Signed-in HTTP outcomes for these cases were not measured here.

## 5. GUI and frontend findings

### E3: wrong language selected on recovery

[problem-workspace.tsx](../../../apps/web/src/components/practice/problem-workspace.tsx), lines 154–155, reads recovery for Python after authentication and sets language Python regardless of the initial query language.

Reproduction with the actual UI: open /learn/arrays-two-pointer?language=typescript with a fixture session. Without Python recovery, the selector and workspace POST use TypeScript. With a Python recovery entry for that same learner, both use Python and the Python draft appears. The server failure input is identical between cases.

**Required fix:** Recover the selected language while preserving separate learner/language draft keys and honoring recommended-language links. Verify all six requested languages against saved drafts in other languages, reload and retry. No source may migrate into the wrong language draft.

### E4: first workspace failure is not surfaced clearly

The workspace fetch catch at line 261 updates server_pending only when remoteWorkspace.current already matches the language. On first initialization the reference is null, so a 503 leaves the frontend without that transition. The local recovery effect then displays Local recovery saved.

Both isolated cases deliberately returned workspace 503. The page showed Private recovery · Local recovery saved and Run or submit your code to see checked results. Local saving really occurred, but no server workspace existed. That local claim does not explain the failed server setup. Later hint/run actions return generic recovery messages because the remote reference is null.

**Required fix:** Track initial server workspace loading/unavailable separately from local recovery. Show a visible workspace retry and preserve edits. Distinguish initial outage, save conflict, stale response and retry success; do not label local recovery as a server commit.

### E8: signed-out screens look unfinished

The actual Planning page hides its form when the authenticated context cannot load, leaving a sign-in message and Reload saved preferences. Reviews and Progress show a sign-in message with Try again. The shell's sign-in control works, but these page bodies do not provide a direct contextual sign-in action. Reloading while still anonymous repeats the same 401.

**Required fix:** Use an explicit signed-out state with a contextual sign-in action and a return destination; reserve retry for recoverable service/network failures. Verify 401, role-denied 403, initial 503, empty authenticated state and successful populated state separately.

Screenshots: [Planning desktop](../artifacts/runtime-error-audit-2026-10-03/_plan-1440.png), [Reviews mobile](../artifacts/runtime-error-audit-2026-10-03/_review-320.png), [Workspace mobile](../artifacts/runtime-error-audit-2026-10-03/_learn_arrays-two-pointer-320.png). These are engineering evidence, not owner-approved visual baselines. Mobile navigation scrolls within its own rail; the no-overflow measurement is for the document and does not imply every destination is simultaneously visible.

### E9 / E15: endless waiting and repeated request noise

Queued runs poll every 500 ms with no overall UI stall/deadline state. During the current callback failure, the run remains queued until the test gives up. A general request failure replaces execution state with unavailable and loses the displayed run identity, weakening recovery for a run that may still be executing. Do not manufacture a terminal result or permit an unsafe duplicate submission to remedy this.

The local dev server enables React Strict Mode. Effect setup/cleanup repeats in development; some requests are aborted and some private reads are duplicated. The workspace also has a session read in addition to the shared staff navigation session read. The anonymous browser sees expected 401 resource-console messages on private APIs and Clerk's development-key warning. No uncaught page exception, HMR-origin rejection or CSS load failure occurred in these current samples.

**Required fix:** Share session state across consumers; avoid protected data reads once anonymous status is known, while retaining server authorization. Make effects abort-safe and idempotent. Provide bounded stalled-result feedback that preserves run identity, source binding and safe cancellation/resume. Verify stuck delivery, network interruption, late terminal response and navigation/reload. Keep useful retries and React development checks; hiding warnings does not fix the service failure.

### E13: fixed problem scope and content wiring

The page route accepts only arrays-two-pointer; the workspace API maps that slug to one fixed problem version. The frontend embeds its statement/starter defaults; authenticated starter/draft recovery uses the server response. The isolated judge explicitly accepts the original container-problem manifests. New administrative publications do not automatically produce a learner route or executable harness. An unknown problem currently renders an unavailable page with HTTP 200 rather than a not-found response.

This is not evidence that the existing reviewed problem is fake. It is a real bounded implementation with limited content wiring. It does prevent a claim that arbitrary newly published course problems are usable end to end.

**Required fix:** Make the supported content capability explicit, bind learner reads to published versioned content and define the publish-to-learner/harness boundary. Verify retirement, missing language, unknown slug and stale pinned version. Keep full-course authoring and later-phase features outside the owner's current Phase 1–7 repair scope unless separately authorized.

## 6. CI, test evidence and terminal noise

### Current gate results on the audited commit

| Gate | Current result | What it proves / does not prove |
|---|---|---|
| Formatting, ESLint, root/web/worker TypeScript, tokens, docs and secret scan | Pass | Static/repository checks; no authenticated runtime guarantee |
| Unit/web/architecture | 239 pass, 50 files | Logic, component/route seams and dependency boundaries |
| PostgreSQL integration | 62 pass; 2 real-loop tests skipped in quality job | Actual disposable DB contracts; the separate real-loop job must pass |
| Production build | Pass | App compiles; not service readiness |
| Accessibility browser checks | 30 pass | Automated checks and tested keyboard/layout states; many explicit response fixtures |
| Roadmap/offline browser journeys | 3 pass | Fixture-backed browser state/interaction coverage |
| Production dependency audit | Pass | Current quality-run audit result |
| Full dependency audit | Pass with one explicit high dev advisory exception | Not a clean full dependency tree |
| Image builds/smokes, six-language conformance and bounded abuse | Pass | Adapter/container gates in the execution-contract job |
| gVisor installation/smoke | Pass | Selected runtime starts on the runner |
| Real six-language guided journey and recovery | 2 fail | Current release-blocking callback error |
| Candidate gVisor matrix after real journey | Skipped | No fresh matrix result on this commit |
| Current local browser route inspection | 22/22 rendered | Anonymous/current environment only |

### E10: seams explain why many tests pass while the real journey fails

Accessibility, roadmap/offline and execution-category browser tests intercept selected APIs with explicit responses. They are valid UI tests but cannot catch every runtime configuration, database, middleware or callback integration error.

The mandatory real-loop test uses real route handlers, real PostgreSQL repositories, the actual isolated host and signed result delivery. It replaces actor authentication and practice runtime composition, bridges imported handlers through a local HTTP server, and redirects browser API traffic from the production Next UI to that bridge. Consequently, even a future pass will not establish live Clerk cookies, Next middleware and actual production route composition end to end. Current tests also stop at the first failure in each large scenario, leaving later checks unexecuted.

**Required fix:** Retain useful focused tests and the mandatory real-host gate. Add an assembled-configuration preflight and a separate controlled actual-Next API/authenticated persistence smoke. Give scenario reports explicit passed/failed/not-executed status, source commit, environment and cleanup results. Do not reduce assertions or replace the failing actual callback with a fixture to obtain green CI.

### E11: historical artifact uploaded after skipped work

The candidate-runtime spike step was skipped after the real-loop failure. Its upload step nevertheless succeeded because it uses always() and uploads an existing tracked report. That checked-in report is dated 2026-09-17 and describes a rejected default-runc baseline. It is not evidence of a new gVisor matrix on this commit.

**Required fix:** Produce runtime evidence in a fresh run-specific output location with commit/time/runtime/result metadata. Upload current failure diagnostics if needed, but never present a checked-in historical report as an executed gate. Assert evidence freshness and show skipped work explicitly.

### E14 / E16 / E17: other visible warnings and errors

- The quality job reports GHSA-vfj7-8cjw-p6xm in development-only braces@3.0.3 through eslint-config-next → Next ESLint plugin → fast-glob → micromatch. The audit record has no published patch. The current scanner narrowly permits that exact finding and emits a warning; production findings and changed/additional full-tree findings still fail. Keep it open and reassess remediation; no dependency fix was done in this audit.
- Local Node is 26.5.0 and global pnpm is 9.15.9; the project pins pnpm 12.4.2 and CI uses Node 22. Older pnpm is incompatible with the current multi-document lockfile. Use the declared toolchain for reproduction. This does not explain the proven callback ConfigError.
- Current CI includes Node SQLite experimental warnings, a url.parse deprecation warning and a pnpm action runtime deprecation warning. They are not failed assertions; dependency/toolchain ownership should be traced before changes are proposed.
- The C/C++ image removes packages with dpkg --purge --force-depends and explicitly ignores failures. Its build prints Python missing-encodings errors and dependency-removal complaints while the image build succeeds. These lines originate in package removal from the native image, not the learner Python run. Replace permissive image cleanup with a verifiable minimal build/removal strategy and assert final compiler/runtime contents before suppressing noise.

### E18: documentation reconciliation

The product/UI task card already leaves U6 and U8 open; they must remain open. Some evidence documents still count 238 tests rather than the current 239. Historical F5/F6/F7 closure and old passing matrices do not override the current failed real-loop run. ARCHITECTURE.md also retains an unqualified architecture-only/no-implementation baseline, despite substantial subsequent implementation; it needs an explicit historical/current distinction.

**Required fix:** Update current evidence and task summaries only after the relevant gates run. Preserve original dated evidence and owner decisions. Do not bulk-check detailed plan boxes or visual approvals solely from test counts.

## 7. Repair order and acceptance evidence

| Order | Work to perform after report review | Acceptance evidence |
|---|---|---|
| 1 | Fix E1/E6/E7 configuration semantics and harness assembly | Focused failing reproductions become passing; malformed values and privilege separation remain enforced; local preflight is accurate |
| 2 | Restore a reproducible local DB/schema/seed setup and verify auth/runtime composition | Readiness 200; actual signed-in profile/planning/review/progress writes survive reload; no fixture identities/data on product routes |
| 3 | Fix E3/E4 workspace language and initial synchronization state | Six-language navigation/recovery matrix; initial API outage visibly recoverable; edits preserved; server-success state only after real success |
| 4 | Improve E8/E9/E15 page recovery, session requests and execution waiting | Desktop/mobile sign-in/403/503/empty/success states; preserved active run identity; safe late result/cancel/reload behavior |
| 5 | Repair E10/E11 CI evidence composition and freshness | Mandatory actual Linux callback journey and host-recovery checks pass; later cases report execution status; fresh runtime matrix executes; cleanup confirmed |
| 6 | Address E12/E13 backend diagnostics and supported content path | Stable connection/schema/auth errors, bounded waits, correlatable logs, published-version/retirement/missing-route checks |
| 7 | Reassess E14/E16/E17 warnings and reconcile E18 docs | Exact toolchain, explicit advisory status, image contents verified, current evidence reconciled without invented approvals |

Final regression requirements remain repository verification, disposable PostgreSQL integration, production build, accessibility, roadmap/offline journeys, execution-category UI tests, actual six-language Linux guided execution, image/conformance/abuse/runtime gates, and actual local desktop/mobile application journeys. Code changes should be grouped around these proven causes and verified independently before broad reruns.

## 8. Limits and resource cleanup

The underlying signed-in app behavior with the user's real account was not inspected. Local DB schema/data state is unknown because the server is offline. The four intermediate viewport checks, assistive technology beyond automated checks, arbitrary network-blackhole behavior, full catalog semantics and every possible race remain unverified. No blanket claim that everything works or every edge case is covered is justified.

The failed real-loop CI job ran its always-cleanup step successfully; logs confirm its PostgreSQL container, network and volume were removed. The quality job has no explicit database teardown step; its GitHub-hosted runner is disposable. This audit provisioned no VM and made no deployment. The temporary local web server used for this audit is stopped at handoff; screenshots and redacted diagnostic data remain as evidence. Application source and existing local environment files were preserved.


## Implementation follow-up (2026-10-03, in progress)

The owner subsequently authorized repairs using Ponytail. The diagnosis above remains the original baseline; these changes do not turn historical failed or skipped gates into passes.

- E1/E6: optional blanks are consistently absent; nonempty malformed values, Clerk pairing and production privilege rules still fail. The real-host harness removes operator-only variables and validates its assembled runtime environment.
- E2: an isolated native PostgreSQL 17 cluster with pgvector was started for localhost validation because Docker Desktop is unresponsive. All 25 migrations and the reviewed seed are applied. No execution VM was created. This test service does not prove the user's Docker setup works.
- E3/E4/E8: requested-language recovery is preserved, initial workspace failures are visible and block execution, and signed-out learning pages expose a sign-in action. A further real recovery race was found and corrected: only the recovery writer may report a saved local edit.
- E7/E15: app-local/exported environment settings take priority over root development fallbacks; root operator secrets stay outside the web process. Page data shares the server-owned session. Actual localhost inspection also found an early signed-out read before Clerk restored its session; the app refreshes when Clerk loads or its account changes and remounts private state across account identities.
- E9: interrupted polling retains run identity, supports status retry/cancellation, blocks duplicate execution, uses bounded fetches and backs off before suspending after two minutes.
- E11: current spike reports have a fresh temporary path, commit/run provenance and upload only after the step actually runs. Quality-job database cleanup runs on failure too.
- E12: database connection waits are bounded; readiness distinguishes absent schema from unreachable service. Recognized transport/database outages produce safe retryable 503 envelopes; programming errors remain 500. Request correlation is safe and unique, with one value shared between logs and responses.
- E13: unknown problem paths now use Next's 404 flow. Dynamic publication, execution capability and retired public statements still require further repair and validation.
- E14: the unpatched development-only braces advisory remains open. No vulnerability assertion or lint rule was removed to hide it.
- E17: Python packages are removed with dependency-aware apt ordering before library pruning. Masked purge failures and deletion of package-maintainer metadata were removed. The updated image still requires an actual Linux image build and conformance run.
- Browser suites have independent artifact directories; parallel runs previously deleted each other's traces. Assertions remain intact.

Verified interim results: 246 repository tests; 63 PostgreSQL tests with two Linux-only scenarios explicitly skipped locally; production build; 30 accessibility browser checks; three roadmap/offline journeys; five execution-category browser checks. Subsequent source changes require fresh gates. The same-account Clerk refresh also exposed a preferences overwrite: fresh reads reset an unsaved start date. Reads now follow account ownership rather than transient refresh status, and the full roadmap journey plus three targeted repetitions pass without changing deadline assertions. Authenticated review and progress reads were observed through actual Next/Clerk/PostgreSQL on localhost. The owner chose to sign in personally instead of authorizing a disposable Clerk account; no Clerk account was created or deleted.

The repaired current-head mandatory Linux learning loop, current spike, image changes, final regression counts, cleanup and publication remain pending. Phase 7 is not marked complete.


## Subsequent repair status

The owner authorized implementation after this diagnosis. See [runtime repair evidence](./runtime-repair-evidence-2026-10-03.md) for current corrections, actual authenticated localhost persistence, green Linux execution evidence and remaining limits. The preceding sections describe the audit baseline, not the current repaired runtime.
