# Website journeys, edge cases and build coverage

**Status:** Proposed build contract, 2026-10-07. Documentation only; no feature or phase is approved or implemented by this update.

This document expands “all exits and escapes” into entry routes, normal outcomes, back/cancel/leave actions, failure recovery and edge cases. It covers the features observed or publicly advertised in the [reference review](chai-prep-comparison-2026-10-07.md), plus AlgoCove's existing learning and operational boundaries. It is not a claim that every authenticated flow on the reference website has been inspected. Private roadmap generation, custom sharing and scored interviews remain unverified reference behavior.

The [plan](../../tasks/plan.md) owns delivery order; the [ledger](../../tasks/todo.md) owns completion tracking. Requirements below are acceptance targets. New checkboxes stay open until implementation and evidence exist.

## 1. Feature coverage and ownership

| ID | Learner capability | Reference basis | AlgoCove owner | Delivery tasks |
|---|---|---|---|---|
| J01 | Home, navigation and resume next activity | Public home; AlgoCove continuation requirement | Shell + recommendation query | 45f, 50c |
| J02 | Sign-in/up, onboarding and return to intended page | Account-gated reference actions observed; private onboarding unverified | Identity + learner profile | 45f, 50c, 55a |
| J03 | Topic/pattern library, prerequisites and lessons | Public lesson navigation | Curriculum/catalog | 45c, 45g, 50a, 58–59 |
| J04 | Problem discovery, search, filters and direct links | Public problems/sheets | Catalog + collections | 45c, 50a, 50c |
| J05 | Understand, pseudocode, structured evaluation and stage navigation | Reference Practice field observed; evaluation untested | Practice + assessment | 45c, 45e, 50c |
| J06 | Approaches, scenarios, playback, line highlighting and state | Two-pointer walkthrough observed | Content + visualizer | 45e, 46–49, 59 |
| J07 | Language examples, editor, run, submit and result recovery | Reference solution languages observed; AlgoCove execution extension | Practice + isolated executor | 45c, 46–49, 50c |
| J08 | Curated sheets, sections, counts and progress overlays | Array sheet observed | Collections + progress | 45d, 50a, 50c |
| J09 | Create, edit, reorder, duplicate and delete private sheets | Custom sheets advertised, untested | Learner collections | 59a |
| J10 | Publish/share, open shared snapshot, revoke and report | Sharing advertised, untested | Collections + moderation | 59b |
| J11 | LeetCode solve, optional explanation/video links and return journal | Public outbound links observed | External practice + publication | 45d, 50a, 50c |
| J12 | Roadmap preferences, preview, accept, daily work, backlog and replan | Public description; private generation untested | Planning | 50b, 50c |
| J13 | Hints, reference reveal and optional tutor | AlgoCove differentiator; reference code/Practice surfaces | Guidance + assessment | 45c, 45e, 50c; existing 41–45 |
| J14 | Review queue, progress and completion summary | AlgoCove differentiator | Evidence + mastery + review | 50c, 60, 63 |
| J15 | DSA timed/coached interview and debrief | Public interview description, scored sessions untested | Interview + practice | 61–64 |
| J16 | Code review interview | Advertised, untested | Interview + reviewed code artifacts | 65–66, 68 |
| J17 | Low-level and system design interview | Advertised, untested | Interview + design artifact/rubric adapters | 65, 67–68 |
| J18 | Author, preview, publish, withdraw and repair catalog assets | AlgoCove operational requirement | Content administration | 45g, 58–60 |
| J19 | Account privacy, accessibility, support and operational failures | AlgoCove operational requirement | Platform + operations | 50c, 52–57, 59b, 64, 68 |

No feature receives a completion tick from a reference-site marketing claim. Full curriculum coverage is measured against an approved inventory, not the reference's advertised problem count. Pricing, credit purchases, communities, certificates, voice interviews and automatic external account sync are outside this comparison's established scope; they must not appear as working navigation or hidden dependencies. New evidence or an owner request requires a separate scoped plan decision.

## 2. Route and navigation contract

Paths marked proposed are route design targets. Existing `/learn/[problemId]` keeps its current compatible slug behavior; no migration may break bookmarks. `/roadmap` already exists in the route inventory: retain it or make it a compatible entry to `/plan`, rather than create competing plan state.

