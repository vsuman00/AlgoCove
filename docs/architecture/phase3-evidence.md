# Phase 3 implementation evidence

**Status:** Technical implementation slices and manual browser validation are complete. The owner authorized Phase 4 transition work on 2026-09-17. Runnable content publication remains blocked until Task 23 execution conformance, and no Phase 4 execution task is claimed implemented by this record.

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
- `pnpm test:integration`: pass; 13 isolated PostgreSQL/pgvector tests passed, including graph immutability, content immutability, six language profiles, manifest mutation protection, external URL validation, collection overlap, and the execution outbox claim/retry boundary.
- `pnpm test:a11y`: pass; 8 Chromium accessibility/responsive tests passed, including the admin list/detail flow at 320px.
- `npx --yes pnpm@12.4.2 audit --audit-level high`: pass; the repository declares pnpm 12.4.2. A globally installed pnpm 9 reports the pnpm 12 lockfile's package-manager metadata as a broken multi-document lockfile, so the declared toolchain is used for this gate.
- `pnpm security:secrets`: pass; no committed secret-shaped material found.

## Manual browser verification

- The current production build was loaded in Chromium with the anonymous fixture contract at `/admin/content`, then the candidate workflow was opened.
- The browser visibly showed original provenance and rights, separate approved technical and pedagogical reviews, passed metadata validation, six explicit language adapters (`python`, `javascript`, `typescript`, `java`, `cpp`, and `c`), reviewed outbound metadata, and the no-third-party-copy boundary.
- The `Publish fixture (locked)` control was disabled, and the page identified Task 23 isolated execution conformance as the publication blocker.
- The detail page had no horizontal overflow. The browser reported no application errors; the only console message was Clerk’s expected development-key warning.
- The official Chromium accessibility suite passed all 9 tests, including the 320px content-workflow check.

## Explicitly pending

- Task 23 must prove isolated execution and six-language semantic conformance before any internal problem is marked runnable or the fixture publish action is enabled.
- The owner authorized Phase 4 transition work on 2026-09-17. This authorizes the next phase to begin; it does not substitute for Task 19 sandbox evidence or the F4 security checkpoint.
