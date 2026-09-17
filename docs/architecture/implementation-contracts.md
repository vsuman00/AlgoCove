# AlgoCove implementation contracts

**Status:** Proposed design corrections from the architecture review. No implementation or runtime assurance is claimed.

This document resolves details omitted or contradictory in the first plan. It complements the system, data, and interface views. Task IDs below refer to [the implementation plan](../../tasks/plan.md).

## 1. Scope, content, and external mapping

The learner first practices inside AlgoCove and then independently follows the reviewed source link. Account synchronization remains excluded, including future integration as an implied dependency.

An internal exercise and an external problem have separate identities. A reviewed many-to-many mapping records `equivalent_problem`, `same_pattern`, `prerequisite`, or `transfer`, with rationale and compatible input/output assumptions. Never label an original same-pattern exercise as the exact LeetCode problem. Exact reproduction is eligible only when content rights permit it; attribution alone is not a content license. Mapping and collection provenance are reviewed manually; no background scraping, account inspection, or content ingestion is introduced by link maintenance.

An external reference is versioned, with a mutable operational availability status. Collection membership references a versioned sheet and stable external identity. Collection selection does not prove complete sheet coverage: show total mapped entries, internally supported entries, external-only entries, and unavailable entries separately. `external-only` entries can be bookmarked but cannot advertise an internal learning gate until a compatible internal unit exists. Unsupported items cannot count toward internal course completion.

Four topic bundles establish an engineering pilot only. They do not constitute comprehensive interview DSA or an entire named sheet. Phase 13 adds the approved breadth before full-course claims: language foundations and complexity, arrays/strings/hashing, sorting/binary search, linked lists, stacks/queues, recursion/backtracking, trees/BSTs/tries, heaps, graphs, greedy, dynamic programming, and selected interval/bit/math material according to the chosen track. Coverage and reviewed content availability constrain every plan. A six-month horizon does not justify padding an incomplete course with repeated exercises. Return a scoped plan or an infeasibility explanation when coverage is insufficient.

## 2. Roadmap data and state

`planning` owns plan intents, candidates, accepted versions, and scheduled items. `learning` owns curriculum, versioned collections, and external references. `practice` owns internal attempts, pseudocode, drafts, and external journals. An application workflow composes owner ports; roadmap logic never owns attempt writes.

Plan status: `draft -> active -> paused -> active`, with terminal `completed` or `archived`. Candidate status: `building -> valid | invalid | failed | expired`; a valid candidate becomes `accepted` only through an explicit learner command. The active version pointer changes atomically with acceptance. Use an expected active-version token so two tabs cannot silently activate competing plans. At most one active primary plan per learner in the first release. Supporting collections are views within that plan.

Each `PlanItem` has a kind: `lesson`, `internal_problem`, `external_practice`, `review`, or `buffer`. Database constraints enforce the appropriate foreign key: lesson to content version; internal problem to problem version; external practice to external-reference version; review to review item; buffer to none. No universal non-null problem foreign key. An optional readiness mapping connects an external item to its internal preparation. Activity occurrences are distinct from content IDs: a deliberate repeat gets a new occurrence ID and reason, while duplicate sheet membership does not create extra work.

Keep due windows, estimated minutes, optional/required flag, prerequisite edges, policy/config versions, curriculum snapshot, and reason codes with the accepted schedule. Outcomes are append-only journal events; corrections append reversals rather than delete history. The home recommendation queries eligible items in the active plan plus due reviews. An out-of-plan recommendation must be explicitly labelled and must not silently mutate the schedule.

## 3. Scheduling and calendar rules

Treat 1/2/3/4/6 months as presets; custom dates remain an explicit future decision. Derive the local end date by calendar-month addition with end-of-month clamping. If both target date and preset are supplied and conflict, reject the request for correction. Store the resolved dates and timezone used.

Construct available sessions from local study days and minutes. Reserve a versioned configurable buffer (proposed initial baseline: 15% of total capacity, rounded up), due reviews, then prerequisite-compatible required work. Optional work uses remaining capacity only. Reject an item exceeding a session unless the authored unit supports a named resumable split. Include estimated reading, pseudocode, visualization, coding, external practice, and review time; an estimate is not a guarantee. Never silently shorten an approved goal or remove required prerequisites.

A one-month novice plan may cover foundations only; an advanced learner may use that period for interview revision. Display the supported coverage before acceptance. Cold-start diagnostics supply structured evidence; learner confidence cannot waive required knowledge alone.