| Entry | Access and main destination | Back, exit and invalid-entry behavior |
|---|---|---|
| `/` | Public product entry; owned next-activity overlay after authentication | Every advertised CTA resolves to an available route; incomplete feature links stay absent |
| `/sign-in`, `/sign-up`, `/onboarding` | Existing identity/profile surfaces | Preserve a validated same-origin return path; cancellation returns to public context; never accept an arbitrary external redirect |
| `/learn` (proposed) | Public published topic/problem summaries; private progress overlay | Clear filters; return to same query/page; empty catalog is distinct from no matches |
| `/learn/topics/[topicSlug]`, `/learn/patterns/[patternSlug]`, `/learn/lessons/[lessonSlug]` (proposed) | Reviewed lesson hierarchy | Breadcrumbs, prerequisite links and next/previous lesson preserve context; unavailable next lesson offers an explanation and catalog return |
| `/learn/[problemId]` | Existing canonical workspace; private actions require owner session | Return to originating sheet/plan via validated local context, or topic fallback; missing/withdrawn content does not expose private historical payload |
| `/sheets`, `/sheets/[sheetId]` (proposed) | Curated catalog/detail and authorized owned sheets | Preserve filters/section position; deletion returns to list; inaccessible private IDs return a non-disclosing unavailable response |
| `/sheets/new`, `/sheets/[sheetId]/edit` (proposed) | Owner-only private sheet commands | Save/cancel/conflict choices; no public publication implied by save |
| `/shared/sheets/[shareId]` (proposed) | Explicit sanitized snapshot published by owner | Revoked/removed link has a neutral unavailable page and public catalog exit; no private owner metadata or progress |
| `/plan`, `/roadmap` | Existing planning entries, one plan authority | Cancel preview without replacing active plan; leave generation then resume candidate status; paused/completed plans have explicit next actions |
| `/review`, `/progress` | Existing owner-scoped evidence views | Empty/completed queue returns home; pending projection shows receipt and refresh path, never fabricated zero progress |
| `/interview`, `/interview/sessions/[sessionId]`, `/interview/sessions/[sessionId]/debrief` (proposed) | Eligible templates, owned session, policy-permitted debrief | Pre-start cancel has no timer; leave after start preserves server deadline; explicit abandon is terminal; unsupported mode returns to available templates |
| Account/privacy surfaces (route chosen in Tasks 52/55a) | Existing profile flow plus gated export/deletion | Reauthenticate and allow cancellation before acceptance; accepted deletion shows pending/terminal status without recreating data |
| `/admin/content`, `/admin/content/[id]`, `/admin/readiness` | Existing scoped staff interfaces, extended release preflight | Cancel draft edit without publishing; review rejection explains missing assets; withdrawn release cannot be restored by browser back |

Route data must not depend on navigating from a previous page. Deep links, refresh and browser history reconstruct state from authorized identifiers. Navigation URLs contain no code, private pseudocode, answer keys or provider prompts. Query filters are validated and bounded; invalid values normalize with a visible explanation or return a typed error.

## 3. State, recovery and exit rules

