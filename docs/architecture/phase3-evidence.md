# Phase 3 implementation evidence

**Status:** Technical implementation slices complete; F3 transition remains pending explicit owner authorization for Phase 4. Runnable content publication remains blocked until Task 23 execution conformance.

## Implemented

- Curriculum concepts and graph versions are versioned. Required, recommended, and related edges remain distinct, graph publication rejects cycles and unknown references, and published rows are immutable in PostgreSQL. The application exposes a pinned-version resolver for historical consumers.
- Problem content has stable identities and immutable versions. Draft creation requires bounded metadata, a checksum, provenance, rights holder, and license. Original candidates may store authored statements; licensed candidates may store metadata and a reviewed source URL only.
- Technical and pedagogical reviews are separate append-only decisions. Publication requires both approvals, passed metadata validation, available rights, and separation from the author. Retirement supports rights/security tombstones while safe historical metadata remains resolvable.
- Problem manifests require exactly six language IDs: `python`, `javascript`, `typescript`, `java`, `cpp`, and `c`. Each language has a distinct adapter and profile; one semantic fixture ID set must map to every language. JavaScript/TypeScript and C/C++ remain distinct contracts.
- External references store provider identity, canonical reviewed HTTPS metadata URLs, attribution, status, and collection membership only. Provider-specific host allowlists reject lookalikes and credentialed URLs. One external identity can belong to multiple collections without duplicate membership rows.
- The admin content-operations preview shows one original candidate, separated reviews, validation, six-language evidence, a reviewed outbound source link, lifecycle evidence, and a disabled fixture-only publication action. It contains no copied third-party statement, solution, test, or credential.

## Evidence run

- `pnpm verify`: pass; 18 unit/web/architecture files and 70 tests passed.
- `pnpm build`: pass with Next.js 16.3.5 and the admin content routes present.
- `pnpm test:integration`: pass; 12 isolated PostgreSQL/pgvector tests passed, including graph immutability, content immutability, six language profiles, manifest mutation protection, external URL validation, and collection overlap.
- `pnpm test:a11y`: pass; 8 Chromium accessibility/responsive tests passed, including the admin list/detail flow at 320px.
- `npx --yes pnpm@12.4.2 audit --audit-level high`: pass; the repository declares pnpm 12.4.2. A globally installed pnpm 9 reports the pnpm 12 lockfile's package-manager metadata as a broken multi-document lockfile, so the declared toolchain is used for this gate.
- `pnpm security:secrets`: pass; no committed secret-shaped material found.

## Explicitly pending

- Task 23 must prove isolated execution and six-language semantic conformance before any internal problem is marked runnable or the fixture publish action is enabled.
- F2 still lacks live Clerk sign-in, sign-out/revocation, and authenticated browser proof because a Clerk test account has not been provisioned.
- F3 owner authorization for Phase 4 remains a governance decision, not an implementation claim.
