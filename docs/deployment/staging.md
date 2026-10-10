# Phase 12 staging deployment

Status: Phase 12 entry authorized 2026-10-10. Task 55 is in progress. The owner selected **Vercel for the web application** and explicitly instructed creation of a new project. Project `algocove` (`prj_y4QC0yhk2h2frXDs8l3H0yn9IjJK`) is in `vsuman00s-projects` (`team_LGvZpIlcg4QXoGDvgCh1JX0v`). The first protected Preview deployment is `READY` at [algocove-staging-vsuman00.vercel.app](https://algocove-staging-vsuman00.vercel.app); application health/readiness and the Clerk sign-in form pass hosted smoke checks. Next.js 16.3.8, Node 22.x and region `sin1` are confirmed by build/deployment evidence. No production promotion or Git auto-production link was enabled. Supporting execution/worker infrastructure and complete hosted assurance remain pending. See the [exact revision and verification record](../evidence/phases/phase12-evidence.md#first-verified-hosted-web-deployment).

## Reproduce the web preview

Use project `algocove` in the team above, GitHub repository `vsuman00/AlgoCove`, branch `feature/phase12-staging-foundation`, and an exact commit whose three GitHub CI jobs passed. Use `apps/web` as the root, include source files outside that root, and use Node 22.x. Set install command `npx --yes pnpm@12.4.2 install --frozen-lockfile` and build command `npx --yes pnpm@12.4.2 run build`; `apps/web/vercel.json` declares `sin1`.

Bind web settings to the **Preview** environment: `DEPLOYMENT_ENVIRONMENT=staging`, canonical `APP_ORIGIN=https://algocove-staging-vsuman00.vercel.app`, restricted pooled `DATABASE_URL` with `sslmode=verify-full`, both Clerk keys, and the private telemetry correlation key. Keep `TUTOR_ENABLED`, `ROADMAP_PROPOSAL_ENABLED` and `EXECUTION_ENABLED` false. Do not upload local/test, migration/operator or worker-only credentials. Never put credential values in a command body, deployment metadata or evidence document.

With Vercel's create-deployment API, omit `target` for Preview; its literal `preview` string did not select the intended environment in the first attempt. Verify the response's target is `null`, state reaches `READY`, source commit is exact and `regions` is `sin1`. Bind the stable staging alias to that preview. Retain Deployment Protection and test through authenticated access; an unauthenticated Vercel login page is not application liveness. Require health/readiness HTTP 200, application signed-out session/review HTTP 401, and a rendered Clerk form before recording the preview as smoke-verified. This manual procedure is not the complete Task 56 promotion/rollback pipeline.

## Required deployment decisions

Record the exact Vercel team/project and staging origin, single function/data region, managed PostgreSQL+pgvector provider with PITR, isolated gVisor execution hosts, worker supervisor, durable deletion ledger, telemetry destination and monthly cost ceiling. Hosted retention, legal regime, minor-user policy, RPO/RTO and incident ownership require the Task 4 decisions before real learners are admitted. Vercel selection does not select those supporting services or approve learner-data processing.

The [deployment-neutral ADR](../adr/0010-deployment-neutral-single-region-first.md) remains the capability boundary: managed data recovery and isolated hostile-code execution are mandatory. Vercel web functions must not receive Docker sockets, execution-host signing keys, worker database credentials or migration/operator credentials. Continuous worker processing and hostile-code sandboxes use separately operated processes.

## Selected database: Neon Free in Singapore

The owner requires a strict **$0/month** budget and approved Neon Free in Singapore on 2026-10-10. Appwrite native PostgreSQL requires a paid plan, so it cannot meet that budget. No paid upgrade or paid add-on is authorized.

Neon project `algocove-staging` (`bold-sky-06853855`) belongs to the connected Free organization `org-little-recipe-73838154`, region `aws-ap-southeast-1`, PostgreSQL 17. The dedicated `staging` branch/database is synthetic-only, with 40 migrations applied. Migration credentials use the direct endpoint; the restricted web runtime uses the pooled endpoint. Credentials are generated and stored with mode 0600 in the operator's private `~/.config/algocove/staging.json`, outside this repository. Never commit or paste that file. The web runtime must receive only `DATABASE_URL`, never operator/migration credentials.

Live read-only inspection passed certificate/hostname-verified TLS, restricted runtime capabilities, pgvector and the Phase 11 migration watermark for both direct and pooled connections. No existing local learner database was copied to staging. `apps/web/vercel.json` declares Singapore and the successful deployment's metadata confirms `regions: ["sin1"]`. Singapore is chosen for proximity to India, not an assertion of India-only data residency.

Neon's current Free plan includes 1 GB of database storage per project, 100 CU-hours/month, 5 GB/month public transfer and a six-hour restore history window. It suspends at compute/transfer limits and requires scale-to-zero. Do not rely on paid SLA, private networking or longer recovery retention. Actual hosted restore/RPO/RTO qualification remains Task 57; preserving $0 is not proof that the whole pilot architecture is provisioned.

Vercel preview secret creation returned HTTP 403 from the connected API. The owner uploaded the prepared web environment manually; hosted configuration/database readiness now passes. The connector still cannot inventory the variables for independent read-back. The rendered Clerk instance is in development mode; actual authenticated lifecycle and production identity configuration remain unqualified. Production has not been promoted. Retain execution/AI-off until their separate requirements pass.

Sources: [Neon regions](https://neon.com/docs/introduction/regions), [Free plan limits](https://neon.com/docs/introduction/plans).

## Historical provider assessment: Appwrite

The owner initially proposed Appwrite on 2026-10-10, then selected Neon Free after clarifying the $0 budget. Its **managed PostgreSQL** product provides direct PostgreSQL connections, custom roles, extensions including pgvector, backups and optional PITR. TablesDB, DocumentsDB and VectorsDB are different products and are not substitutes for this repository's SQL migrations. Keep Vercel web hosting, Clerk identity and the existing PostgreSQL schema/authorization boundaries.

Qualify a PostgreSQL 17 staging database to match the current reference engine before considering a version upgrade. Use separate restricted runtime and administrative credentials. Appwrite documents a transaction pooler on port 6432 and direct connections on 5432; migrations and session-dependent operations require the direct endpoint. Review read/write splitting before enabling replicas because stale reads can invalidate authorization and read-after-write expectations.

There is a transport qualification gap: Appwrite documents TLS termination at its edge. Our current `pg_stat_ssl` inspection observes the PostgreSQL backend connection and may reject a securely encrypted client connection behind that proxy. Verify hostname/certificate validation with the actual Node driver and separately qualify the internal network hop; do not bypass the preflight or weaken TLS verification to obtain a pass. No actual Appwrite connection, migration, role or recovery test has been run yet.

Native PostgreSQL requires a paid Appwrite plan. Compute starts at $10/month and PITR adds 20% of the compute tier before plan charges, credits and overages. Select the project region and cost ceiling before provisioning; the database inherits its Appwrite project region. For an India-focused audience, Singapore is a candidate to evaluate alongside Vercel's matching function region, subject to the hosted data-location decision.

Sources checked 2026-10-10: [managed PostgreSQL](https://appwrite.io/docs/products/databases/postgresql), [connections and roles](https://appwrite.io/docs/products/databases/postgresql/connections), [pooling](https://appwrite.io/docs/products/databases/postgresql/connection-pooling), [network security](https://appwrite.io/docs/products/databases/postgresql/network-security), [backups and PITR](https://appwrite.io/docs/products/databases/postgresql/backups), [pricing](https://appwrite.io/pricing).

## Implemented web admission

`apps/web/instrumentation.ts` uses Next.js's server initialization hook to call the shared configuration admission check before route initialization. Invalid hosted settings prevent route execution and return HTTP 500; Next.js can keep the listening process alive after this initialization error. CI's `pnpm test:hosted-startup` verifies both the built local liveness route and this unsafe-hosted rejection, including secret redaction. Set `DEPLOYMENT_ENVIRONMENT=staging` for staging and `production` for the eventual hosted production environment. Missing markers default to the existing local behavior, so provisioning must explicitly set and verify this marker; this is not automatic detection of an arbitrary hosting environment.

Hosted web admission requires:

- `NODE_ENV=production`, a canonical HTTPS application origin, complete Clerk configuration and a runtime database connection.
- A remote named PostgreSQL database with `sslmode=verify-full`; runtime configuration errors never echo connection values.
- A server-only telemetry correlation key of at least 32 characters.
- No `LOCAL_*` or `ALGOCOVE_TEST_*` settings, and no operator, schema-owner, content-worker or privacy-worker database credentials.
- Live tutor and roadmap generation disabled while hosted model/provider policy and promotion remain unapproved. Execution, if enabled, retains the existing authenticated HTTPS relay, signed callback and verification-key requirements; the relay origin must differ from the web origin.

Local builds, development and liveness remain independent of hosted credentials. A configuration pass is not proof of live authentication, network isolation, content publication, data residency or hosted recovery.

## Read-only staging preflight

Inject the selected staging web environment through the approved server-side secret configuration, then run from the repository root:

```sh
pnpm staging:preflight --configuration-only
pnpm staging:preflight
```

The first command does not connect to a database and reports `databaseChecked: false`. The second pins one actual runtime client and inspects its negotiated TLS, CA authorization and hostname identity, plus pgvector, the Phase 11 migration minimum through the existing health function, and role capabilities. It rejects superuser, role/database creation, replication, RLS bypass, privileged predefined role membership, database/schema/relation ownership or schema CREATE permission, and privileged privacy processing function access. Inherited owner privileges are checked as well as direct role attributes. A missing row, query failure or failed check fails closed. The command never runs migrations or writes learner records, and emits fixed check names/reason codes rather than driver exceptions or credentials.

This inspection is a bounded configuration/database gate. It does not prove every function/view privilege is safe and must accompany the existing authorization/least-privilege integration suite and an environment security review. TLS hostname/certificate verification is required by configuration and observed on the actual Node TLS socket as `verifiedClientTransport`. The lower-level SQL inspector retains `encryptedTransport` as a backend diagnostic; it is not used as a substitute for client transport verification behind a managed proxy. The internal provider network hop still requires the environment security review.

## Subsequent Phase 12 slices

1. Task 55: finish secret inventory/security review and network separation, and provision/qualify isolated execution and worker infrastructure. The Vercel web preview and co-located Neon database already have bounded smoke evidence.
2. Task 55a: run real hosted Clerk lifecycle/reverification tests, add and qualify privileged MFA/session controls, and verify immediate role removal and callback/cross-account rejection.
3. Task 56: bind quality checks to the exact deployment revision; independently promote signed execution images and reviewed content/AI configurations; rehearse schema-compatible rollback and migration retry.
4. Task 57: qualify hosted PITR/deletion replay, load and six-language limits, privacy/security, manual accessibility, SLOs, incidents and rollback. Admit the pilot cohort only after the named human readiness decision.

Independent curriculum publication remains pending. The Phase 12 task and milestone checkboxes remain unchecked until their actual acceptance criteria have evidence.

References: [Next.js instrumentation](https://nextjs.org/docs/app/guides/instrumentation), [PostgreSQL role and privilege inspection](https://www.postgresql.org/docs/current/functions-info.html), [PostgreSQL TLS connection statistics](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-SSL-VIEW), [Vercel deployment checks](https://vercel.com/docs/deployment-checks).
