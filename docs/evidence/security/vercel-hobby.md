# Vercel Hobby managed-execution discovery

Recorded 2026-10-10. **PARTIAL; default image NOT QUALIFIED for learner execution.** This is a synthetic capability probe, not full sandbox assurance, a deployed worker or readiness approval.

## Account and budget scope

Read-only inspection of the owning team's Billing dashboard shows **Hobby Plan / Active**, no payment methods added, AI Gateway balance $0 and auto-reload off. Usage shows 0 Sandbox creations against 5,000 before this probe, and 0 Queue sends/deletes. Other usage dimensions did not all resolve during inspection and are not asserted as zero. The UI observation establishes the current plan, not complete budget headroom or automated admission.

The read-only account preflight rejects non-Hobby plans, missing billing metadata and wrong scopes. GitHub qualification [38069982446](https://github.com/vsuman00/AlgoCove/actions/runs/38069982446) at `04c79eb` reads the intended project, then fails `team_read_http_403`. The connector's team response also omits billing information. No raw billing DTO or token is logged. Owner access is required for repeatable automated plan checks; neither this document nor the dashboard receipt bypasses the CLI guard.

[VCR pricing](https://vercel.com/docs/container-registry/limits-and-pricing) lists image storage at $0.10 per GB, and its [guide](https://vercel.com/kb/guide/how-to-use-vercel-container-registry) states pricing across plans. No custom registry image was pushed. Pinned runtime delivery must have an independently verified $0 path before qualification can complete.

## Bounded hosted probe receipt

| Field | Observed value |
| --- | --- |
| Project | `prj_y4QC0yhk2h2frXDs8l3H0yn9IjJK` (`algocove`) |
| Team | `team_LGvZpIlcg4QXoGDvgCh1JX0v` |
| Sandbox | `algocove-vh02-synthetic-20261010` |
| Session | `sbx_J3L8Lz2Rlf8J8KFyip8yRPaA4qha` |
| Region | Singapore `sin1`; no failover regions |
| Image observed | `vercel/sandbox/universal@sha256:c77f7436b9bc0a8b01ef7b09dbcea2de6a18a9fe2aafa89996d2da193da72cf0` |
| Resources | 1 vCPU, 2,048 MB; nonpersistent; no supplied environment or exposed routes |
| Network policy | REST `{mode: "deny-all"}` |
| Provider timeout | 60,000 ms; command independently bounded at 10,000 ms |
| Command | `cmd_5aa8f0aac72847359e7c3c32a5dc`, `python3`, exit 0, 1,096 ms |
| Session lifetime | 28,722 ms; explicit stop confirmed by subsequent session GET |
| Provider active CPU | 1,876 ms |
| Provider transfer | 4,124 ingress bytes; 2,044 egress bytes |
| Final state | `stopped`, zero exposed routes |

Only fixed synthetic code was sent. Creation via connector first rejected the SDK string network-policy format before any resource creation; the REST object format succeeded. No source from a learner, expected answers, application/database URL, signing key or identity credential was sent to this environment.

The code in `spikes/execution-sandbox/vercel-capability-probe.py` preserves the diagnostic operations. Never run discovery on a learner session. The subsequent operator-only SDK runner below retains account qualification before automated creation; remaining shared allowances must be checked before opting into a diagnostic.

## Findings and interpretation

| Check | Actual result | Qualification consequence |
| --- | --- | --- |
| Synthetic sum | Correct | Normal Python command executes |
| Python version | 3.14.4 | Does not match current approved Python 3.14.7 profile |
| User | UID 1000 | Non-root initially; does not establish privilege containment |
| `sudo -n true` | Exit 0 | Passwordless escalation available; default learner process unacceptable |
| PID cgroup | `max` | Unlimited; existing finite PID contracts are not established |
| Memory cgroup | 2,147,483,648 bytes | Provider VM bound is 2 GB; tighter run limits require separate enforcement |
| External socket `1.1.1.1:443` | Connection blocked | Bounded probe passes; not comprehensive network-isolation evidence |
| Metadata socket `169.254.169.254:80` | Connection blocked | Bounded probe passes |
| Credential environment names | No TOKEN/SECRET/PASSWORD/DATABASE_URL matches | Limited environment scan; no values logged, not complete secret review |
| Docker socket | `/var/run/docker.sock` absent | That one socket absent; no full filesystem/host escape proof |

`evaluateSandboxCapability` rejects runtime drift, root/sudo, unenforced/excessive memory/PID limits, incomplete observations and failed boundary probes. Eight focused tests include this actual default-image outcome and malformed/injected observations. Even a clean preliminary observation returns `productionQualified: false`; immutable runtime identity, hard CPU/wall/file/disk/input/output limits, all service network targets, cancellation/residue/teardown attacks and external comparator/signing still require evidence. Example unit-test bounds of 128 MB/8 PIDs are discovery-fixture limits, not a replacement for each signed run descriptor's own limits.

## Next bounded slice

Resolve automated team-read access and qualify free pinned runtime-artifact delivery. Build a trusted launcher that gives learner processes no sudo/capability path and enforceable descriptor-specific CPU/memory/PID/file/disk/output limits. If this requires an inner container or privileged setup, prove that learner code cannot regain the setup authority or alter its constraints. Then run the full VH-02 hostile/cancellation/teardown fixture set before Checkpoint A or any learner activation. The default universal image is a diagnostic baseline, not the accepted runtime release.

## Reproducible SDK runner and containment follow-up

`ops/environments/vercel-hobby/run-discovery.ts` now provides an explicit
`--synthetic-discovery` operator command using exact `@vercel/sandbox` 3.6.1.
The SDK's published types establish digest image selection and server-enforced
command `timeoutMs`; this implementation does not guess an SDK request shape.
It requests the immutable provider image above, Singapore without failover,
deny-all egress, one CPU, no ports/environment/source/drives/snapshots and a
60-second nonpersistent lifetime. Provider image pinning is not qualification
of AlgoCove's Python 3.14.7 release.

Account qualification occurs before creation. The runner uploads only the two
fixed local diagnostic scripts; only the containment diagnostic runs as trusted
root setup. Cancellation, failed identity/upload/command/parsing, malformed output
and lost stop acknowledgements are covered by 14 lifecycle tests. A success
requires stopped acknowledgement; cleanup uses independent request deadlines and
one retry. Safe IDs are fsynced into private exclusive local JSONL receipts before
commands. Unacknowledged creation and abrupt operator death rely on the provider
TTL; this is not a durable production orphan reconciler. A missing-token CLI run
exits `provider_token_required` before provisioning. Hosted execution of this SDK
runner remains unverified because operator credentials are unavailable locally
and GitHub's team read still returns 403.

Separate manual connector diagnostics established the following actual results;
they do not stand in for a successful hosted SDK run:

| Session / command | Test and result | Final lifetime / active CPU |
| --- | --- | --- |
| `sbx_DUZjKQGoVrto0yZJ0cLsglfTskcj` / `cmd_58f04c5acfdf4af196935ce910a9` | Default image: Docker and runc absent; setpriv/unshare/prlimit/chroot available; cgroup controllers listed | Stopped; 14,471 / 1,730 ms |
| `sbx_vkD1ygSo1PFMTvJJiGsMXGeb24wv` / `cmd_e414431cadce44e39f77d56d0b22` | Digest-selected provider image accepted. Mount/network namespaces and UID/GID 65532, no-new-privileges, zero effective capabilities succeed. An empty child cgroup was removed; memory/PID/CPU control files were not established | Stopped; 11,870 / 1,763 ms |
| `sbx_LaCxDUlU9r2b69Zm1lJvRwhQRpcM` / `cmd_9760983eb76b417996bdce983bc8` | Same pin and namespace/privilege-drop results. Enabling missing child controllers did not establish writable memory/PID/CPU limits; parent controller state was restored | Stopped; 15,005 / 1,820 ms |

Each used Singapore, no failover, deny-all egress, no environment/ports and a
60-second provider timeout. The primitive commands exited zero in 132/130 ms;
their JSON explicitly reports unsuccessful controls. The last session's stopped
state and zero routes were independently read back. Every created session was
explicitly stopped. No VCR push, stored custom image, snapshot, drive or paid
resource was requested. The three follow-ups total 41,346 ms of VM lifetime and
5,313 ms of active CPU; provider memory accounting has minimum rounding and is
not inferred from that lifetime.

These results establish promising primitives, not a safe inner execution engine.
They neither prove that cgroup delegation is impossible nor authorize replacing
aggregate limits with per-process limits. The next technical work is to qualify a
trusted runtime artifact/launcher and aggregate enforcement without exposing
setup authority to learner code. Full hostile memory/fork/CPU/output/file/disk,
cancel/residue tests and signed result validation remain open. Core repository
verification passes 656 tests plus formatting/lint/typechecks/docs/secret checks.