Replan previews show moved, removed, added, blocked, and retained items. A pause freezes adherence obligations prospectively; reviews may become due but do not create punitive failures. On resume, keep the deadline or propose extending it, requiring learner acceptance. Completed items and past due-window outcomes remain fixed. Date/timezone changes apply to future items with an audit event. Review obligations beyond the plan end remain visible in the review queue and in the completion summary.

## 4. Evidence and assisted learning

Use these evidence classes: `server_observed_test`, `structured_check`, `human_reviewed`, `model_advisory`, `learner_reported`, and `interaction_only`. Persist provenance and rubric version. A text field being nonempty only proves the artifact exists. Arbitrary prose, pseudocode, or watched animation cannot be declared semantically correct by a deterministic validator. Use reviewed answer keys, bounded ordering/prediction exercises, and test results for automated readiness; free-form explanations receive advisory feedback or human review. Readiness is permission to proceed, not a certificate of mastery.

Keep concept mastery language-neutral but expose a separate language-proficiency overlay. Switching from Python to C preserves concept evidence but does not imply fluency with C memory or syntax. Compile errors affect language feedback, not algorithmic mastery. Execution infrastructure faults affect neither.

Hint access is cumulative across retries, new attempts, and language changes for the same learner/problem version. Full solution or reference visualization disclosure marks the relevant attempt assisted before delivery. A new delayed transfer problem can establish independent evidence later. Showing a correct canonical trace can reveal the strategy; prediction checkpoints and disclosure tiers apply to reference traces, too. Learner draft traces are labelled `learner draft`, not canonically correct.

Restricted hints remain authored. A validated generated explanation is still fallible. It cannot award mastery or promote a new structured answer key. Submit is a terminal learner command consuming an eligible server result tied to the exact source checksum and problem/manifest version; it cannot reuse an old passing run after code edits. Run is nonterminal feedback. Evaluation-time limits distinguish learner outcomes from control-plane failures.

## 5. Execution and judging

Run state: `queued -> leased -> compiling -> running -> terminal`, with phases skipped by language as needed. Terminal categories include pass, wrong answer, compile/type error, runtime error, limits, cancellation, and infrastructure error. A lost host enters reconciliation; unknown is temporary and reaches infrastructure error by a bounded deadline. Never start a replacement while the prior execution might still run. Lease epochs fence stale workers; quota reservations and terminal effects reconcile idempotently.

The trusted judge, outside the learner security boundary, selects test cases, sends bounded inputs to the sandbox, reads typed outputs, and compares against expected values. The learner process has no verdict-writing or signing capability. The trusted supervisor records exit, resource, and limit observations. Compilers and candidate artifacts remain in the isolated execution plane; artifacts are never executed by the judge/controller. Artifact reuse stays within a run, identified by checksums, and must not introduce shared writable state.

A harness supplied to candidate code is an untrusted marshalling adapter, not an authority. Do not pass expected outputs to the candidate. A current input cannot be secret from the executing program; hidden tests are undisclosed through the UI, not a guarantee against test inference. Suppress hidden-case input/expected output in learner-facing diagnostics and sanitize/truncate stdout. Keep debug output separate from the output protocol; malformed protocol, extra frames, NaN, or oversized results fail safely.

Each problem declares portable numeric domains, integer width/overflow rules, float tolerance if needed, Unicode/string indexing semantics, ordering/tie behavior, mutation rules, and graph/tree/list serialization. JavaScript/TypeScript cannot silently round values that other runtimes represent exactly; use an explicitly reviewed bounded integer domain or decimal-string encoding. C/C++ undefined behavior cannot serve as the reference algorithm. Resource budgets are calibrated per runtime and separately for compile/run phases, with one semantic outcome contract. Microbenchmarks across JVM, native, and interpreted runtimes are not mastery rankings.

Run descriptors carry source/fixture digests, replay identity, expiry, key ID, and policy version. Keys live outside sandboxes. Rotation retains a verification window for in-flight jobs; compromised profiles are disabled for new work. Image provenance can be retained for historical attribution without allowing a vulnerable retired image to run again.

## 6. Durability, transactions, and module direction

Begin the database transaction before selecting an attempt `FOR UPDATE`. Verify ownership, immutable run/source correlation, idempotency claim, and state under the lock. Persist outcome and an immutable assessment observation with an outbox event, then commit. The mastery-owned consumer creates deduplicated evidence and projections; practice does not directly write mastery tables. Responses return a submission/observation receipt and a projection watermark when available, otherwise `projection_pending`. Read-your-writes applies to the saved submission, while derived mastery may lag visibly.

