# Local gVisor runsc six-language probe

Date: 2026-09-30

## Decision

Candidate runtime runsc executed locally. Security owner approved gVisor in the F4 record; this probe does not approve production promotion.

This run explicitly selected Docker runtime `runsc`. These fixtures are local evidence only and do not approve production promotion.

## Diagnostic limit change

The original 32 PID / 1024 MiB matrix failed on Java, C and C++ in this ARM64 VM. This rerun raised the temporary probe to 128 PIDs / 2048 MiB to distinguish resource headroom from sandbox isolation.

## Environment

- Docker server: 29.8.1
- Docker runtimes: io.containerd.runc.v2, runc, runsc
- Selected runtime: runsc
- runsc available: true
- Firecracker available: false
- Enforced run flags: --network=none --read-only --workdir=/work --tmpfs=/work:rw,exec,nosuid,nodev,size=16m,uid=65532,gid=65532,mode=700 --tmpfs=/tmp:rw,nosuid,nodev,size=16m,uid=65532,gid=65532,mode=700 --cap-drop=ALL --security-opt=no-new-privileges:true --pids-limit=128 --memory=2048m --memory-swap=2048m --cpus=0.5 --ulimit=nofile=64:64 --ulimit=fsize=1048576:1048576 --user=65532:65532 --env=PATH=/opt/java/openjdk/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin --env=HOME=/work

## Fixture results

| Language   | Mode    | Exit | Timed out | Duration (ms) | Output marker                                                                                                          |
| ---------- | ------- | ---: | --------: | ------------: | ---------------------------------------------------------------------------------------------------------------------- |
| python     | normal  |    0 |     false |           212 | NORMAL_OK                                                                                                              |
| python     | hostile |    0 |     false |          1598 | NETWORK_BLOCKED,METADATA_BLOCKED,DOCKER_SOCKET_ABSENT,HOST_MOUNT_ABSENT,CREDENTIAL_ENV_ABSENT                          |
| javascript | normal  |    0 |     false |           303 | NORMAL_OK                                                                                                              |
| javascript | hostile |    0 |     false |           223 | NETWORK_BLOCKED,METADATA_BLOCKED,DOCKER_SOCKET_ABSENT,HOST_MOUNT_ABSENT,CREDENTIAL_ENV_ABSENT                          |
| typescript | normal  |    0 |     false |           411 | NORMAL_OK                                                                                                              |
| typescript | hostile |    0 |     false |           428 | NETWORK_BLOCKED,METADATA_BLOCKED,DOCKER_SOCKET_ABSENT,HOST_MOUNT_ABSENT,CREDENTIAL_ENV_ABSENT                          |
| java       | normal  |    0 |     false |          2270 | NORMAL_OK                                                                                                              |
| java       | hostile |    0 |     false |          2710 | NETWORK_BLOCKED=true,METADATA_BLOCKED=true,DOCKER_SOCKET_ABSENT=true,HOST_MOUNT_ABSENT=true,CREDENTIAL_ENV_ABSENT=true |
| cpp        | normal  |    0 |     false |           300 | NORMAL_OK                                                                                                              |
| cpp        | hostile |    0 |     false |           308 | NETWORK_BLOCKED=1,METADATA_BLOCKED=1,DOCKER_SOCKET_ABSENT=1,HOST_MOUNT_ABSENT=1                                        |
| c          | normal  |    0 |     false |           235 | NORMAL_OK                                                                                                              |
| c          | hostile |    0 |     false |           255 | NETWORK_BLOCKED=1,METADATA_BLOCKED=1,DOCKER_SOCKET_ABSENT=1,HOST_MOUNT_ABSENT=1                                        |

- Normal fixtures all passed: true
- Hostile boundary fixtures all passed: true

## Concurrency

- Six lightweight language-container fixtures launched concurrently: 460 ms wall time
- Results: python=0 (NORMAL_OK), c=0 (empty), cpp=0 (empty), java=0 (empty), typescript=0 (NORMAL_OK), javascript=0 (NORMAL_OK)
- Concurrent fixtures all passed: true

The concurrent probe uses lightweight startup commands; sequential fixtures above cover language-specific compile/run and boundary behavior.

This is a local startup/concurrency observation, not a capacity or cost claim.

## Image provenance

- python: sha256:c6ead215bfd31f1e433d968853b7a769989117115b728874824e6c0a27cb96fc|85736377|python@sha256:c6ead215bfd31f1e433d968853b7a769989117115b728874824e6c0a27cb96fc
- javascript: sha256:2c45bdcbf63561a54da9549612084b43ca309854a4110c87857d609ddeb61c9e|249375909|node@sha256:2c45bdcbf63561a54da9549612084b43ca309854a4110c87857d609ddeb61c9e
- typescript: sha256:2c45bdcbf63561a54da9549612084b43ca309854a4110c87857d609ddeb61c9e|249375909|node@sha256:2c45bdcbf63561a54da9549612084b43ca309854a4110c87857d609ddeb61c9e
- java: sha256:010ab2b79329b951bf052dbf515843ab345ae4e4f0ef72287d85c9fa54da275f|608306820|eclipse-temurin@sha256:010ab2b79329b951bf052dbf515843ab345ae4e4f0ef72287d85c9fa54da275f
- cpp: sha256:9ca91b05c7b07d2979f16413e8b2cd6ec8a7c80ffca4121ccab0aeba33f90460|1984089628|gcc@sha256:9ca91b05c7b07d2979f16413e8b2cd6ec8a7c80ffca4121ccab0aeba33f90460
- c: sha256:9ca91b05c7b07d2979f16413e8b2cd6ec8a7c80ffca4121ccab0aeba33f90460|1984089628|gcc@sha256:9ca91b05c7b07d2979f16413e8b2cd6ec8a7c80ffca4121ccab0aeba33f90460

Image patching, SBOM/signature verification, host quarantine, and production observability were not proven by this local spike. They remain required before runtime-image promotion and are intentionally left to Tasks 22 and 24.

## Scope

The test ran in a temporary local ARM64 Ubuntu VM with gVisor runsc. The VM was deleted after evidence capture. Learner execution remains disabled. The diagnostic run changed only process and memory ceilings in a temporary copy of the probe script; repository runtime limits were not changed.

## Sources

- https://docs.docker.com/engine/containers/resource_constraints/
- https://docs.docker.com/engine/network/drivers/none/
- https://gvisor.dev/docs/architecture_guide/security/
- https://github.com/firecracker-microvm/firecracker/blob/main/docs/design.md
