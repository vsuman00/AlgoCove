# Phase 5: local guided learning loop evidence

Evidence date: 2026-10-01. Phase 6 owner authorization recorded: 2026-10-02. Tasks 25 through 29 are complete for the first original problem,
**Container with most water**, on localhost. The technical F5 learning-kernel
checks are complete. The owner authorized Phase 6 on 2026-10-02; Task 30 is being
tracked in the [task ledger](../../tasks/todo.md).

## Implemented boundary

- The website requests one owner-scoped run and commits its signed descriptor
  outbox atomically. Raw source travels only through the ephemeral source handoff.
- A dedicated Linux host uses the security-owner-approved gVisor `runsc` runtime,
  immutable reviewed images, trusted harnesses and a host judge. Learner code does
  not run in Next.js, the browser, the application worker or the database host.
- SQLite stores descriptor, lifecycle, cancellation and delivery metadata. It
  never stores raw source. Source exists in host memory and sandbox tmpfs only.
- Results are signed outside the sandbox. The website verifies the Ed25519
  signature against the original committed descriptor and exact run, attempt,
  problem, manifest, language, source checksum, replay identity and lease epoch
  before the atomic assessment observation/outbox commit.
- Cancellation, duplicate admission/result delivery, callback response loss and
  host restart preserve the original run. Uncertain work becomes an infrastructure
  result, with no positive assessment credit and no replacement execution.
- Terminal delivery follows confirmed sandbox teardown. Unconfirmed teardown
  overrides even a passing verdict and quarantines the runner.

The local host implements one reviewed problem bundle and one concurrent sandbox.
It has no application database or identity package dependency. Signing keys remain
in its private state directory; the website receives only public verification keys
and separate transport credentials.

## Learner workspace

All six languages support explicit Run versus Submit, server-observed terminal
categories, cancellation and committed submitted-attempt resume. Editing source
preserves the previous result but labels it **Previous source**; reloading an
edited draft cannot inherit an earlier source's pass.

The workspace saves eight free-form reasoning fields and bounded authored question
selections in an explicit immutable revision. Readiness requires the reviewed
area and boundary answer keys plus an exact verified passing submission for the
attempt. Filled prose alone cannot satisfy the rubric. Free-form explanation
remains advisory; readiness is not mastery or delayed-transfer evidence.

Learners can edit a bounded array trace and record a prediction. Invalid events
retain the last valid trace. Its transcript includes the question and selected
prediction, and keyboard controls support replay without animation or color.
Learner trace edits are explicitly temporary tab state, not confirmed server saves.
The server reveals the reviewed reference only after persisting scaffold-tier
assistance; unavailable persistence/transport reveals no reference. Locked
reference events and authored hint bodies are absent from the client bundle.
Authored hints persist before display, retain cumulative exposure and work with
AI disabled. The guided path labels no longer pretend that steps are completed.

## Real local evidence

The temporary environment was Ubuntu 26.04 ARM64 on Lima 2.2.0/VZ with four CPUs
and 4 GiB RAM, rootful Docker 29.1.3, gVisor `runsc` 20260928.0 and official Node
22.22.0 with native TypeScript support. Runtime image IDs are recorded in the
matrix report; they are local build IDs, not a new signed release.

| Gate | Result | Scope |
| --- | --- | --- |
| `pnpm verify` | 178 tests passed; formatting, lint, types, tokens, docs and secret checks passed | Unit, web and architecture |
| `pnpm build` | Passed | Production build only |
| `pnpm security:audit` | Passed after the Next.js patch | Dependency advisory gate |
| `pnpm test:integration` | 21 passed; the two opt-in real-host scenarios are skipped by default | Local PostgreSQL boundaries |
| `pnpm test:e2e` | 1 passed | Offline, reconnect, conflict, expiry and logout recovery |
| `pnpm test:a11y` | 16 passed | Chromium/axe, keyboard, narrow layout and reduced motion |
| `pnpm test:execution-browser` | 5 passed | Result rendering fixtures |
| Opt-in real browser learning loop | 2 scenarios passed | Actual route handlers, PostgreSQL, gVisor execution and signed callbacks |
| Earlier fixture conformance runner | 36 correct, 6 mutation rejections and spoof defenses passed | Controlled pair-sum fixtures; default Docker fixture baseline, not learner execution |
| Earlier fixture abuse runner | 14 passed; no residue | Controlled Task 24 fixture baseline |
| Real six-language runner matrix | 36/36 passed | Pass, wrong answer, compile/type error, runtime error, timeout and unavailable image |
| Real gVisor abuse boundaries | 5/5 passed | Egress/metadata/host-file/credential denial, spoofing, output, PID and memory exhaustion |

