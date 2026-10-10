# Hosted release procedure

Phase 12 is a protected synthetic staging release. Hosted execution and workers remain unprovisioned; there is no real learner pilot admission.

## Exact revision admission

Run `node ops/release/preflight.ts --sha <40-character-commit>` before deploying. It checks the latest CI run for that revision and requires all three named quality, execution and stronger-sandbox jobs to finish successfully. Missing, skipped, cancelled, failed, duplicate or pending jobs reject admission. An older successful run cannot override a newer failed run. Application and execution-image workflows use this same check.

`apps/web/vercel.json` disables automatic Git deployments from `main`. This policy takes effect after the configuration is merged and read by Vercel. The observed merge on 2026-10-10 had already produced a production-target deployment before complete CI; the configuration change closes that future path, not the historical deployment.

The gated web workflow reacts only to successful same-repository `main` push CI, checks out that exact SHA, and creates a Preview through the scoped project API. Production targets are rejected and cancellation is attempted before build completion. Deployment protection stays enabled; a short-lived share cookie checks liveness and database readiness, then the temporary access is revoked. No production promotion command is issued. A payload-free receipt retains SHA, CI identity, immutable URL and smoke results.

The deployment job binds the existing GitHub environment `Preview` and reads the repository Actions secret `VERCEL_TOKEN` for project `algocove` in `vsuman00s-projects`. The owner moved the token from an initially created environment secret to Repository secrets. The separate credential-qualification workflow checks access to the expected project without deploying. Never put the value in source, chat or artifacts. Missing credentials stop the workflow before deployment. Provider environment values stay in Vercel. [Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration) and [protected CLI requests](https://vercel.com/docs/cli/curl) define these controls.

## Schema and rollback

Apply additive migrations using the migration identity, then retry the same runner: applied checksums must match and already-applied migrations must skip. Never perform destructive schema contraction during a rollback window. The hosted foundation applied 40 migrations and skipped all 40 on retry. The runtime identity cannot migrate or assume the operator role.

Retain the previous immutable Preview and its schema watermark. Before moving a staging alias, verify both current and prior artifacts against the additive schema, hosted identity configuration and current deletion state. Roll back the application alias only; do not silently revert content, AI policy, database or execution-image lineage. If the old application is incompatible, stop writers and ship a forward fix or restore into an isolated database with durable deletion-ledger replay. [Incident procedure](../../ops/runbooks/release-incident.md).

Execution images have a separate dispatch/tag workflow: exact-CI admission, build provenance and SBOM, high/critical vulnerability gate, digest signature and identity/issuer verification. A failed scan must never produce an approved signature. Signed image publication does not provision a host or enable execution. Content and AI configuration continue to use their existing governed publication gates.

## Qualification still required

The CI admission rejection cases are tested locally; a live failing-CI deployment attempt, complete independent image/configuration lineage, full hosted authentication qualification, hosted recovery/deletion replay and pilot assurance still need current receipts. [Phase 12 evidence](../evidence/phases/phase12-evidence.md) records demonstrated results separately from these requirements.

Merged-main CI admission, the credential-bound protected Preview workflow and dedicated alias rollback have now passed. The first independent image release correctly blocked Java signing on its vulnerability scan; only two profiles completed. [Current receipts and limits](../evidence/phases/phase12-evidence.md#merged-main-release-and-free-hosted-assurance).
