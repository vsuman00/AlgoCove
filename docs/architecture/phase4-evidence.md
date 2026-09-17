# Phase 4 implementation evidence

**Status:** Tasks 20, 21, 23, and the bounded Task 24 fixture/control slice are
complete locally. Task 22 is partially validated locally: all six pinned
profiles build with SBOM/provenance, pass normal/failure smoke fixtures, and
Docker Scout reports zero critical/high findings for all four image profiles;
the digest-based GHCR/Cosign release workflow is configured but has not yet
been executed. Task 19 remains open: the local Docker `runc` baseline passed
the six-language normal and hostile fixture matrix, but it is explicitly
rejected as the production hostile-code boundary. The spike now accepts an
explicit runtime and the CI workflow provisions gVisor `runsc`, but no
candidate-runtime result or security-owner decision exists in this checkout.
Phase 4 remains open until the stronger runtime and signed-image workflow are
executed and the security decision is recorded.

## Task 19 slice delivered

- Added a reproducible sandbox-selection runner at
  `spikes/execution-sandbox/run-spike.mjs`.
- Added the `pnpm test:sandbox:spike` command.
- Exercised Python, JavaScript, TypeScript, Java, C++, and C using current
  public runtime images and immutable image digests recorded in the report.
- Normal fixtures passed for all six languages.
- Hostile boundary fixtures passed for all six languages: network denial,
  metadata denial, absent Docker socket, absent host mounts, and absent
  credential-shaped environment variables.
- Recorded startup latency, six-container concurrent startup, Docker resource
  flags, image IDs/digests, and runtime availability.
- Added explicit `ALGO_COVE_DOCKER_RUNTIME` selection with fail-closed runtime
  availability validation. The `stronger-sandbox` CI job installs gVisor,
  verifies Docker registration with `hello-world`, runs the same matrix with
  `runsc`, and uploads the report as an artifact; its result is still pending
  a remote workflow run and security-owner review.

## Task 20 slice delivered

- Added the pure `@algocove/execution-contracts` package with a strict schema
  version 1 run descriptor and terminal result contract.
- Learner input is limited to source and a selected published language. The
  descriptor stores only the server-computed source digest, never learner
  source itself.
- Descriptors bind run and attempt IDs, problem/manifest and fixture digests,
  image digest, language adapter, phase plan, profile limits, policy version,
  replay identity, signing key ID, lease epoch, and bounded expiry.
- Results classify pass, learner failures, cancellation, and infrastructure
  failures deterministically. Cancellation is a control-plane outcome, not
  learner evidence. Signed result verification checks descriptor correlation,
  run/attempt/replay identity, lease epoch, temporal validity, and key rotation
  status.
- Ed25519 signing uses Node's built-in crypto API. Unknown fields, unsupported
  schema versions, malformed digests, oversized limits, stale keys, tampered
  payloads, stale leases, and replay mismatches are rejected.
- `tests/unit/execution-contracts.test.ts` passes all 7 focused contract tests;
  the full local gate now passes with 21 test files and 86 tests.

## Task 21 slice delivered

- Added the internal-only `@algocove/execution-control` service boundary with
  authenticated application-relay, worker, and operator principals. Browser
  envelopes are rejected before dispatch and each internal operation has an
  explicit principal allowlist.
- Added idempotent admission, bounded per-quota scheduling, lease ownership,
  heartbeat expiry, cancellation races, terminal-result correlation, duplicate
  result replay, teardown-failure conversion, lease-epoch fencing, and bounded
  lost-host reconciliation. A lost host becomes an infrastructure terminal
  result at its deadline and is never automatically replaced while execution
  may still exist.
- Required a separate execution run/lease journal port. Lifecycle mutations
  write descriptor-only journal records; the service has no application-table
  access. A durable deployment adapter remains an infrastructure composition
  concern, not an application-table shortcut.
- Added the application-owned PostgreSQL outbox relay path with signed
  descriptor-only dispatch messages, bounded claim leases, `SKIP LOCKED`
  claiming, acknowledgement, retry release, and migration `0009_outbox_claims`.
  The worker relay verifies the signed descriptor before delivery and applies
  bounded retry backoff. Learner source is never part of the relay payload.
- Added 8 focused Task 21 tests covering browser/internal admission,
  concurrent idempotency and quota queueing, cancellation, duplicate results,
  teardown failure, lost-host fencing/reconciliation, descriptor-only relay
  messages, and worker delivery/retry behavior.

## Task 22 slice delivered

- Added four pinned image profiles covering six distinct language targets:
  Python 3.14.7, Node.js 26.8.2 with TypeScript 5.9.3, OpenJDK 25.0.4, and
  GCC/G++ 15.3.0. TypeScript keeps separate type-check and transpile commands;
  C and C++ keep separate command vectors and conformance targets.
