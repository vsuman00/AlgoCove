# AlgoCove product architecture plan and closure matrix

**Status:** Proposed  
**Scope:** Product and architecture specification only; the separate proposed implementation plan does not authorize application code or provider account integration.  
**Owner decision required:** A0 architecture approval.

## 1. Product contract

AlgoCove is a guided DSA learning and consistency platform. It teaches and validates a learner's understanding inside AlgoCove, then sends the learner to the original external problem page for an independent solve.

The product promises:

1. A learner can choose a goal and a 1-, 2-, 3-, 4-, or 6-month timeboxed plan.
2. An AI-assisted planner proposes a roadmap using the learner's capacity, level, preferred languages, target role, and selected collections.
3. Deterministic policy validates the roadmap and the learner explicitly accepts it before it becomes active.
4. The learner learns the topic, pattern, invariant, pseudocode, and algorithmic steps inside AlgoCove.
5. The learner can run and visualize reviewed internal problems in Python, JavaScript, TypeScript, Java, C++, or C.
6. A readiness gate can unlock the original LeetCode or other provider URL.
7. The learner solves the external problem independently on the provider's own website and account.
8. AlgoCove records only the outbound handoff and an explicitly learner-confirmed journal entry. It does not synchronize or verify the provider submission.
9. Progress separates internal mastery, external practice follow-through, review health, and consistency.

The product does not promise:

- automatic LeetCode profile synchronization;
- automatic submission or browser automation on an external platform;
- a live or verified external solved count;
- copied LeetCode, NeetCode, or other protected problem content;
- that an AI-generated plan is correct without deterministic validation;
- that streaks or problem counts prove DSA mastery.

## 2. Primary user journeys

### Journey A: Create a plan

1. The learner selects a target horizon: 1, 2, 3, 4, or 6 months.
2. The learner enters available days, session duration, timezone, current level, preferred languages, target role, and desired collections.
3. The system loads the prerequisite graph, available internal content, external references, review obligations, and capacity constraints.
4. A deterministic scheduler creates a feasible baseline.
5. AI may propose sequencing, explanations, substitutions, and motivation language within that feasible envelope.
6. A validator rejects or repairs proposals that violate prerequisites, workload, language availability, review spacing, rights, or plan dates.
7. The learner reviews the plan and accepts, edits, pauses, or requests a replan.
8. The accepted schedule becomes an immutable plan version.

### Journey B: Learn and validate inside AlgoCove

1. The learner opens a planned item.
2. AlgoCove displays the topic, prerequisites, pattern, objective, examples, and expected invariant.
3. The learner writes pseudocode using structured fields and may add free-form notes.
4. The learner predicts the next algorithm state or answers a concept check.
5. The learner solves an internal problem in a selected supported language.
6. The learner runs tests, receives normalized diagnostics, and uses progressive hints when necessary.
7. The learner observes the reference or instrumented visualization and explains the key state transitions.
8. The system records attempt, assistance, prediction, pseudocode, test, visualization, and explanation evidence.
9. The system calculates readiness. Confidence alone never marks an item mastered.

### Journey C: One-way external handoff

1. The learner reaches the readiness gate; bypass is disabled unless the owner approves an explicit practice-mode alternative.
2. AlgoCove displays the external provider, attribution, destination, and a clear warning that the next solve happens outside AlgoCove.
3. The learner selects **Open on LeetCode**.
4. AlgoCove offers the reviewed canonical URL in a separate tab or explicit external navigation. The journal records a navigation request, not proof the page loaded.
5. The learner solves the problem directly on LeetCode using their own account.
6. The learner returns to AlgoCove and may select **I completed this externally**.
7. AlgoCove records a learner-confirmed journal event with timestamp and source reference.
8. The system schedules review or a transfer problem. It never labels the external solve as provider-verified.

### Journey D: Missed day or changed goal

1. The learner misses an item, changes available time, changes language, or changes the target date.
2. The active plan remains historical and auditable.
3. The learner requests a replan.
4. The system preserves completed evidence, removes or reschedules future items, recalculates capacity, and creates a new plan version.
5. The system must not create an impossible catch-up workload merely to preserve a streak.

## 3. Canonical domain objects

| Object | Purpose | Required invariants |
|---|---|---|
| `LearnerProfile` | Goal, level, capacity, timezone, languages, accessibility | Owned by learner; versioned preferences; no provider credentials |
| `RoadmapPlan` | Stable identity for a learner goal | One owner; explicit status; never silently rewritten |
| `RoadmapPlanVersion` | Accepted schedule and validation lineage | Immutable after publication; includes policy/version and reason codes |
| `PlanItem` | Scheduled lesson, problem, external practice, review or buffer | Kind-specific target constraint, occurrence ID, estimated effort, due window and completion semantics |
| `Concept` | Language-neutral DSA knowledge node | Directed prerequisite graph; published graph is acyclic |
| `Pattern` | Reusable problem-solving strategy | Linked to concepts, invariants, examples, and transfer problems |
| `InternalProblemVersion` | AlgoCove-owned or licensed executable learning problem | Immutable statement/test/hint/trace version; six-language readiness is explicit |
| `ExternalPracticeReference` | Link-only reference to a provider problem | Canonical HTTPS URL, source, attribution, link status, optional collection membership |
| `PracticeAttempt` | Internal learner attempt | Bound to exact problem, language, policy, and mode version |
| `PseudocodeArtifact` | Learner’s language-neutral plan | Append-only revisions; separate from executable source |
| `VisualizationSession` | Prediction and trace interaction evidence | Versioned trace schema; text-equivalent state available |
| `ExternalHandoff` | One-way navigation record | Contains no provider credential or submission claim |
| `ExternalPracticeJournal` | Learner-confirmed external follow-through | Explicitly self-reported; never provider-verified by implication |
| `MasteryEvidence` | Observed internal learning evidence | Append-only; source event and scoring policy required |
| `ReviewItem` | Spaced review or transfer obligation | Due time stored in UTC; displayed in learner timezone |