| ID | Condition | Required outcome and escape | Owning tasks |
|---|---|---|---|
| E01 | Initial load, no records, no filter matches, partial support | Distinct states; retry on load failure, clear filters on no matches, show actual supported scope | 45f, 50a, 50c |
| E02 | Expired session or another learner's object | Preserve recoverable local work under existing privacy rules; reauthenticate for owned work; deny cross-user access without leaking existence | 45c, 50c, 55a |
| E03 | Missing slug, old alias, retired/withdrawn release | Resolve approved aliases; otherwise useful unavailable page, catalog return and support/report option; never expose revoked content | 45c, 45g, 50c |
| E04 | Browser back, tab close, route/stage/language change with draft | Persist draft per attempt/language; show save state and explicit unresolved-work choices in app; best-effort browser unload warning cannot guarantee recovery | 45c, 50c |
| E05 | Offline, timeout, lost response, reload, multiple tabs | No false saved/success state; reconcile receipt/idempotency; expected-version conflicts offer reload or preserve local copy; no silent last-writer overwrite | 45c, 50c, 62 |
| E06 | Repeated click, stale response or reordered request | Bind response to actor/attempt/revision; cancel or ignore stale display updates; payload-bound idempotency for commands | 45c, 50c, 59a, 62 |
| E07 | Unsupported language, busy executor, compile/runtime/limit failure | Retain source, explain exact category, allow supported next action; infrastructure error is not learner failure; cancel request reports actual terminal state | 46–50, 50c, 62 |
| E08 | Play reaches checkpoint/end; change approach/scenario; malformed trace | Pause at checkpoint, explicit restart/reset, preserve separate reasoning draft; fail unavailable rather than synthesize a misleading animation | 45e, 46–49, 59 |
| E09 | Pseudocode incomplete, alternate valid formulation, reveal request | Field completion is not correctness; bounded checks identify their scope; authored/human/advisory feedback labelled; reveal records assistance before delivery | 45c, 45e, 50c |
| E10 | External link broken, editorial instead of solve, blocked popup, user returns | Reviewed link role and allowlisted host; ordinary anchor fallback; journal remains self-report; reopening a link never marks solved; offer report and internal return | 45d, 50a, 50c |
| E11 | Missing video/explanation, embed unavailable | Optional action absent or clearly unavailable; authored lesson remains usable; accessible transcript required for essential media | 45g, 50a, 59 |
| E12 | Infeasible roadmap, generation failure, stale candidate, missed day | Reasoned scoped choices; authored/off fallback; preview before acceptance; preserve active plan and historical outcomes; pause/replan without punitive fabricated failures | 50b, 50c |
| E13 | Sheet duplicate, empty section, invalid URL, concurrent reorder | Canonical membership and stable ordering; explicit duplicate rule; atomic versioned edit; unknown URLs remain untrusted private references, not trusted catalog content | 45d, 59a |
| E14 | Share revoked, content withdrawn, abusive public sheet | Access recheck and cache invalidation; sanitized unavailable view; report/moderation path; retain necessary audit under approved retention | 59b, 52–54 |
| E15 | Interview leave/reconnect, clock skew, expiry, late execution result | Server deadline and immutable cutoff policy; recover draft while permitted; late results cannot silently change finalized score; show pending/final/debrief state | 61–64 |
| E16 | AI unavailable, budget/rate limit, invalid provider response | Authored fallback and reason; no fabricated evaluation or repeated chargeable retries; model output never awards completion | 50b, 50c, 63, 65–68 |
| E17 | Projection delay, corrected self-report, repeat exercise in two sheets | Show saved receipt and pending projection; append correction; preserve occurrence versus identity; no duplicate mastery credit | 50c, 59a, 63 |
| E18 | Export/delete, logout, revoked account, delayed background job | Confirm accepted operation state; existing retention/cancellation rules apply; derived jobs cannot resurrect deleted private records | 52–55a, 59b, 64, 68 |
| E19 | Narrow viewport, keyboard-only, reduced motion, assistive tech | Equivalent actions and semantic state; focus returns after dialogs; Escape dismisses nonessential modal/menu and never silently abandons an attempt | 45f, 45e, 50, 50c, 64, 68 |

User-initiated navigation and run/session cancellation are separate commands. A route change does not cancel an active execution, freeze a timed interview, submit work, confirm an external solve or accept a new roadmap. Pending work remains discoverable after return. Every terminal page offers at least one valid next action.

## 4. Architecture for collections and sharing

Extend the collection module with separate curated publications and learner-owned sheets. Use stable sheet identity, owner, optimistic revision, ordered sections and memberships. A private sheet may reference a canonical internal or external problem; it must not change the canonical problem or publish it. Optional learner notes remain private by default. Private edits are transactional and bounded by item, text and request limits.

Create an immutable, explicitly published share snapshot containing only selected title/description and permitted references. The snapshot has an opaque share identity and operational availability/revocation status; edits to the private sheet do not silently change the public snapshot. Resharing creates an explicit revision. Public/unlisted visibility, discoverability, moderation ownership and retention need Task 59b decisions before enabling links. An unlisted URL is accessible to anyone holding it and must never carry private learning data.

Do not copy source statements, learner code, notes, mastery, journals or profile identifiers into a share response. A visitor may save a private copy of permitted references; origin attribution is retained. Shared content never enters the trusted tutor corpus automatically. Report/hide/revoke are audited, with scoped staff access and a documented response process. No co-editing or bulk external-site import is assumed.

