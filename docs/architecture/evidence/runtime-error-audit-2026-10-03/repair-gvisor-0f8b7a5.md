# Task 19 sandbox-selection spike

Date: 2026-10-03T06:51:29.730Z
Commit: 0f8b7a5ce003c4c451c16ed966006f4cd601cacc
CI run: 37104114731

## Decision

Candidate runtime runsc executed. This report records technical evidence; the security-owner decision is recorded separately in tasks/todo.md.

This run explicitly selected Docker runtime `runsc`. Passing fixtures demonstrate candidate-runtime behavior only; they do not grant security-owner approval or production promotion.

## Environment

- Docker server: 28.0.4
- Docker runtimes: io.containerd.runc.v2, runc, runsc
- Selected runtime: runsc
- runsc available: true
- Firecracker available: false
- Enforced run flags: --network=none --read-only --workdir=/work --tmpfs=/work:rw,exec,nosuid,nodev,size=16m,uid=65532,gid=65532,mode=700 --tmpfs=/tmp:rw,nosuid,nodev,size=16m,uid=65532,gid=65532,mode=700 --cap-drop=ALL --security-opt=no-new-privileges:true --pids-limit=128 --memory=1024m --memory-swap=1024m --cpus=0.5 --ulimit=nofile=64:64 --ulimit=fsize=1048576:1048576 --user=65532:65532 --env=PATH=/opt/java/openjdk/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin --env=HOME=/work

## Fixture results

| Language | Mode | Repetition | Exit | Timed out | Duration (ms) | Output marker |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| python | normal | 1 | 0 | false | 222 | NORMAL_OK |
| python | hostile | 1 | 0 | false | 1911 | NETWORK_BLOCKED,METADATA_BLOCKED,DOCKER_SOCKET_ABSENT,HOST_MOUNT_ABSENT,CREDENTIAL_ENV_ABSENT |
| javascript | normal | 1 | 0 | false | 387 | NORMAL_OK |
| javascript | hostile | 1 | 0 | false | 325 | NETWORK_BLOCKED,METADATA_BLOCKED,DOCKER_SOCKET_ABSENT,HOST_MOUNT_ABSENT,CREDENTIAL_ENV_ABSENT |
| typescript | normal | 1 | 0 | false | 486 | NORMAL_OK |
| typescript | hostile | 1 | 0 | false | 671 | NETWORK_BLOCKED,METADATA_BLOCKED,DOCKER_SOCKET_ABSENT,HOST_MOUNT_ABSENT,CREDENTIAL_ENV_ABSENT |
| java | normal | 1 | 0 | false | 2485 | NORMAL_OK |
| java | hostile | 1 | 0 | false | 2907 | NETWORK_BLOCKED=true,METADATA_BLOCKED=true,DOCKER_SOCKET_ABSENT=true,HOST_MOUNT_ABSENT=true,CREDENTIAL_ENV_ABSENT=true |
| cpp | normal | 1 | 0 | false | 404 | NORMAL_OK |
| cpp | hostile | 1 | 0 | false | 423 | NETWORK_BLOCKED=1,METADATA_BLOCKED=1,DOCKER_SOCKET_ABSENT=1,HOST_MOUNT_ABSENT=1 |
| c | normal | 1 | 0 | false | 264 | NORMAL_OK |
| c | hostile | 1 | 0 | false | 306 | NETWORK_BLOCKED=1,METADATA_BLOCKED=1,DOCKER_SOCKET_ABSENT=1,HOST_MOUNT_ABSENT=1 |
| python | normal | 2 | 0 | false | 217 | NORMAL_OK |
| python | hostile | 2 | 0 | false | 1905 | NETWORK_BLOCKED,METADATA_BLOCKED,DOCKER_SOCKET_ABSENT,HOST_MOUNT_ABSENT,CREDENTIAL_ENV_ABSENT |
| javascript | normal | 2 | 0 | false | 309 | NORMAL_OK |
| javascript | hostile | 2 | 0 | false | 302 | NETWORK_BLOCKED,METADATA_BLOCKED,DOCKER_SOCKET_ABSENT,HOST_MOUNT_ABSENT,CREDENTIAL_ENV_ABSENT |
| typescript | normal | 2 | 0 | false | 473 | NORMAL_OK |
| typescript | hostile | 2 | 0 | false | 585 | NETWORK_BLOCKED,METADATA_BLOCKED,DOCKER_SOCKET_ABSENT,HOST_MOUNT_ABSENT,CREDENTIAL_ENV_ABSENT |
| java | normal | 2 | 0 | false | 2192 | NORMAL_OK |
| java | hostile | 2 | 0 | false | 2875 | NETWORK_BLOCKED=true,METADATA_BLOCKED=true,DOCKER_SOCKET_ABSENT=true,HOST_MOUNT_ABSENT=true,CREDENTIAL_ENV_ABSENT=true |
| cpp | normal | 2 | 0 | false | 341 | NORMAL_OK |
| cpp | hostile | 2 | 0 | false | 360 | NETWORK_BLOCKED=1,METADATA_BLOCKED=1,DOCKER_SOCKET_ABSENT=1,HOST_MOUNT_ABSENT=1 |
| c | normal | 2 | 0 | false | 258 | NORMAL_OK |
| c | hostile | 2 | 0 | false | 290 | NETWORK_BLOCKED=1,METADATA_BLOCKED=1,DOCKER_SOCKET_ABSENT=1,HOST_MOUNT_ABSENT=1 |
| python | normal | 3 | 0 | false | 276 | NORMAL_OK |
| python | hostile | 3 | 0 | false | 1870 | NETWORK_BLOCKED,METADATA_BLOCKED,DOCKER_SOCKET_ABSENT,HOST_MOUNT_ABSENT,CREDENTIAL_ENV_ABSENT |
| javascript | normal | 3 | 0 | false | 378 | NORMAL_OK |
| javascript | hostile | 3 | 0 | false | 372 | NETWORK_BLOCKED,METADATA_BLOCKED,DOCKER_SOCKET_ABSENT,HOST_MOUNT_ABSENT,CREDENTIAL_ENV_ABSENT |
| typescript | normal | 3 | 0 | false | 471 | NORMAL_OK |
| typescript | hostile | 3 | 0 | false | 527 | NETWORK_BLOCKED,METADATA_BLOCKED,DOCKER_SOCKET_ABSENT,HOST_MOUNT_ABSENT,CREDENTIAL_ENV_ABSENT |
| java | normal | 3 | 0 | false | 2350 | NORMAL_OK |
| java | hostile | 3 | 0 | false | 2973 | NETWORK_BLOCKED=true,METADATA_BLOCKED=true,DOCKER_SOCKET_ABSENT=true,HOST_MOUNT_ABSENT=true,CREDENTIAL_ENV_ABSENT=true |
| cpp | normal | 3 | 0 | false | 402 | NORMAL_OK |
| cpp | hostile | 3 | 0 | false | 330 | NETWORK_BLOCKED=1,METADATA_BLOCKED=1,DOCKER_SOCKET_ABSENT=1,HOST_MOUNT_ABSENT=1 |
| c | normal | 3 | 0 | false | 297 | NORMAL_OK |
| c | hostile | 3 | 0 | false | 277 | NETWORK_BLOCKED=1,METADATA_BLOCKED=1,DOCKER_SOCKET_ABSENT=1,HOST_MOUNT_ABSENT=1 |

