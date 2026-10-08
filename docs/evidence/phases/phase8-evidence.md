# Phase 8 implementation evidence

## Authorization and status

The owner authorized Phase 8 on 2026-10-06 and subsequently directed completion of the implementation. Tasks 38–40 are complete locally with the evidence below. F8 technical checks pass; the owner authorized Phase 9 on 2026-10-06. The real-link check was performed visually through native Safari controls by the agent; it is not human content approval. Historical architecture/manual design approvals and hosted deployment authorization are separate.

## Task 38: Governed readiness and server grading

`packages/domain/src/readiness-gate.ts` evaluates published per-problem/mode policies across concept, pattern, invariant, pseudocode, execution and visualization. Decisions carry rubric identity/version, understandable reasons and accepted evidence IDs. Confidence cannot satisfy the gate. Execution requires server-observed tests; other categories require structured or human-reviewed correctness. Facts must match learner, attempt, problem version, language manifest, source checksum, saved reasoning revision and rubric version. Missing/unpublished policies, unavailable content, stale artifacts, unsupported provenance, unknown/excessive assistance and bypass requests fail closed. Practice bypass remains disabled without product approval.

`packages/application/src/evaluate-readiness.ts` and `external-companion.ts` expose owned application boundaries. `PostgresExternalReadinessRepository` loads a consistent read-only snapshot, including rights/content/manifest availability, draft expiry, saved reasoning revisions and cumulative per-problem hint exposure. The latest matching fact for each check governs; an earlier positive fact cannot override a later correction.

`PostgresExternalCompanionRepository` grades authored preparation questions on the server, requires complete saved reasoning for its pseudocode check, and links execution facts to an actual trusted passing submission assessment for the exact source/attempt/manifest. It never accepts caller-provided correctness, policy, provenance or learner identity. Readiness facts do not write mastery. Real execution result ingestion and mastery/review scheduling retain their existing internal assessment boundaries.

Migrations `0026_external_readiness.sql` and `0027_external_companion.sql` add governed policies, immutable facts, content audits and external journal lineage. Published policies are immutable except retirement. Publication requires distinct author, technical reviewer, pedagogical reviewer and publisher identities with active matching grants. No production rubric or learner evidence is seeded by these migrations.

The `/admin/readiness` workflow and authenticated `/api/admin/readiness` endpoint support reference authoring/review, policy authoring, independent technical/pedagogical review, publication and retirement. The original Container preparation template is an unpublished staff draft, including a proposed assistance limit; it is not an approved universal threshold. Answer keys are returned only to authorized content staff, never in the learner preparation view or public client template.

## Task 39: Safe outbound admission and reversible journal

The authenticated, bounded `/api/practice/external-companion` endpoint connects preparation view/grading, outbound admission and completion/correction actions. Writes lock the learner, owned attempt, current artifacts, content/manifest and published policy. Outbound admission locks and reloads the reviewed reference, then rechecks readiness and availability in the transaction. Retired policies, changed source/reasoning, excessive assistance and withdrawn references cannot reuse a stale readiness display to admit navigation.

Destinations require an allowlisted canonical HTTPS URL without credentials, fragments, nondefault ports or query data; LeetCode outbound admission also restricts the canonical problem path. Navigation is a normal new-context anchor with `noopener noreferrer` and `no-referrer`. No provider credentials, cookies, profile, submissions, scraping or synchronization are accessed.

The append-only journal records an idempotent `handoff_requested`, meaning a navigation request rather than proof that a page opened. Completion is explicitly learner-confirmed; correction appends a reversal. Owner/action/attempt/reference conflicts reject idempotency-key reuse. A gated handoff is required before confirmation, and a completion is required before correction. Historical reports can be corrected after reference withdrawal. Reopening a link does not erase a completion. External reports affect follow-through counts, not mastery, learning activity or review scheduling.