- Every profile records a pinned base digest, non-root UID `65532`, no network,
  no package installation, no learner flags, and bounded writable paths.
- BuildKit SBOM and provenance attestations were generated for every local
  image. `pnpm run images:test` passed all six normal and six failure smoke
  fixtures with read-only roots, dropped capabilities, no-new-privileges,
  resource limits, and executable-only native work volumes.
- Docker Scout reported zero critical/high findings for all four local image
  profiles. The C/C++ profile is pinned to GCC 15.3.0 on Debian Trixie,
  removes unused compiler-base tooling, and builds zlib 1.3.2 from a
  checksum-pinned upstream archive so the compiler remains functional without
  retaining the stale vulnerable distro package. The current local image
  digests are Python
  `sha256:9a888bb4c758d7cca71b6ec7d615488b193f864cdbc54d7292540a350f9babc6`,
  JavaScript/TypeScript
  `sha256:86835aa786e0d91a2fb766f1844885dcb46ecbe9d018db2a73d01a1c92e7008e`,
  Java `sha256:5800cf0d188c046ba79b489af4aa02203d8fd10191bc9dedb331bfa75d2af4ec`,
  and C/C++
  `sha256:f8146f392efe2fb048115c7f98ca90843dfbe5294044b60650bd07c4fbefe421`.
  Added `.github/workflows/execution-release.yml` to build with SBOM/provenance,
  scan the pushed digest, keylessly sign it with Cosign via GitHub OIDC, and
  verify the certificate identity. The workflow is configured but has not yet
  been executed against GHCR, so signing is not claimed.

## Task 23 slice delivered

- Added one versioned conformance manifest with six shared semantic fixture
  IDs. The policy makes signed 64-bit numeric behavior, UTF-8/NFC labels,
  lexicographic index ordering, exact integer serialization, and
  non-applicable float tolerance explicit.
- Added independent Python, JavaScript, TypeScript, Java, C++, and C
  solutions. The trusted host-side judge compares output and lineage; it never
  accepts a candidate-provided verdict.
- `pnpm test:conformance` passes 36 correct language/fixture executions and
  six mutated not-equal solutions rejected as learner failures. Spoofed
  verdicts, malformed output, expected-value spoofing, source/fixture/image
  digests, policy versions, and limits lineage are covered.

## Task 24 slice delivered

- Added the bounded abuse manifest and runner at
  `tests/sandbox-security/abuse-manifest.json` and
  `tests/sandbox-security/run-abuse.mjs`, with the `pnpm test:sandbox` command.
- Exercised escape boundary, egress, metadata, PID/fork pressure, memory,
  CPU, disk, output, path traversal, symlink, container residue, signal,
  explicit cancellation, and teardown fixtures against the local pinned
  Python execution image.
- The 14-fixture run completed with bounded terminal outcomes, an 8 KiB output
  cap, per-fixture timeouts of at most 1.5 seconds, no leftover Docker
  containers, and no host/runtime socket or host-mount access. Memory pressure
  was cgroup-killed, while CPU/output/signal/cancellation were harness-killed;
  these are control outcomes, not learner mastery evidence.
- Existing Task 20/21 contract and lifecycle tests verify signed result
  correlation, replay and lease fencing, cancellation classification, and
  conversion of teardown failure to `infrastructure_failure`. Browser-origin
  control calls remain rejected.

## Evidence

The versioned report is
`spikes/execution-sandbox/reports/task-19-2026-09-17.md`.

The control baseline uses no network, a read-only root, bounded writable
tmpfs paths, dropped capabilities, no-new-privileges, PID/memory/CPU/file
limits, a non-root UID, and no host/runtime socket mounts. The compiled native
fixtures use an explicitly executable temporary work volume because a native
binary must be loadable; this is a property to repeat and review under the
stronger candidate, not a production approval.

## Decision and blocker

Docker’s default `runc` runtime is useful for local control probing but does
not satisfy the architecture’s required gVisor-class, microVM-class, or
equivalently isolated managed boundary. Task 19 remains open until the same
matrix is run with an approved stronger candidate and a security owner records
approval, rejection, or a narrowed decision.

The Task 24 fixture runner is a local control-baseline test only. No learner
source is accepted or executed by the application, Next.js, the general worker,
or this conformance fixture runner. Task 23 and Task 24 prove semantic and
abuse-control contracts in the local baseline; they do not approve Docker
`runc` for hostile learner code or close the unresolved runtime sandbox
decision. The CI workflows are implementation evidence, not a substitute for
their successful remote runs and the required human security decision.

## References

- https://docs.docker.com/engine/containers/resource_constraints/
- https://docs.docker.com/engine/network/drivers/none/
- https://gvisor.dev/docs/architecture_guide/security/
- https://github.com/firecracker-microvm/firecracker/blob/main/docs/design.md
- https://nodejs.org/api/crypto.html#cryptosignalgorithm-data-key-callback