## 5. Content and curriculum completeness

Tasks 58–59 must maintain one row per planned problem/lesson bundle: stable ID, topic/pattern, prerequisites, difficulty rationale, objective, provenance, owner/reviewer, publication status, six-language manifests, approaches, scenario edge cases, line mappings, hints, checks, transcript, external relationships and transfer/review asset. Mark missing, draft, reviewed, published and withdrawn explicitly. Each problem gets a bounded implementation subcard before authoring starts.

| Curriculum batch | Required visualization semantics where applicable |
|---|---|
| Foundations, complexity, arrays, strings, hashing, prefix sums | Values/indices, operation counts, frequency/key state, cumulative invariants |
| Two pointers, sliding windows, sorting, binary search, intervals | Pointer/window bounds, partitions, search interval, merge/order decisions |
| Linked lists, stacks, queues, monotonic structures | Node identity and links, head/tail, push/pop/front, ordering invariant |
| Recursion and backtracking | Call frames, active branch, choice/undo, base case |
| Trees, BSTs, heaps, tries | Node/edge identity, traversal frontier, heap order, prefix path |
| Graphs, BFS/DFS, topological ordering, union-find, shortest paths | Visited/frontier, distances, predecessor, cycle/component state |
| Greedy and dynamic programming | Choice rationale/counterexample, state/dependency table, transitions and reconstruction |
| Selected bit/math and mixed practice | Reviewed bit/numeric domain, supported representation and problem-specific invariants |

A renderer is required only for declared supported visualization assets, not for every arbitrary program. Every advertised internally supported problem requires its planned lesson/pseudocode/trace coverage or an explicit reduced-support label. Optional brute-force versus optimized tracks, multiple scenarios and edge cases are reviewed per problem. No fake animation, universal language-independent execution trace or automatic AI-generated proof fills a missing asset.

## 6. Broader interview architecture

Phase 14 owns DSA coding. Proposed Phase 15 covers the reference's code review, low-level design and system design categories after a separate scope/rubric decision. Reuse session identity, ownership, deadlines, assistance history and finalization; add typed artifacts instead of pretending each mode is a coding problem.

| Kind | Authored input and learner artifact | Assessment boundary |
|---|---|---|
| DSA coding | Problem release; reasoning, source and trusted run receipts | Existing deterministic tests plus scoped reasoning checks |
| Code review | Versioned original/licensed code patch; anchored findings and suggested fixes | Authored issue expectations and human-calibrated rubric; novel findings not automatically wrong |
| Low-level design | Versioned requirements; structured entities, interfaces and interaction notes | Constraints and reviewed design tradeoffs; compiling a snippet does not prove design quality |
| System design | Versioned workload/requirements; components, data flows, capacity assumptions and failure analysis | Evidence-based human/advisory rubric; multiple architectures may be valid |

Task 65 specifies exact schemas, limits, applicable languages, evaluation policy and debrief eligibility before implementation. Typed responses are the initial target; real-time voice, collaborative whiteboards, image/file uploads and arbitrary diagram execution are separate decisions. Models can propose feedback with provenance; objective checks, human review and advisory observations remain distinguishable. No mode claims hiring-outcome prediction.

## 7. Release and tracking contract

For each J/E requirement, record: task/subcard, implementation status, evidence link, checked content/runtime version, unresolved defect and explicit deferral decision if applicable. Completion requires the normal path, at least the relevant negative/exit paths, accessible behavior, ownership checks and data recovery. A test name in a plan is not passing evidence.

F10 covers J01–J08 and J11–J14 within the four-pattern pilot, plus relevant J18/J19 paths. F13 expands actual curriculum and covers J09/J10 only if shipped; otherwise the owner must record their explicit deferral and hide unsupported actions. F14 covers J15; F15 covers J16/J17 only after their separate authorization. Operational/privacy gates remain F11/F12 and also apply to subsequent releases.

Public/private caching, publication withdrawal, content sanitization, URL allowlists, idempotency, payload limits and private-data retention reuse the existing [implementation contracts](implementation-contracts.md) and [security architecture](security-reliability-operations.md). No new service, queue or provider is required by this coverage plan.