## 4. Problem and collection strategy

### Internal problem bank

AlgoCove may publish:

- original AlgoCove-authored problems;
- properly licensed problem content;
- content with a license permitting commercial display, modification, tests, and derivative teaching assets;
- learner-owned private problems where the learner has the necessary rights.

Each published internal problem requires provenance, rights, human review, semantic fixtures, language manifests, hints, pseudocode guidance, and a visualization contract.

### External collections

Blind-style, NeetCode-style, Top Interview, Grind-style, and Striver-style sets are modeled as collection metadata and external references. They are not automatically cumulative curricula. The same canonical concept or external problem may appear in several collections.

The plan engine must deduplicate overlapping items, preserve attribution, and distinguish:

- required core items;
- recommended reinforcement;
- optional extension;
- external-only practice.

### External link health

Only authorized content operators may publish external URLs. The system validates HTTPS, approved provider domains, canonical URL shape, redirect behavior, and last-checked status. A broken or changed link is quarantined and replaced or marked unavailable. Learner-provided arbitrary URLs are not automatically rendered as trusted provider references.

Internal exercises and external problems are connected by reviewed `equivalent_problem`, `same_pattern`, `prerequisite` or `transfer` mappings. A source link alone is not permission to reproduce a statement, tests, solution or collection. Exact collection names, membership provenance and usage rights require review; do not silently normalize ambiguous requested sheet names or claim full coverage from four pilot bundles. Show mapped, internally supported, external-only and unavailable counts. Full curriculum expansion is Phase 13.

## 5. Roadmap generation plan

### Inputs

- plan horizon;
- target date and timezone;
- days per week and minutes per session;
- current DSA level and diagnostic evidence;
- preferred language or languages;
- target role or interview intent;
- selected external collections;
- accessibility and learning preferences;
- existing mastery and due reviews.

### Deterministic feasibility rules

The validator must reject or repair a plan when:

- an item appears before its required prerequisite;
- scheduled work exceeds declared capacity;
- a problem lacks the learner’s selected language manifest;
- required internal learning assets are unpublished or rights-blocked;
- review spacing is impossible within the horizon;
- the same problem is duplicated without an explicit repetition reason;
- external links are unavailable or unapproved;
- the plan has no buffer for missed sessions;
- the plan promises more required items than the available content supports;
- an AI proposal changes the learner’s stated horizon or target without consent.

### AI boundary

AI may explain, rank feasible alternatives, suggest substitutions, and produce human-readable schedule rationale. AI may not:

- publish a plan without deterministic validation;
- change prerequisites;
- mark mastery;
- mark an external problem verified;
- unlock a restricted hint tier;
- add an unapproved external URL;
- override capacity, rights, language, or safety policy.

When AI is unavailable, the system uses the deterministic baseline scheduler and authored explanations.

## 6. Learning gate and assistance policy

The default guided-mode gate requires evidence from the following categories:

1. topic or prerequisite concept check;
2. pattern recognition;
3. invariant or strategy explanation;
4. structured pseudocode;
5. internal execution or test result;
6. visualization prediction or explain-back;
7. optional related-problem transfer.

Bypass is a proposed product option, not an owner-confirmed requirement. Default to the requested learn-first gate. If explicitly approved in Task 1, practice-mode bypass is recorded and never becomes mastery evidence.