Machine-readable, source-free reports:

- [Runner matrix](evidence/f5-matrix-2026-10-01.json).
- [Sandbox boundaries](evidence/f5-boundaries-2026-10-01.json).
- [Browser learning loop](evidence/f5-browser-2026-10-01.json).
- [Temporary environment cleanup](evidence/f5-cleanup-2026-10-01.json).

The real browser suite substitutes **authentication only** with a private fixture
actor. It executes the actual practice and callback route handlers, repositories,
signed contracts, host and sandbox. It does not claim a new live Clerk login test.
It covers saved reasoning revisions, rejected authored answers, learner prediction,
invalid trace editing, reference/hint unavailability, persisted reference
assistance, source-save recovery, all six-language result paths, submitted-state
reload, edited-source reload, real cancellation, host crash/restart, no replacement
and unavailable-image submissions with no credit.

A separate visual inspection confirmed the readable workspace and transcript, reduced-motion preference and keyboard replay. No manual assistive-technology session or new live authentication session is claimed.

At the published bounds the host enforces 128 PIDs, one CPU, 256 MiB memory
(Java 384 MiB), 32 MiB work and 64 MiB temporary tmpfs, a read-only root,
non-root UID 65532, no network, dropped capabilities and no new privileges.
Compilation and execution have separate cumulative deadlines; output is capped
at 64 KiB. TypeScript reports `type_error` separately. An observed fork flood
killed the gVisor Sentry at the PID budget: this is conservatively infrastructure
failure, not a verified learner error. OOM is classified using Docker host state,
including bounded waiting for its asynchronous OOM event; learner stderr is not
trusted evidence.

## Dependency audit closure

The final audit found the Next.js `next/og` ImageResponse advisory
[GHSA-vcvr-r3jv-pc5j](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j).
Source inspection found no use of that API in AlgoCove. Next.js and its matching
ESLint configuration were patched from 16.3.5 to 16.3.6, and the frozen lockfile,
audit, verification, build and browser regression gates were rechecked.
The real VM/browser report was captured on 16.3.5 before VM deletion; the final
web regression gates use 16.3.6. Execution host, signatures and harness code did
not change during this dependency patch.

## Limits and operation

This completes the local Phase 5 scope. Hosted publication, Vercel deployment,
production capacity, live provider testing and Phase 6 mastery are separate work.
Repository environment files retain execution disabled. The CLI rejects inherited
application/identity/AI credentials and permits only local callback destinations.
It is a localhost composition, not a production hosting adapter.

Callback retries preserve the original signed result. If its five-minute validity
window expires during an extended outage, delivery is withheld for operator
reconciliation; it never re-signs an old passing result as fresh evidence. A lost
source handoff becomes infrastructure failure after five seconds or restart.
These bounded local behaviors do not claim production outage recovery coverage.

See [local execution instructions](../../services/execution-host/README.md) for
reproduction and cleanup. VM deletion and temporary download-cache cleanup are
recorded below after teardown.

## Cleanup

Verified on 2026-10-01 after execution and dependency regression testing:

- Guest `docker ps -aq` returned no containers after all execution suites.
- The execution CLI received SIGTERM; Lima stopped the VM and deleted
  `algocove-gvisor`. `limactl list` reported no instances and the VM directory
  was verified absent. Its measured allocated directory size was 7.2 GiB.
- The exact task-created Lima image download/conversion cache was removed and
  verified absent (measured 3.3 GiB). Lima 2.2.0, installed only for this test,
  was uninstalled (81.9 MB).
- The website and local database test processes were stopped after inspection;
  existing PostgreSQL volumes were retained. Task-started Docker Desktop was
  stopped after confirming no running containers remained. Private connection copies and
  temporary reports/screenshots were removed after sanitized evidence capture.
- No live deployment was performed. Environment files were not changed.
