# Chai Prep reference review and AlgoCove feature comparison

Date: 2026-10-07
Status: Analysis and proposed product direction; additions below are not implemented or phase authorization.
Request: Compare https://dsa.chaicode.com/ with AlgoCove across roadmap, sheets, interview preparation, DSA lessons, visualization, pseudocode, problem organization and LeetCode handoff.

## 1. Recommendation

AlgoCove should offer the requested feature categories and make their journeys easy to discover. Its distinct value should be helping learners explain, predict, implement and retain algorithms. Shared categories and familiar playback controls are useful. AlgoCove should use its own curriculum, teaching text, examples, pseudocode, diagrams, visual identity and assessment rules.

The immediate product gap is the small usable curriculum and discovery surface. The engineering foundation is substantial, but the learner route and planning catalog currently serve one exercise. Adding another decorative renderer or a larger AI prompt would not resolve that gap.

The proposed product promise is: **Understand an algorithm, make its reasoning visible, practise it independently, and remember it later.** This is consistent with [DESIGN.md](../../DESIGN.md) and the [product contract](product-plan-and-closure-matrix.md).

## 2. Evidence and limits

The reference was inspected through public pages and live browser interactions. The current site calls itself Chai Prep; some fetched pages still use Chai Visual. Public marketing claims are identified as such. Inspection did not create an account, purchase credits, evaluate submitted pseudocode, generate a private roadmap or sit a scored interview. No claims about those implementations or grading accuracy follow from their marketing pages.

AlgoCove was inspected through governing documents, the current source tree, route inventory and committed design review images. There was no web server listening at localhost:3000. This review did not start infrastructure or rerun tests. The 2026-10-06 verification results are prior repository evidence, not fresh execution in this review. The 2026-10-03 screenshots are historical visual evidence; current source includes subsequent changes.

Primary reference observations:

