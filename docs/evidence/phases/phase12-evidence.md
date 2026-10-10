# Phase 12 staging foundation evidence

Recorded 2026-10-10. Phase entry is owner-authorized. Task 55 is **in progress**; Tasks 55a, 56 and 57 remain incomplete. See the [staging guide](../../deployment/staging.md) for configuration and remaining hosted decisions.

## Repository verification

- `pnpm verify`: 548 core tests pass; lint, types, formatting, design tokens, documentation links and secret checks pass.
- Focused database lifecycle suite: 15 tests pass against disposable PostgreSQL, including restricted runtime, owner rejection and inherited privileged-role rejection. Local plaintext transport correctly fails the hosted transport check.
- Production Next.js build passes.
- `pnpm test:hosted-startup`: three tests pass against that build. Local liveness remains available without hosted credentials; unsafe hosted initialization returns HTTP 500 without leaking a credential canary; configuration-only preflight explicitly reports that it has not checked a database.

These are local engineering results. No hosted identity, migration, restore/PITR, load or pilot-readiness claim follows from them.

## Provider actions

Vercel project `algocove`, ID `prj_y4QC0yhk2h2frXDs8l3H0yn9IjJK`, was created in team `vsuman00s-projects`. The project API confirms Next.js and Node 22.x. Monorepo root, external workspace inclusion and pinned install/build commands were submitted successfully, but the connector response does not expose those fields for independent read-back. No deployment or Git auto-production link was enabled.

Appwrite managed PostgreSQL is the owner's proposed database provider. Its published capabilities match several architecture requirements, but the actual database and recovery behavior are unqualified. In particular, edge TLS termination needs client-side transport evidence beyond the current backend-only SSL observation. Region, budget, supporting execution/worker infrastructure and hosted policy decisions remain open.