Only authored structured checks, trusted test results or human-reviewed explanations can supply correctness evidence. Nonempty free-form pseudocode, model opinion and watched animations do not establish correctness. Reference traces can reveal answers and therefore carry assistance tiers. See [evidence contracts](implementation-contracts.md#4-evidence-and-assisted-learning).

Hint tiers should progress from clarification to examples, invariant prompts, pseudocode scaffolding, partial structure, and only then solution review after an appropriate attempt. Hint exposure is append-only and visible in mastery reports.

## 7. Progress and consistency semantics

The learner home page shows independent dimensions:

| Dimension | Meaning |
|---|---|
| Internal mastery | Evidence from AlgoCove attempts, tests, pseudocode, predictions, and transfer |
| External practice | Handoffs and explicitly learner-confirmed external practice |
| Plan adherence | Planned items completed within their due windows |
| Review health | Due, completed, overdue, and deferred review workload |
| Consistency | Active study days and completed sessions under a declared streak policy |

The product must not show a single blended score as if it were objective mastery.

Consistency rules must define:

- learner-local calendar day and daylight-saving behavior;
- what counts as a valid session;
- whether a review-only session counts;
- grace days and missed-day recovery;
- pause periods that do not erase historical evidence;
- how replanning affects future adherence but not past adherence.

## 8. Loophole and failure-closure matrix

| Loophole or failure | Required behavior |
|---|---|
| User requests LeetCode before the internal gate | Show missing readiness evidence; bypass exists only if owner-approved, then must be explicit and audited |
| User claims an external solve without solving it | Label it learner-confirmed; never call it provider-verified |
| User expects live LeetCode solved counts | Explain that AlgoCove has no automatic synchronization; show only declared data and source link |
| AI creates an impossible plan | Deterministic validator rejects it; show reasons and a feasible alternative |
| User changes from 6 months to 1 month | Create a new plan version; preserve old plan and evidence |
| User misses several days | Recalculate future work with buffer; do not create an unsafe catch-up load |
| Collections contain duplicate problems | Map collection memberships to canonical references and deduplicate required work |
| External URL redirects to an unapproved domain | Block or quarantine the link and require content-operations review |
| External provider requires login | Leave login to the provider; never collect or proxy credentials |
| Provider changes or removes a problem | Mark reference unavailable, notify affected plans, offer an approved substitute |
| License for internal content expires | Retire content from new sessions/retrieval and preserve only the minimum audit record |
| Problem lacks one of six language variants | Display actual availability; do not silently substitute another language |
| Visualizer cannot render learner code | Show the reviewed reference trace and textual state; do not fabricate learner-code visualization |
| AI tutor is down or over budget | Use authored hints and deterministic explanations; do not block core learning |
| Learner asks for the final solution too early | Apply deterministic hint ceiling and record assistance |
| Learner submits malicious native code | Isolated execution plane enforces limits, no network, no credentials, teardown, and infrastructure classification |
| User double-clicks handoff or confirmation | Idempotency key returns one handoff/journal effect |
| Timezone or daylight-saving transition occurs | Store instants in UTC and calculate due windows using the learner’s versioned timezone |
| Plan has no content for the selected language or level | Fail planning validation and offer a constrained alternative, never silent fallback |
| AI or external content contains prompt injection | Treat all provider/content text as untrusted data; it cannot become an application command |
| Progress display motivates quantity over learning | Keep internal mastery, external practice, and consistency as separate measures |

## 9. Privacy, security, and trust boundaries

- No LeetCode or external-provider passwords, cookies, tokens, or private API keys are accepted.
- External navigation uses a new context with no credential proxy and no unnecessary referrer or learner-data leakage.
- External-provider page content is not automatically ingested into retrieval or tutor prompts.
- Learner source code, pseudocode, notes, and conversations remain private by default.
- All external handoff and confirmation actions are auditable without storing third-party account secrets.
- Provider links and imported metadata are untrusted input and are schema-validated before rendering.
- Content rights and takedown state are checked before recommendation, retrieval, or plan publication.

## 10. Architecture acceptance gates

### Gate P0: Product semantics

- One-way external handoff is accepted.
- No automatic external synchronization or verification is in scope.
- Practice-mode bypass and guided-mode gate semantics are accepted.
- Progress dimensions and self-reported labels are accepted.

### Gate P1: Content and provenance

- Internal versus external problem ownership is explicit.
- Collection deduplication and attribution rules are accepted.
- Link-health and rights-revocation behavior is accepted.

### Gate P2: Roadmap planning

- All supported horizons are accepted.
- AI proposal and deterministic validation boundaries are accepted.
- Replanning, pause, missed-day, and capacity rules are accepted.

### Gate P3: Learning integrity

- Readiness evidence, hint ladder, pseudocode, visualization, and transfer rules are accepted.
- No final-solution leakage before the configured gate is accepted.

### Gate P4: Runtime and safety

- Six-language execution conformance, sandbox limits, privacy controls, and external-link trust boundary are accepted.

Implementation planning may be prepared for review, but implementation execution begins only after P0-P4, the broader A0-A2 gates, and the relevant phase checkpoint are approved.

## 11. Explicit non-goals

- Scraping, mirroring, or bulk importing LeetCode/NeetCode content;
- automatic LeetCode account connection or submission;
- browser automation of external solves;
- a guaranteed recruiter-visible solved count;
- making every collection mandatory;
- making a six-month plan the only available plan;
- generating a custom animation for every arbitrary learner code path;
- treating AI output as authoritative curriculum, mastery, or external completion evidence.

## 12. Decisions still required from the owner

1. Which external collections are launch references?
2. Which internal patterns and minimum number of authored problems define the first curriculum?
3. Should a learner-confirmed external completion require a note, optional reflection, or no extra friction?
4. Which exact sessions count toward a consistency streak?
5. Are custom plan horizons outside 1, 2, 3, 4, and 6 months deferred?
6. Is the recruiter-facing profile card included in the first learner release or deferred?
