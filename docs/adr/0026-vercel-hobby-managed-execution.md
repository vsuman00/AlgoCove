# ADR-0026: Qualify Vercel Hobby workers and managed execution

## Status

Accepted implementation direction by the owner's plan approval and request to start implementation on 2026-10-10. Provider capability qualification and learner execution activation remain pending. This is not a hosted-pilot readiness decision.

## Context

AlgoCove is personal and non-commercial, with a strict $0 budget and no separately hosted server. The owner selected Vercel. The Phase 12 execution supplement in [the plan](../../tasks/plan.md#phase-12-execution-supplement-vercel-hobby-workers-and-isolated-execution) defines VH-01–12. Existing worker consumers use PostgreSQL leases and effect receipts; the execution-control reference journal uses local SQLite and cannot be deployed unchanged to ephemeral Functions.

## Decision

- Use Vercel Queues to notify bounded Function consumers, retaining the transactional PostgreSQL outbox as durable truth. Authenticate callbacks and fence retries; daily Cron/manual reconciliation repairs missed notification delivery. Daily scheduling does not prove a prompt recovery SLA.
- Qualify Vercel Sandbox as a managed microVM boundary under ADR-0011, outside the web and worker processes. Every learner run requires a fresh network-denied environment, no service credentials, enforceable resource limits, an external trusted comparator, and signed normalized results.
- Keep Singapore as the target region close to Neon Free; verify actual regional support separately for each product. Document metadata/control-plane residency rather than inferring it from a function region.
- Replace ephemeral/local execution journaling with a durable, separately scoped store before end-to-end activation. Preserve lease fencing, terminal deduplication, cancellation and orphan cleanup.
- Admit resources only after verifying the actual existing team is Hobby. Missing billing information, Pro/trial plans, incorrect account/project scope and provider-access failures stop provisioning. The account check is read-only and cannot enable execution.
- Keep independent runtime signatures, content rights, identity, privacy recovery and readiness gates. Provider queues/workflow history are not an independent deletion ledger.

## Budget and runtime delivery

[Sandbox Hobby pricing](https://vercel.com/docs/sandbox/pricing) publishes included free usage and pauses creation after quota exhaustion. This does not qualify every ancillary service for $0. [VCR pricing](https://vercel.com/docs/container-registry/limits-and-pricing) lists image storage at $0.10 per GB; its [guide](https://vercel.com/kb/guide/how-to-use-vercel-container-registry) says storage is charged across plans. Therefore no custom image is pushed to VCR under this decision without a confirmed applicable free allowance. A Hobby repository-count limit is not a free-storage allowance.

The alternative to qualify is delivery of checksum/signature-verified, secret-free pinned runtime artifacts into a fresh Sandbox through the trusted control API, or another explicitly free supported image path. Default provider images may be used only for synthetic capability discovery; their mutable identity does not meet production runtime lineage requirements. No learner-time downloads/package installation or relaxed network policy is permitted to make an unsupported runtime pass.

Use application admission limits below the remaining shared team quotas, accounting for probes, retries, startup and provider rounding. Unknown headroom stops activation. No paid plan, trial, billing-enabled fallback, VM or paid AI provider is authorized.

## Implementation evidence and remaining gate

The first slice adds `ops/environments/vercel-hobby/account.ts` and a read-only preflight invoked by the existing GitHub credential-qualification workflow. Fourteen unit tests cover scope/plan rejection, redacted output, missing credentials and safe read-only requests. Typechecking and focused lint pass. The connector confirms the intended team but omits billing metadata. Read-only dashboard inspection confirms an active Hobby plan and no added payment method. GitHub token project reads succeed, but team metadata reads return HTTP 403 in qualification run 38069982446. This stops automated account qualification; dashboard observation is not an automated bypass. [Hosted discovery evidence](../evidence/security/vercel-hobby.md) records a separate bounded synthetic Sandbox probe.

VH-01 remains partial until actual Hobby status, remaining usage and a no-charge runtime delivery path are verified. VH-02 and Checkpoint A must establish equivalent limits before worker/execution migration is treated as feasible. Hosted learner execution stays disabled. The account-check slice provisioned no resources; a subsequent separately bounded synthetic capability probe created and stopped one default-image Sandbox, with no registry push. Its default user has passwordless sudo and an unlimited PID cgroup, so it does not qualify learner execution.

## Consequences and alternatives

An always-on VM is not mandatory if managed execution proves the same trust controls. Worker processes become bounded consumers; jobs exceeding Function deadlines need explicit checkpointing. Queue transport can be delayed or exhausted, so visible pending states and reconciliation remain essential. Neither successful CI nor a microVM marketing claim is evidence of hosted PID/disk/CPU limits, safe teardown or six-language conformance.

Keeping the current execution-disabled synthetic staging is the fallback when a free capability cannot be qualified. Executing learner programs directly inside Next.js Functions and weakening existing release gates are rejected. Optional Workflows can be considered later after its own usage/retention qualification; it is not required for the first maintenance job.