- Normal fixtures all passed: true
- Hostile boundary fixtures all passed: true

## Failure diagnostics

## Concurrency

- Six lightweight language-container fixtures launched concurrently: 565 ms wall time
- Results: cpp=0 (empty), python=0 (NORMAL_OK), c=0 (empty), javascript=0 (NORMAL_OK), typescript=0 (NORMAL_OK), java=0 (openjdk version "25.0.4" 2026-07-21 LTS OpenJDK Runtime Environment Temurin-25.0.4+7 (build 25.0.4+7-LTS) OpenJDK 64-Bit Server VM Temurin-25.0.4+7 (build 25.0.4+7-LTS, mixed mode, sharing))
- Concurrent fixtures all passed: true

The concurrent probe uses lightweight startup commands; sequential fixtures above cover language-specific compile/run and boundary behavior.

This is a local startup/concurrency observation, not a capacity or cost claim.

## Image provenance

- python: sha256:0a42827f386ee0fabf7c7b8834176aba6f74221a34a61e982fdf7c084c7bac8c|54008472|python@sha256:c6ead215bfd31f1e433d968853b7a769989117115b728874824e6c0a27cb96fc
- javascript: sha256:016b3a44fcc6fc0d8e54e4b33826ddac5adef9a3e736823c8e0f44de04469d28|179014198|node@sha256:2c45bdcbf63561a54da9549612084b43ca309854a4110c87857d609ddeb61c9e
- typescript: sha256:016b3a44fcc6fc0d8e54e4b33826ddac5adef9a3e736823c8e0f44de04469d28|179014198|node@sha256:2c45bdcbf63561a54da9549612084b43ca309854a4110c87857d609ddeb61c9e
- java: sha256:0b7a59aab2909cc4528a3cbb9ff09673dfde4f75de394162bff2ec98216a1567|414014194|eclipse-temurin@sha256:010ab2b79329b951bf052dbf515843ab345ae4e4f0ef72287d85c9fa54da275f
- cpp: sha256:3817c37a19a2cd2fe637b4d80dbecb3ecf1b656db413676c1ac99fa27c20aaa6|1449075349|gcc@sha256:9ca91b05c7b07d2979f16413e8b2cd6ec8a7c80ffca4121ccab0aeba33f90460
- c: sha256:3817c37a19a2cd2fe637b4d80dbecb3ecf1b656db413676c1ac99fa27c20aaa6|1449075349|gcc@sha256:9ca91b05c7b07d2979f16413e8b2cd6ec8a7c80ffca4121ccab0aeba33f90460

Image patching, SBOM/signature verification, host quarantine, and production observability were not proven by this local spike. They remain required before runtime-image promotion and are intentionally left to Tasks 22 and 24.

## Required follow-up

1. If this was the control baseline, run the same fixture matrix with an installed gVisor runsc runtime or Firecracker-class runner using ALGO_COVE_DOCKER_RUNTIME.
2. Use the recorded security-owner decision in tasks/todo.md. A technical rerun does not reset an existing approval or authorize a different runtime.
3. Keep Docker runc as a local developer probe only; never enable learner execution from this result.

## Sources

- https://docs.docker.com/engine/containers/resource_constraints/
- https://docs.docker.com/engine/network/drivers/none/
- https://gvisor.dev/docs/architecture_guide/security/
- https://github.com/firecracker-microvm/firecracker/blob/main/docs/design.md
