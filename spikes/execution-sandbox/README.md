# Task 19: sandbox-selection spike

This spike exercises the six language targets against a deny-by-default Docker
control baseline and records the result in
`reports/task-19-2026-09-17.md`.

It is deliberately not an execution service. The fixtures are static, the
Docker arguments are constructed by the script, and no learner source is
accepted. The default Docker `runc` runtime is treated as a probe baseline,
not as an approved hostile-code boundary. Production selection requires a
gVisor-class, microVM-class, or equivalently isolated managed runtime.

Run it with:

```sh
pnpm test:sandbox:spike
```

The local Docker daemon must be available. The first run pulls these public
probe images:

- `python:3.14-alpine`
- `node:26-alpine`
- `eclipse-temurin:25-jdk`
- `gcc:15-bookworm`

The normal and hostile fixtures check execution, network denial, metadata
denial, absent host mounts, absent Docker sockets, and absent credential-shaped
environment variables. The report also records image IDs/digests, startup
latency, a lightweight six-container startup/teardown observation, and whether
`runsc` or Firecracker is installed. Sequential fixtures retain the
language-specific compile/run checks; the concurrency probe intentionally uses
small startup commands so compiler memory pressure does not obscure the
runtime-isolation observation.

The spike cannot close Task 19 by itself when only `runc` is available. In that
case the report is evidence for rejecting the default runtime and the next
step is to repeat the matrix with the approved stronger candidate.

## Phase 12 Vercel Hobby diagnostics

The operator-only SDK runner pins `@vercel/sandbox` 3.6.1 and an immutable provider
image digest. It accepts only the fixed synthetic fixtures here. It is not a
learner launcher and is not invoked automatically by CI or the web application.

```sh
node ops/environments/vercel-hobby/run-discovery.ts --synthetic-discovery
```

Supply `VERCEL_TOKEN` privately through the operator environment. The runner first
checks the existing team/project and requires Hobby; missing credentials, HTTP
403 or a different plan prevent creation. There is no dashboard/manual bypass.
Use only within verified remaining Hobby allowances. No registry push, image
storage, snapshot, drive, exposed port or network download is requested.

One fresh Singapore VM uses deny-all egress, no supplied secrets and a 60-second
provider lifetime. The normal probe runs without sudo; the fixed containment
diagnostic runs as trusted setup, tests namespace creation and privilege dropping,
temporarily enables missing child cgroup controllers, and restores them afterward.
It never changes parent resource limits, attaches processes to cgroups or accepts
learner input. Controller writability is not enforcement/hostile-code evidence.

SIGINT/SIGTERM cancel pending work. Cleanup has independent deadlines and retries
a lost stop acknowledgement once. A successful receipt requires a stopped response;
unconfirmed disposal is an error. A lost creation response or abrupt operator kill
still relies on the provider lifetime. Created IDs are synchronously recorded in
private, exclusive `.tmp/vercel-discovery/*.jsonl` files before any command so an
operator can investigate/reconcile an interrupted run. Only schema-validated
observations and safe failure codes are emitted; no provider error bodies or
environment values are printed. Receipts always say `productionQualified: false`.

The [hosted evidence](../../docs/evidence/security/vercel-hobby.md) records actual
manual connector probes separately from the SDK runner's local fault-injection
tests. Full limit, cancellation, residue, runtime provenance and signed-result
qualification remain required before managed execution can be enabled.
