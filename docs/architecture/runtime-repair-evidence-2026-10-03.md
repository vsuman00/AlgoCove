# Runtime repair evidence — 2026-10-03

## Scope and baseline

The owner authorized implementation after the [E1–E18 diagnosis](runtime-error-audit-2026-10-03.md), using Ponytail. This record supersedes the audit's current-status statements, not its historical observations. Scope is the implemented product through Phase 7. No deployment or later-phase curriculum implementation is included.

## Repairs and regression coverage

| Area | Implemented correction | Evidence |
|---|---|---|
| Configuration and callback | Blank optional settings are absent; malformed nonempty settings still fail. Real-host harness removes operator credentials and validates assembled configuration. Development root fallbacks respect app/exported settings and exclude operator credentials. | Configuration, environment, runtime and real-loop tests |
| Local database | Native PostgreSQL 17 with pgvector, all 25 migrations and reviewed seed; Docker Desktop remains unresponsive. Connection deadlines and missing-schema readiness classification are explicit. | Actual localhost reads/writes; 63 PostgreSQL integration checks; stalled-handshake regression |
| Authentication | Server-owned shared session refreshes when Clerk restores/changes identity. Private state resets across accounts; same-account refresh preserves edits. Signed-out pages offer contextual sign-in. | Session synchronization regressions; actual user's restored localhost Clerk session and successful source/reasoning writes |
| Workspace recovery | Requested language survives recovery; failed initial synchronization blocks execution and permits retry. Only the recovery writer reports local save. Storage quota failures preserve edits and truthful save status. | Component regressions, offline/reconnect browser journey |
| Execution waiting | Interrupted polling retains run identity, permits retry/cancel, prevents duplicate dispatch, uses bounded requests and backoff. | Component and execution-category browser tests; actual Linux cancellation/recovery journey |
| Published content | Public statements come from published PostgreSQL content and valid rights. Withdrawal hides statement/editor/trace. Unknown and prototype-derived paths fail closed. New published metadata does not automatically create an execution bundle. | Public-route tests; real PostgreSQL lifecycle withdrawal; browser withdrawn-content and actual HTTP 404 checks |
| Diagnostics | Shared learning HTTP errors emit safe, unique request correlation. Known infrastructure outages are retryable 503; unexpected programming errors remain 500. No raw SQL, credentials or learner source is logged. | Safe correlation/outage regressions |
| GUI | Shared recovery states, preserved planner edits, clean reviewed learning-path wording, accessible 404. Generic Home-link styling no longer overrides primary-button contrast. | 31 accessibility checks; three complete journey tests; five execution-category browser tests |
| CI/images | Fresh run-specific runtime evidence with commit/run provenance; uploads only after execution; failure cleanup. Dependency-aware C++ image removal replaces ignored purge failures. CI pnpm and Docker Buildx setup use their verified Node 24 action runtimes. | Actual image/conformance/abuse and gVisor jobs; evidence freshness tests |

## Executed gates

Repair commit `2803c23ad8e4dfdf49eac3702b08f6b19f2275b8` passed all three jobs in [CI run 37102481179](https://github.com/vsuman00/AlgoCove/actions/runs/37102481179): quality; execution contract/sandbox; stronger runtime isolation. The mandatory real-loop job executed both scenarios, not the ordinary integration suite's two opt-in skips.

Its real-host report records 36 terminal outcomes across Python, JavaScript, TypeScript, Java, C++ and C: six wrong answers, five compile errors, one type error, six execution limits, twelve passes and six infrastructure errors. It also verifies resume of the same attempt, reasoning revision, authored readiness checks, trace prediction, reference assistance persistence, edited source invalidating old pass credit, real cancellation and host-crash reconciliation. The fresh gVisor matrix ran repeated normal/hostile and concurrent startup cases. These are actual isolated Linux host checks with PostgreSQL and signed callback handlers; actor authentication and the browser API bridge remain controlled test seams.

The subsequent publication/diagnostics/UI repairs pass locally: 254 repository tests; 63 PostgreSQL tests (two Linux-only cases deliberately skipped locally); production build; 31 accessibility checks; three roadmap/offline journeys; five execution-category browser tests. Combined verification passed, and all three jobs passed again on application repair commit `0f8b7a5ce003c4c451c16ed966006f4cd601cacc` in [CI run 37104114731](https://github.com/vsuman00/AlgoCove/actions/runs/37104114731). Both actual Linux scenarios executed. The [real-loop report](evidence/runtime-error-audit-2026-10-03/repair-real-learning-loop-0f8b7a5.json) records all 36 outcomes; the [fresh gVisor report](evidence/runtime-error-audit-2026-10-03/repair-gvisor-0f8b7a5.md) carries the exact commit and run provenance. Both CI database cleanup steps removed their containers, networks and volumes. No fatal Python initialization or dpkg removal errors occurred in the repaired native image. A remaining Docker Buildx action Node 20 warning prompted an update to the verified Node 24 action release; its final CI rerun is distinct from this recorded application-code result.

## Limits and retained resources

- Actual localhost Clerk authentication restored the user's own session, and persisted source/reasoning writes returned 200. This is separate from browser tests using explicit API fixtures. No provider account was created or deleted.
- The native local PostgreSQL cluster now contains the user's learner work and remains available with localhost. Do not delete it as disposable test data. An owner-only local backup is retained at `.tmp/learner-data-backups/algocove-2026-10-03.dump` (ignored by Git). No execution VM was created. GitHub disposable database containers/networks/volumes and host processes are cleaned by their jobs.
- The known development-only braces advisory GHSA-vfj7-8cjw-p6xm has no published patched version. Production dependency audit is clean; the narrow development exception remains explicit and rejects changed/additional findings. This is not a claim of zero vulnerabilities.
- Full DSA breadth, later phases, hosted operations, human screen-reader validation and outstanding visual asset approvals remain separate recorded work. Technical checks do not manufacture those approvals or certify every possible race.
- Local hostile-code execution still requires the approved isolated Linux host. The Mac web UI does not execute untrusted code directly, and a disabled execution service does not report a fabricated pass.