| Surface | Observation | Evidence type |
| --- | --- | --- |
| [Homepage](https://dsa.chaicode.com/) | Connects learning, practice and interview preparation. Advertises 184+ animated DSA problems. | Public presentation and marketing count, not an independent corpus audit |
| [Two-pointer introduction](https://dsa.chaicode.com/two-pointers/intro) | Topic navigation, array stage, pseudocode, state, narration and playback. Practice hides the reference and presents a text field and Evaluate control. | Browser observed; evaluator behavior untested |
| [Two Sum II](https://dsa.chaicode.com/two-pointers/two-sum-ii) | Brute force and optimized tracks, line highlighting, pointer changes and LeetCode #167 link. | Browser observed |
| [Sheets](https://dsa.chaicode.com/sheets) and [array sheet](https://dsa.chaicode.com/sheets/array) | 29 array rows with walkthrough, solution, optional video and outbound solve actions. Public page also advertises custom shareable sheets. | Array UI observed; custom creation untested |
| [AI roadmap](https://dsa.chaicode.com/ai-roadmap) | Describes dependency ordering, capacity, a daily list and backlog. | Public description; private generation untested |
| [Interviews](https://dsa.chaicode.com/interview) | Describes timed coding, code review, LLD and system design rounds with debriefs. | Public description; scored sessions untested |

No statement that every reference problem has identical controls, correct mappings or a working assessment is made.

## 3. Feature comparison

Status meanings: implemented means relevant source exists; partial means important parts exist but do not provide the complete requested experience; missing means no corresponding learner feature was found. All current implementation statements describe this checkout, not a deployed product.

| Requested feature | AlgoCove current state | Proposed direction |
| --- | --- | --- |
| Roadmap | Implemented local scheduling, preferences, preview, acceptance, pause/replan and history. Partial curriculum coverage. Live AI activation pending. | Keep deterministic feasibility, learner timezone, review time and explicit acceptance. Add coverage and milestone views as content grows. |
| Practice sheets | Collection/reference foundations exist. A learner sheet catalog, detail page and custom-sheet builder are missing. | Add curated sheets with searchable rows, pattern sections, asset availability and separate internal/external/review status. Custom sharing comes later. |
| Interview preparation | Goal/role planning and transfer/review foundations exist. A dedicated timed mock session and debrief feature is missing. | Begin with DSA interview rehearsal tied to the same authored problem bank. Broader rounds require separate product scope. |
| DSA Learn | One guided exercise, authored hints, reasoning checks and a tutor panel exist. A browsable multi-topic course is missing. | Add concept and pattern lessons, prerequisites, worked examples, checkpoints and problem sequences. |
| Visualization | Implemented array/two-pointer replay, spatial/flat views, transcript and prediction interactions. | Add pseudocode synchronization, scenario selection, useful state inspection and additional structure contracts in reviewed batches. |
| Pseudocode | Implemented eight structured fields, revision persistence and authored structured checks. Free-form text is advisory. | Retain the reasoning artifact; add authored numbered pseudocode and stable step-to-line mapping. |
| Problem bank | One learner slug is admitted. Governed problem/version/language foundations exist. | Resolve published problems by catalog metadata and stable identity, with topic/pattern/difficulty filters. |
| LeetCode redirect | Implemented local readiness and outbound journal flow in Phase 8. | Preserve reviewed canonical links, attribution, explicit readiness policy and learner-confirmed follow-through. |
| Review and progress | Implemented evidence, review queue, next action and separate progress dimensions. | Make these benefits visible throughout lessons, sheets and interview debriefs. |

## 4. What should feel different

AlgoCove already has a cove identity, ocean/jade palette, editorial typography and spatial/flat trace presentation. Preserve that visual system. Borrow understandable interactions such as next/previous, search, topic grouping and external-link icons; create AlgoCove's own compositions and content.

Recommended differences are substantive:

1. **Prediction before reveal.** Pause at authored decisions and ask what changes next and why. Record correctness only through an authored check or other accepted evidence.
2. **Explain the invariant.** Teach what remains true and why a choice is safe, with a counterexample to a plausible wrong choice.
3. **Expose reasoning in the trace.** Show the executing pseudocode line, changed variables, state transition and explanation together.
4. **Separate learning outcomes.** Keep viewing, assisted completion, independent internal completion, external self-report and delayed review distinct.
5. **Return to the skill later.** Schedule recall and transfer exercises rather than letting a checkmark end the learning journey.
6. **Make capacity honest.** Roadmaps use available reviewed content and reserve time for review and recovery.

Spatial presentation is an existing design choice, not evidence of better learning. Use the view that communicates the structure clearly, with equivalent flat/text operation. More camera controls are a lower priority than better algorithm explanations.

## 5. Product navigation and problem placement

The proposed learner navigation is Home, Learn DSA, Sheets, Roadmap, Interview Prep, Reviews and Progress. Keep account preferences in a secondary location. Current navigation exposes Home, Planning, Reviews, Progress and Learner profile; it does not expose the requested course or sheet library.

Use one canonical identity for each internal exercise. A problem may appear in a topic, several patterns, a sheet and a roadmap without becoming four copies. Preserve version pins for attempts, rubrics and traces. External problems retain separate provider identity and reviewed mapping types: equivalent problem, same pattern, prerequisite or transfer.

Suggested information hierarchy:

```text
Learn DSA
  Topic
    Concept lesson
    Pattern lesson
      Worked example
      Guided exercise
      Independent exercise
      Delayed transfer exercise

Sheets
  Curated collection
    Sections referencing those exercises and external problems

Roadmap
  Accepted sequence referencing lessons, exercises and reviews

Interview Prep
  Practice session referencing eligible independent exercises
```

Proposed broad curriculum sequence, to be reconciled with Phase 13 rather than treated as an approved syllabus:

| Stage | Content | Progression reason |
| --- | --- | --- |
| Foundations | Complexity, basic programming fluency, arrays and strings | Learners need to reason about operations and state |
| Core scans | Hashing, prefix sums, two pointers and sliding windows | Establish common linear-time patterns |
| Ordering and search | Sorting, binary search and intervals | Introduce ordered search spaces and boundary reasoning |
| Linear structures | Linked lists, stacks, queues and monotonic structures | Teach reference mutation and processing order |
| Recursive search | Recursion and backtracking | Make call frames, choices and undo operations explicit |
| Hierarchical structures | Trees, BSTs, heaps and tries | Build on references and recursive reasoning |
| Graphs | Representation, BFS, DFS, topological order, union-find and shortest paths | Build on queues, recursion and heaps |
| Strategy and recurrence | Greedy and dynamic programming | Require explicit arguments about choices and state dependencies |
| Goal-specific extensions | Bits, math and mixed interview practice | Add material based on track goals and demonstrated readiness |

This is a prerequisite graph with multiple valid routes. It should not become a rigid requirement to finish every topic before touching another.

## 6. Lesson and problem experience

A concept page should establish prerequisites, objective, a small concrete example, recognition cues, an invariant, complexity and a checkpoint. A pattern page should explain when the pattern works, when it fails and how related problems differ.

A problem page should provide:

- AlgoCove's authored statement, constraints, examples and edge cases;
- pattern and prerequisites, with optional reveal when recognition is being assessed;
- a first-attempt reasoning surface;
- reviewed brute-force and optimized approaches where pedagogically useful;
- synchronized pseudocode, visualization, variables and narration;
- supported language starters, execution and normalized results;
- progressive hints and an explanation prompt;
- readiness evidence, reviewed external practice and a later review.

Avoid showing all eight reasoning fields, all guidance and a large editor at once for a beginner. Preserve the saved artifact but disclose relevant fields by stage. The current path at the top is an ordered list; it is not yet a functional stage navigator. A future focused-stage layout should preserve drafts and keyboard access.

Reference solution access must follow the existing assistance policy. The comparison does not authorize changing the default learn-first gate or introducing a practice bypass. Any mode changes must use explicit approved policies.

## 7. How pseudocode and visualization should work

The observed reference experience keeps pseudocode, variables, narration and animation aligned. Its Practice control accepts free-form pseudocode for evaluation. Inspection does not establish that this text is executed or converted into a trace.

AlgoCove currently stores `inputs`, `state`, `initialization`, `invariant`, `loop`, `termination`, `output` and `complexity`. Its authored choice checks can establish limited correctness evidence; merely filling the text boxes cannot. The current trace document contains a bounded array/two-pointer event sequence. It has no authored pseudocode line references, generic variable snapshots or multiple approach identity.

Recommended next contract: an immutable authored algorithm walkthrough that includes numbered pseudocode, approach identity, input scenario, deterministic events, stable step IDs, active line IDs, variable changes, narration, invariant explanation and checkpoint references. Treat this as a proposed versioned extension; schema and storage design require review before implementation.

Each selected step should drive all presentation from one validated state:

```text
Selected step
  -> data structure state and pointers
  -> active authored pseudocode lines
  -> variables and changes
  -> explanation and invariant
  -> prediction checkpoint, when present
```

For a sorted pair-sum example, a line computing the sum should show the corresponding values and indices. A comparison step should show the computed sum and target. A pointer movement should explain how sorted order justifies eliminating candidates. Restart, back and scrub must replay deterministically.

Use separate meanings for three artifacts:

| Artifact | Meaning |
| --- | --- |
| Learner pseudocode | Private reasoning; authored checks assess declared properties |
| Authored reference walkthrough | Reviewed explanation, exposed according to assistance policy |
| Trace from learner execution | Only offered for a genuinely supported instrumented runtime; do not infer it from an authored animation |

Free-form pseudocode can have many valid forms. A general interpreter or model-generated animation is a separate product and correctness problem. For the next slice, use reviewed walkthroughs and bounded structured interactions. Dragging a pointer should record a prediction or an explicit learner edit, not silently rewrite the canonical algorithm.

Prioritize previous/next, restart, timeline scrub, bounded autoplay/speed, scenario selection, prediction pauses and text equivalence. Current AlgoCove has stepping and restart but no playback timer or scrubber in `TraceRenderer`. Add structure-specific views gradually: maps/counts for hashing, windows for scans, push/pop for stacks, node references for lists, call stacks for recursion, frontiers for graphs and dependency tables for DP.

## 8. Sheets

The first sheet experience should be a curated catalog and detail page using existing governed collections. It should answer what this sheet teaches, which entries have internal instruction and what the learner should do next.

Suggested row fields are title, difficulty, pattern, internal learning link, visualization availability, language support, reviewed external link, external self-report and next review. Put optional video/reference actions in row details to keep the primary action clear. Search/filter by topic, pattern, difficulty, support and progress.

Display separate counts for mapped/internal support, external-only references and unavailable entries. A sheet can be complete as a declared reference list without being a complete AlgoCove course; label that scope precisely. Deduplicate shared problems in schedules while retaining membership in each sheet.

The reference sheet inspection also showed why URL presence is insufficient validation: the Maximum Candies solve action points into a `/solutions/` page. AlgoCove should review both destination shape and semantic problem correspondence so a solve action opens the intended problem without revealing an editorial. This was an observed href, not a full audit of the reference's links. [Observed sheet](https://dsa.chaicode.com/sheets/array).

Custom sheets, ordering, import and sharing are a proposed later feature. They require concrete learner authorization and publishing/moderation contracts, not automatic acceptance of arbitrary URLs into the trusted catalog.

## 9. Roadmap

Keep AlgoCove's 1-, 2-, 3-, 4- and 6-month options and learner timezone. Generate feasible schedules from level, weekly capacity, languages, prerequisites, published assets and due review. Show the learner a preview and reasons for rejected scope before acceptance.

Improve the future roadmap experience with topic milestones, the reason an item appears next, estimated effort, review/buffer allocation and supported collection coverage. The learner home should make the current task easy to start. After a missed day, offer a capacity-respecting replan while preserving history.

Do not advertise general-purpose subject generation merely because the reference does. The current supported scope is a two-pointer pilot, and the live proposal provider gate is pending. Full DSA scheduling requires actual curriculum breadth; it cannot be repaired through wording or a model response.

## 10. Interview preparation

A recommended first extension is a DSA mock session: clarify an authored brief, discuss examples, propose an approach, write pseudocode, implement, check edge cases and explain complexity. Provide coached practice and a separately scoped timed rehearsal. Hide reference solutions during a timed attempt and defer helpful visualization until the debrief where appropriate.

The debrief should cite concrete evidence from the attempt: passed/failed test categories, algorithm choices, explanation checks and assistance exposure. Return two or three specific practice/review actions. Trusted tests and authored assessment rules supply scored correctness; model commentary remains advisory unless a separately reviewed scoring policy is approved.

Do not label a learner interview-ready from an arbitrary aggregate score. Track correctness, strategy, reasoning, communication observations and complexity separately, and distinguish deterministic checks from advisory evaluation.

Chai Prep describes coding, code review and two design rounds. Replicating all four is a large expansion into different content and assessment systems. AlgoCove's existing implementation plan contains no dedicated mock-interview delivery phase. Record this as new proposed scope; build the DSA rehearsal first after eligible curriculum and explicit scope authorization. LLD, system design, aptitude, college portals and billing need their own work packages if selected later.

## 11. LeetCode handoff

Retain the current architecture: prepare internally, check readiness, open the reviewed canonical provider URL, record a navigation request and optionally record learner-confirmed completion. Return the learner to review/transfer work. Label external completion as self-reported.

Display the relationship between an internal exercise and external problem. A same-pattern mapping is not an identical problem. If an external-only row lacks an internal preparation path, show that limitation and the applicable reviewed access policy rather than implying readiness has been assessed.

Use provider problem routes for solve links, explicit destination labels and new-tab behavior consistent with the existing product contract. Credentials, private APIs and automated submission are outside this architecture. External statements, tests and solutions are not automatically internal learning content; follow the existing governed original/licensed content policy.

## 12. Concrete source gaps

| Source | Finding | Consequence |
| --- | --- | --- |
| `apps/web/app/learn/[problemId]/page.tsx` | Rejects every slug except `arrays-two-pointer`. | More published content alone cannot produce more learner pages. |
| `packages/db/src/planning-catalog.ts` | Selects fixed `prb_dddddddddddddddd`, emits the single learning route and declares limited scope. | Roadmaps do not consume a general problem catalog. |
| `apps/web/src/components/practice/problem-workspace.tsx` | Facts, invariant and structured choice controls are specific to container area. | Generalizing the route without metadata would teach the wrong problem. |
| `apps/web/src/components/practice/trace-workspace.tsx` | Starts from fixed heights and a left/right boundary prediction. Learner edits are exposed as JSON. | Needs problem-specific authored scenarios and learner-facing interactions. |
| `apps/web/src/components/practice/trace-renderer.tsx` | Computes container area for the generic array/two-pointer structure. | Pair-sum or palindrome traces would receive irrelevant calculations. |
| `packages/visualizer/src/index.ts` | One structure; comparison, pointer moves, answer, prediction and complete events. | Other structures and pseudocode synchronization require explicit contracts. |
| `apps/web/src/components/shell/algocove-shell.tsx` and page inventory | No learner course library, sheets or interview pages. | Requested experiences are not discoverable or implemented. |
| `tasks/todo.md` | Phase 10 content is unstarted; Phase 9 live activation and human next-phase gate remain open. | Comparison recommendations do not establish completion or authorize the next phase. |

The underlying versioning, content review, execution, learning evidence and external-reference modules should be reused. A new application framework or broad rewrite is not required by these findings.

## 13. Proposed delivery sequence

This is the initial comparison proposal. The updated [implementation plan](../../tasks/plan.md) now stages walkthrough foundations before bundle expansion, and the [journey contract](website-journeys-and-coverage.md) supplies complete route/exit coverage. Follow that plan for current proposed task order; historical observations here remain unchanged.

1. **Agree on this feature scope and reconcile the current gates.** Resolve the existing live-provider decision or explicitly revise its dependency with the owner. Phase 10 has not been authorized in the ledger. Add dedicated sheet/discovery/interview tasks rather than silently treating them as covered by the existing plan.
2. **Prepare the first multi-problem slice.** As an explicit plan refinement before publishing another problem, define published slug lookup, problem facts/rubrics, scenario/approach metadata and a renderer without container-specific calculations. Bound work to the next approved bundle.
3. **Deliver Phase 10's four reviewed pattern bundles.** Arrays/hashing, two pointers, sliding window and stack, with language fixtures, hints, trace, review and transfer assets. Four patterns remain a pilot.
4. **Add learner discovery and one curated sheet.** Connect the reviewed content and mappings; support accurate counts, filters, progress and handoff.
5. **Improve the synchronized walkthrough.** Add authored pseudocode line mapping and useful state controls to an approved problem, then repeat only after its contract is demonstrated.
6. **Expand through the approved Phase 13 taxonomy.** Publish reviewed batches across additional structures and validate actual offered course/sheet coverage.
7. **Add the explicitly scoped DSA interview rehearsal.** Define eligible problems, timing, assistance and debrief contracts before expanding to other interview types.

Hosted release remains governed by Phases 11–12. Feature additions may be scheduled around those milestones after an explicit plan update; they do not independently authorize deployment.

The first reviewable acceptance journey should be: find a supported pattern, open an authored lesson, write a plan, predict a state transition, run an internal solve, open a mapped external problem, record follow-through, and later complete a review. Every advertised action must have real content and a clear outcome.

## 14. Repository sources

- [Architecture](../../ARCHITECTURE.md), [design](../../DESIGN.md), [implementation plan](../../tasks/plan.md) and [task ledger](../../tasks/todo.md).
- [Product contract and closure matrix](product-plan-and-closure-matrix.md).
- [Phase 9 implementation evidence](../evidence/phases/phase9-evidence.md) and [prior full verification](../evidence/phases/phase9-full-verification-2026-10-06.md).
- [Outbound practice ADR](../adr/0012-outbound-external-practice-handoff.md) and [spatial trace ADR](../adr/0018-production-spatial-trace-presentation.md).
- [Learner route](../../apps/web/app/learn/[problemId]/page.tsx), [planning catalog](../../packages/db/src/planning-catalog.ts), [workspace](../../apps/web/src/components/practice/problem-workspace.tsx), [trace workspace](../../apps/web/src/components/practice/trace-workspace.tsx), [renderer](../../apps/web/src/components/practice/trace-renderer.tsx) and [trace protocol](../../packages/visualizer/src/index.ts).
- [Pseudocode domain](../../packages/domain/src/pseudocode.ts), [authored checks](../../packages/domain/src/structured-learning.ts) and [local bundle seed](../../packages/db/src/cli/seed-practice.ts).
- Historical [workspace image](../design-reviews/phase7-2026-10-03/workspace-1440.png).