Activate the PostgreSQL-backed relay when execution dispatch first needs durable work (Tasks 21 and 25a). Keep jobs in the application-owned database accessed through its relay; execution control has a separate run/lease journal and receives signed jobs without access to application tables. Task 41 extends this relay to content/evaluation jobs; it does not introduce a second queue authority. Bounded leases, retry/dead-letter policies, and deduplicated consumer effects remain mandatory. Do not promise exactly-once physical execution after network uncertainty.

No transaction is held open over model generation, code execution, or external navigation. Publication, acceptance, run admission, hint release, and retrieval recheck current revocation/availability even when historical content versions are pinned. Operational disable/rights tombstones override historical availability without rewriting records. Historical metadata may remain subject to retention, but forbidden content is not rendered because an old attempt references it.

## 7. Workspace recovery and safe delivery

Implement editor and pseudocode autosave as one replaceable current draft per learner/attempt/language with optimistic revision checks, debounced writes, limits, and TTL. Explicit saves create intentional immutable revisions; do not retain keystroke histories. Show `local`, `saving`, `saved`, and `conflict` truthfully. On a lost response, reconcile the idempotent save rather than assume success. Expired sessions and multiple tabs preserve recoverable drafts and never silently overwrite a newer revision. Opt-in local recovery is scoped to the learner and cleared on logout/deletion; shared-device users can disable it.

Render hidden tests, locked hints, reference source, and restricted traces only through authorized server queries. Next.js serialization and client bundles must never preload full solutions behind a hidden UI. Pending model requests emit only status events. Persist validated content and a conservative assistance exposure record before delivery; if the network fails after commit, retries deliver that same response without reducing recorded assistance.

External navigation records `handoff_requested`, not proof the destination opened, loaded, or accepted a solution. Use a reviewed anchor with opener/referrer protections and a retryable journal write. A popup or journal failure must preserve an explicit normal-link action without claiming success. Manual completion can be corrected by an appended journal event. Links are checked by authorized human review or a permitted metadata-only mechanism; no automatic provider fetch is required or enabled by default.

## 8. Implementation and UI sequencing

The approved [DESIGN.md](../../DESIGN.md) governs visual direction. Its production assets, tokens, responsive layouts, and acceptance checks are scoped prerequisites for the next page, not a gate demanding all UI before work begins. Integrate Task 6a for tokens/shells and Task 25b for draft recovery. Tests for Home, Workspace, and Roadmap compare against the existing approved references and preserve their stated exceptions.

The plan distinguishes local fixture validation from live-provider, staging, and pilot evidence. Budgets and redaction precede any live model call. Hosted authentication, re-authentication, session revocation, and privileged MFA precede pilot access. Local restore rehearsals do not prove hosted PITR/RPO/RTO; repeat on the deployed staging stack before admitting learners. Full-content production scale follows the scoped pilot in Phase 13.

## 9. Cross-cutting consistency and failure rules

Application workflows compose module-owned ports. A tutor response and practice assistance exposure may share a short transaction through their respective repositories; this is not permission for either pure domain to import the other or write its tables directly. Similarly, the home workflow combines roadmap and mastery queries outside those domains, avoiding a reverse mastery-to-roadmap dependency.

Use server observation timestamps for verified events and record client-reported times separately. Learner-local daily aggregation uses a versioned timezone policy; clock changes and repeated events cannot manufacture extra activity. Self-reported external backfill stays visibly self-reported and cannot create verified historical streaks. Planned rest days, pauses, grace rules and the exact meaningful-activity threshold require the Task 1/33 product policy. Activity streak and scheduled-day adherence are different measures.

Readiness evaluates a published per-problem/mode rubric with explicit required evidence, minimum structured-check outcomes and assistance limits. Freeze that rubric before Task 38: there is no universal guessed threshold. Completing content, passing internal tests, readiness for external practice and delayed independent mastery are separate statuses. A learner-authored trace can be schema-valid while algorithmically wrong; validation must label the distinction. Task 27 provides bounded trace authoring/editing and step replay, not unrestricted six-language source instrumentation.

Retries never mint a new identity for the same logical save, submission, acceptance, reveal or job result. An ambiguous outcome is reconciled before retrying a consequential effect. API response loss after commit returns the original receipt on retry. Cancellation records intent; a late terminal result is resolved by the documented run state/lease epoch, not response arrival order. Orphaned hosts remain quarantined until workloads are fenced/terminated; quota reconciliation cannot silently admit overlapping replacement work.

Content and privacy revocation invalidate caches and derived retrieval eligibility. Every reference resolution rechecks current permissions; an old signed URL, RSC payload, citation, active tutor turn, export, or replay endpoint is not an authorization bypass. Static authored content remains available during model outages; execution-relay outages suspend new runs and display pending/unavailable state, rather than pretending the whole learning loop remains functional.