The workspace synchronizes current artifacts before grading and fences asynchronous results by account, attempt, language, source and reasoning state. Edits clear the prior readiness result. Journal/network uncertainty preserves a safe normal-link fallback from the last approved ready view and explicitly reports that no navigation receipt was confirmed; an explicit rejection clears the link. Progress no longer exposes the former direct provider-handoff bypass and links learners back to internal preparation.

## Task 40: Complete journey evidence and validation

The provider-stubbed browser journey covers an accepted plan item, internal workspace/reasoning save, authored preparation, readiness, journal failure fallback, actual popup navigation target, return, learner-confirmed completion, correction, blocked destination, source invalidation, narrow-screen accessibility a practice-bypass rejection from the actual domain evaluator with no outbound action, and a visible scheduled review exercise on return. It exercises real UI with controlled API responses; it is not evidence of a provider account solve or real-host execution.

The PostgreSQL companion integration exercises the actual author/reviewer/publisher commands, owned grading, trusted-result ingestion, gated admission, idempotency/conflicting intent, withdrawal, stale source, cross-owner rejection and legacy bypass rejection. It proves external reports preserve mastery/activity/review state. The companion SQL journey now consumes its own trusted assessment outbox event into the actual mastery/review scheduler. It asserts the review origin observation and attempt, due state, available published test exercise and absent answer keys. After external confirmation/correction, the exact SQL-backed review item remains unchanged and is rendered in Chromium with its overdue label and authored question. The main browser E2E uses a nonempty transport fixture; the SQL/browser integration proves its underlying scheduled data rather than treating that fixture as persistence evidence. A bypass request against the actual owned PostgreSQL readiness snapshot also rejects even when preparation is otherwise ready. Test-only staff identities and trusted-result fixtures are not human content approval or live execution-host evidence.

Final recorded automated results:

- `pnpm verify`: 298 unit/web/architecture tests, plus formatting, lint, typechecking, tokens, documentation and secret checks.
- `pnpm test:integration`: 65 passed, two Linux-only cases skipped; all 27 migrations applied to empty disposable PostgreSQL/pgvector databases.
- `pnpm build`: production build passes with the learner and staff routes.
- `pnpm test:e2e`: four browser tests pass, including the companion journey.
- `pnpm test:a11y`: 31 browser accessibility checks pass; the companion journey also passes axe at 320 px.

Captured browser network requests show one provider navigation to the canonical URL, no referrer header, and no query data on companion API/provider requests. `tests/unit/web/companion-telemetry.test.ts` executes the real runtime error response/logger with private query/body/error-message markers, captures the emitted stderr record and verifies only event/status/trace/category/code/retryability are logged. No private markers or URL/body fields appear. These are controlled runtime checks, not production telemetry.

The narrow-screen journey exposed two existing horizontal scrollers without keyboard focus; the guided path and trace stage now accept keyboard focus. Current user data and retained learner backups were untouched. Changes remain local and uncommitted.

## Activation and remaining human gates

No retained user database was migrated, no production rubric published, and no hosted deployment performed. Activation requires applying migrations through the existing operator workflow, then independent content staff reviewing and publishing an actual reference/rubric through `/admin/readiness`. The default learner state remains unavailable/incomplete until that content exists.

On 2026-10-06, a native Safari visual check opened `https://leetcode.com/problems/container-with-most-water/` in a new tab. The accessibility tree and screenshot showed “Container With Most Water - LeetCode” and the expected problem title; the final address was `https://leetcode.com/problems/container-with-most-water/description/`. HTTPS remained valid, and no interstitial or broken-link error appeared. The agent used only native tab/address controls and read the resulting screen, then closed its new tab, restoring the prior tab. No provider login, code edit, run, submission or discussion interaction occurred. This satisfies the visual real-link criterion and does not authorize publishing the reference/rubric. Earlier claims that a browser was unavailable were based only on the browser connector inventory; native Safari provided the required check.

F8 technical checks pass. The owner authorized entry to Phase 9 on 2026-10-06.
