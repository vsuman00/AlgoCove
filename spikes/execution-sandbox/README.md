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
latency, a six-container concurrency observation, and whether `runsc` or
Firecracker is installed.

The spike cannot close Task 19 by itself when only `runc` is available. In that
case the report is evidence for rejecting the default runtime and the next
step is to repeat the matrix with the approved stronger candidate.
