# Shared learning platform contract

Task 45b, 2026-10-07. Owner-authorized Phase 10 implementation direction; this contract resolves ADRs 0019–0021 for the bounded extension. Implementation and browser evidence remain separately tracked in [work cards](work-cards/phase10-platform-extension.md). Independent publication signatures are not supplied by implementation approval.

## Query surface

Application queries own the following views. Server components call queries directly; route handlers call the same use cases. Public views contain explicit allowlisted fields. Never serialize database rows or author bundles. Private overlays require an authenticated learner and ownership, use `no-store`, and never enter public cache entries. Initially all catalog responses use `no-store`; caching is optional future work.

| Query | Input, ordering and pagination | Result and authorization |
| --- | --- | --- |
| ListPublishedTopics | `after` slug, `limit` default 20/max 50, optional bounded search; slug order | Published topic identity/version, title, objective, prerequisite IDs and counts of eligible exercises; public summaries only |
| ListPublishedProblems | `after` canonical slug, `limit` default 20/max 50, optional `search` (trimmed, max 100), `pattern` slug and supported `language`; slug order | Stable problem/content IDs, exact version IDs/checksum, slug, title, pattern, available languages and workspace action; public summaries only |
| GetLesson | Exact lesson version or published slug | Reviewed typed blocks, objectives, prerequisites and eligible next/previous links. Authenticated checks and private progress are separate; no answer/rubric keys |
| GetSheet | Collection identity/version and bounded section cursor | Ordered, attributable memberships, reviewed mapping kind and supported-internal/external-only/unavailable counts. Public curated view; private sheets remain deferred to Task 59a |
| GetProblemWorkspace | Canonical/approved alias slug, language; optional owned attempt identity | Available statement/lesson/manifest, exact pins and owned draft receipt. Starting/revealing/running/handoff uses existing commands and fresh availability checks. Restricted traces/references follow reveal policy |
| GetEligiblePlanningCatalog | Authenticated actor, existing validated roadmap preferences | Same eligible problem versions and languages, prerequisite graph version, reviewed estimates, deduplicated memberships and owned review obligations. Existing deterministic capacity validator and explicit learner acceptance remain authoritative |

Unknown filters, invalid cursors/languages/limits produce the existing typed 400 envelope. Empty lists are 200 with no cursor; distinguish no published content from no matches at the presentation layer. Missing/withdrawn/private IDs use neutral 404; dependency failures use retryable 503; owned writes preserve existing 403/409/idempotency contracts. Cursors are keyset slugs, not offsets or encoded private state. Fetch `limit + 1` and expose `nextAfter` only when another matching item exists. No unbounded bulk catalog endpoint.

## Availability and release pins

An exercise is eligible only when its content version is published, its payload is available, rights are current and all six language manifests are published. Each requested language must be supported. Draft, retired, expired, tombstoned and incomplete content never creates a workspace action. External-only availability requires independently reviewed destination/mapping state; opening an outbound URL grants no evidence.

Slug identity is independent of a version. A stable canonical problem route and approved aliases resolve to the latest eligible immutable version using publication time then version identity as a deterministic tie breaker. Starting a new attempt uses that result. Resuming an attempt preserves its problem/content/manifest IDs; slug re-resolution never rewrites history. Retired content may retain lawful metadata but new commands must reject it. Rights/security withdrawal denies protected payloads even for pinned attempts under the existing withdrawal policy.

The release manifest schema is version 1, with stable release identity, exact problem/content IDs, checksum and exact asset version references for lesson, approach, pseudocode, trace scenario, rubric, hints, language manifests and recall/transfer. Asset references carry identity, version and checksum; no floating `latest` references. Six languages are mandatory for a runnable release. Publication validates all required relationships transactionally; manifest composition does not introduce a second publication authority. Existing pilot v1 bundles are an atomic legacy release adapter until typed asset migration is delivered. Existing attempts keep their pins; typed manifest admission must not change them implicitly.

## Content schemas and compatibility

| Asset | Admission and restriction | Compatibility |
| --- | --- | --- |
| Problem/pilot v1 | Existing original-content review and six-language guards | Remains readable; no reimport/republication during route migration |
| Lesson v1 | Bounded prose/example/pseudocode-reference/trace-reference/checkpoint blocks; exact referenced versions | New content kind admitted in an additive migration with publication and retrieval allowlists; arbitrary HTML/JS/React components prohibited |
| Approach/pseudocode v1 | Stable unique line IDs, reviewed complexity and scenario references | Additive typed assets; renderer cannot infer container-area calculations |
| Walkthrough | Deterministic validated frames, active line IDs, variables, structure and narration; prediction answers server-only | Existing schema-1 array trace and schema-2 pilot traces remain readable through explicit adapters; unsupported schema versions rejected |
| Mapping/collection | Canonical platform + external identity; independent versioned ordered provenance | Preserve legacy reference/journal IDs; ambiguous source-list URLs require review before solve action |

One replay state drives visual state, active lines, variables and narration. Scrub/restart restores the same frame as sequential stepping. Approach/scenario changes reset playback, not learner drafts. Playback/camera actions grant no judged correctness. References remain behind the server reveal policy; presentation projections exclude solutions, fixtures, hidden rubrics and checkpoint answers.

## Migration and rollback

Use expand/migrate/contract. First add stable problem routes/aliases, backfill only registered existing canonical identities, and register new pilot imports without changing immutable content or attempts. Route rows bind problem identity, not content versions. Add new kinds/manifests only in subsequent bounded migrations with focused publication tests. Preserve old pilot storage/readers throughout migration. No destructive schema change or production data conversion is authorized by this card.

Rollback routes/readers to legacy behavior before dropping additive tables in an isolated local database; preserve migration checksums and all attempt/journal/content IDs. Do not edit applied migrations or run destructive down scripts against a populated database. Future typed-asset rollback hides newly unsupported entry points while preserving versions/attempt records. Destination rollback retains legacy columns until all readers/writers and ambiguous references are reconciled.

## Approved interaction scope

Reuse DESIGN section 29 and existing tokens, focused workspace and spatial/flat/text options. Preserve Understand → Pseudocode → Trace → Implement → Validate. Panels preserve drafts and focus; display state never mutates attempts. Add navigation only for delivered destinations. Keep one plan authority for `/plan` and `/roadmap`, plus validated same-origin return context. User instruction to follow the new architecture authorizes this interaction direction for Phase 10; browser verification still must demonstrate delivered behavior. No screen-reader or independent human publication pass is inferred.
