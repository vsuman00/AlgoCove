# Local gVisor execution host

This is the localhost Phase 5 composition for the original Container problem.
Read the [evidence and limits](../../docs/evidence/phases/phase5-evidence.md).
It requires Linux, Docker registered with `runsc`, and a Node build with native
TypeScript support. Official Node 22.22.0 was used; the Ubuntu packaged build
did not support TypeScript stripping. On macOS, use a temporary Linux VM.

## Prepare the local environment

1. Install workspace dependencies with `pnpm install --frozen-lockfile`.
2. Start local PostgreSQL with `pnpm db:start`, bootstrap the configured local
   roles, apply migrations, and run `pnpm db:seed:practice`. Retain existing
   database volumes; the browser suite creates and deletes only its own learner.
3. In the Linux host, install Docker and the approved `runsc` version, register
   it with Docker and confirm `docker info --format '{{json .Runtimes}}'`
   contains `runsc`. The tested daemon socket was `/var/run/docker.sock`.
4. Build the four pinned profiles from `services/execution-images/profiles.json`
   using `services/execution-images/build-images.mjs`. The local exporter used
   `ALGO_COVE_IMAGE_ATTESTATIONS=false`; signed release images remain separately
   governed. Map each of the six languages to its immutable Docker image ID
   (`docker image inspect --format '{{.Id}}' IMAGE`), never a mutable tag.
   JavaScript/TypeScript share a profile, as do C/C++.
5. Save this six-key mapping as `/tmp/algocove-images.json` inside the VM.
   The opt-in browser test uses the VM name `algocove-gvisor`, the workspace at
   the same read-only path as macOS, and official Node at
   `/tmp/node-v22.22.0-linux-arm64/bin/node`. This is an ARM64 Lima test harness,
   not a portable cloud installer. Keep application environment credentials out
   of the execution process; production hosts need a separately installed bundle.

## Start the dedicated host

In the Linux host, from the workspace, run:

```sh
ALGO_COVE_LOCAL_EXECUTION=1 \
DOCKER_HOST=unix:///var/run/docker.sock \
LOCAL_EXECUTION_STATE_DIR=/tmp/algocove-f5-host \
LOCAL_EXECUTION_IMAGES_FILE=/tmp/algocove-images.json \
LOCAL_RESULT_CALLBACK_URL=http://host.lima.internal:3301/api/internal/practice/results \
LOCAL_RESULT_CALLBACK_TOKEN=local-f5-callback-token-for-tests-only-20261001 \
/tmp/node-v22.22.0-linux-arm64/bin/node services/execution-host/src/cli.ts
```

The callback token above is a public fixture value usable only for this local
test. Interactive authenticated testing must use a newly generated private token.
For the crash/restart scenario, start through `sg docker -c` and write the owning
CLI PID to `/tmp/algocove-host.pid` before `exec`, as the test's `hostCommand` does.
Do not start a second host against the same state directory.

The host writes `connection.local.json` with mode 0600. Copy **only this connection
file** to `.tmp/f5/connection.local.json` on macOS; never copy `key.local.json`.
It contains the website relay URL/token, public verification keys and descriptor
control URL. Lima forwards loopback ports 3302 and 3303. Verify that the VM can
reach the Mac callback's loopback listener through `host.lima.internal`.

For interactive website testing, configure the server-only execution relay,
callback token and `EXECUTION_VERIFICATION_KEYS_JSON` from the connection file.
For the automated suite below, the backend configures those values in memory;
no environment file changes are needed.

## Run the gates

Inside the Linux host:

```sh
ALGO_COVE_LOCAL_EXECUTION=1 LOCAL_EXECUTION_IMAGES_FILE=/tmp/algocove-images.json \
/tmp/node-v22.22.0-linux-arm64/bin/node tests/local-execution/run-matrix.ts
ALGO_COVE_LOCAL_EXECUTION=1 LOCAL_EXECUTION_IMAGES_FILE=/tmp/algocove-images.json \
/tmp/node-v22.22.0-linux-arm64/bin/node tests/local-execution/run-boundaries.ts
```

On macOS, build and start the real frontend in one terminal:

```sh
pnpm build
EXECUTION_ENABLED=true NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY='' CLERK_SECRET_KEY='' \
pnpm --filter @algocove/web exec next start --hostname 127.0.0.1 --port 3300
```

In another terminal:

```sh
LOCAL_PHASE5_E2E=1 pnpm exec vitest run --project integration tests/integration/local-learning-loop.test.ts
```

The suite starts actual route handlers on loopback port 3301, supplies only a
fixture identity, drives Chromium against Next.js, and uses real PostgreSQL,
gVisor and signature verification. It restarts the VM host and briefly selects
an unavailable image to exercise infrastructure failure. Use only disposable
host state for it. Do not run concurrent executions against that host.

Reports are written to guest `/tmp/algocove-f5-matrix.json`,
`/tmp/algocove-f5-boundaries.json` and Mac `.tmp/f5/browser-report.local.json`.
Copy sanitized, source-free results into the architecture evidence directory.
Run `pnpm verify`, `pnpm test:integration`, and the browser configs as separate
gates. Browser configs share port 3100, so run them serially.

## Stop and delete the test environment

1. Confirm `docker ps -aq --filter label=algocove.local-execution=true` is empty.
2. Stop the frontend and execution CLI. Stop local PostgreSQL with `pnpm db:stop`;
   do not delete preexisting volumes.
3. Stop and delete the temporary VM: `limactl stop algocove-gvisor`, then
   `limactl delete algocove-gvisor`. Confirm it is absent from `limactl list`.
4. Remove only the task-created VM image download cache and private connection
   copies. Remove Lima if it was installed solely for this test. Keep sanitized
   reports in Git; signing keys and raw journals disappear with the VM.

No deployment command is part of this workflow.
