# Phase 10 — original pilot curriculum

## Entry authorization and status (updated 2026-10-07)

The owner approved Phase 9 and authorized all Phase 10 implementation tasks (46–50), with AI credentials supplied later. Technical implementation and local verification are complete, including the actual Linux/gVisor connected loop. The owner delegated verification to the assistant, explicitly kept Phase 10 local, and then limited frontend review to the browser. **F10 is closed for the local engineering milestone following the owner's completion request on 2026-10-07.** Original independent persistent-publication requirements are carried forward as separate release gates. Delegated assistant review supplies no independent human signatures; manual assistive-technology review is outside the currently authorized browser-only scope. No fixture approval is a human signature. The owner subsequently authorized Phase 11 preparation on 2026-10-07; [release readiness](./phase10-release-readiness.md) records the persistent database upgrade and remaining independent publication dependency. Hosted deployment and live Task 45a activation remain separate.

No AI key is needed for these authored lessons, deterministic execution, reference traces, recall/transfer scheduling or authored tutor fallback. Live provider quality, budget, region and data-policy qualification require the later approved configuration; a key alone does not qualify that configuration.

## Task implementation

| Task | Original bundle | Implemented artifacts | Human gate |
| --- | --- | --- | --- |
| 46 | `arrays-hashing` / `matching-readings` | Equal-valued position pairs; count-before-insert invariant; frequency table and six-state trace; seven semantic fixtures | Six checksum-bound review kinds and independent standard publication reviews |
| 47 | `two-pointers` / `target-gap-pairs` | Sorted distinct labels, fixed gap three; all left/right/match movements; nine-state trace; seven fixtures | Same publication reviews |
| 48 | `sliding-window` / `stable-signal-run` | Longest contiguous run with at most two labels; expand/shrink invariant; seventeen-state trace; eight fixtures | Same publication reviews |
| 49 | `stack` / `signal-cancellation` | Adjacent equal cancellation; push/pop/top with bottom-to-top transcript; seven-state trace; eight fixtures | Same publication reviews |
| 50 | `pilot-transfer` collection | Four outbound mappings, exact reviewed readiness questions, published-only coverage, overlap deduplication, keyboard/text/flat/isometric presentations | Manual link/mapping review and assistive-technology sign-off |

Each private original bundle includes lesson/recognition/complexity/error notes, a pseudocode rubric, six progressively gated hints, six-language starters and canonical implementations, bounded fixtures, reviewed structured questions, recall schedule and a delayed transfer item. Original source is under `content/patterns/`; it is not a browser/public asset. The source collection under `content/collections/` contains metadata and original mapping rationales, with `pending-human-review` status. It copies no external problem statements, solutions or test cases and makes no named-sheet coverage claim.

## Architecture and connected paths

- Migration `0034_pilot_bundles.sql` adds private author packets, a separate allowlisted public projection, reference traces, six current checksum-bound review kinds and immutable published-record guards. Stable canonical serialization preserves checksums across PostgreSQL JSONB key ordering. Draft import creates no grants, review approvals, validation passes or publication.
- `/admin/pilot` and `/api/admin/pilot` require authenticated, currently granted content roles. Authors import the four packets; independent reviewers inspect the complete private packet and record decisions for the exact checksum. Existing `/admin/content/{versionId}` handles standard technical/pedagogical review, six-language validation and separate publisher action. Publication atomically releases six manifests and the recall/transfer exercises. Pilot contracts and concept mappings cannot be edited around checksum review.
- `/learn` and `/learn/{slug}` resolve actual SQL publication, payload availability and rights. Draft/withdrawn bundles stay unavailable. Metadata includes no canonical pseudocode, solutions, hidden hints, fixtures, answer keys or reference trace. Six-language starters are delivered from published manifests. Local recovery is scoped to learner, problem and language.
- Explicit reference reveal authorizes and persists tier-four assistance before delivering the private trace, with attempt/generation fencing. Initial client/server page props do not preload it. Text transcripts, frequency tables, pointers and stack actions cover every authored state. Keyboard boundaries, a static optional isometric view and flat fallback share the same data. Small screens and reduced motion force flat presentation; text-first flat is the default and needs no animation loop.
- Structured reasoning/readiness is graded against published reviewed answer keys on the server; prose presence does not create mastery. Existing verified execution, assistance limits, bypass/companion/journal and review policy remain authoritative. Published pilot units enter deterministic planning and progress links. Overlapping collections do not duplicate required internal work. Coverage distinguishes supported internal, external-only and unavailable, and always keeps `fullCoverage: false`.
- The four-node curriculum publishes only when all four bundles publish. Derivation is queued for all four at that point, so earlier publications cannot produce jobs against an incomplete graph. Retrieval checks use original evidence and preserve published/citation/tier/rights controls; synthetic gateways qualify boundaries, not live vendor quality.
- The isolated execution host accepts only an explicitly installed published export. Default policy has no pilot catalog. Exact registered manifest, bundle, fixture, image and source digests bind each dispatch. Harnesses compare original input after execution in all six languages; expected outputs remain host-side. The host imports pure content contracts and has no database or learner identity access.

## Verification performed

| Check | Result | Evidence boundary |
| --- | --- | --- |
| `pnpm verify` | 490 tests / 77 files; format, lint, types, architecture, tokens, docs and secrets checks pass | Local default suites; includes synthetic retrieval/adversarial fixtures |
| `pnpm test:integration` | 140 pass on macOS; three Linux-only cases run separately and all pass in the owned Linux VM | Real PostgreSQL 17, all 34 migrations, disposable databases and roles; six new pilot integration cases |
| Production dependency audit | No known vulnerabilities | Patched `sharp` to 0.35.5; full audit retains only the documented unpatched development-only `braces` finding |
| `pnpm build` | Pass | Production Next build, including new library/staff/API routes |
| `pnpm test:e2e` | 57 pass | Chromium HTTP-controlled frontend journeys, including ten pilot cases |
| `pnpm test:a11y` | 32 pass | Existing accessibility regression suite; additional axe checks run at every pilot trace state in E2E |
| `pnpm test:execution-browser` | Six pass | Execution UI regression fixtures |
| Actual Linux/gVisor learning loop | Three scenarios pass, including all 24 pilot/language journeys | Real Linux host, PostgreSQL, production route handlers, browser state and signed callbacks; explicitly synthetic authentication/publication actors |
| Delegated Safari review | All four lessons, reference reveals and complete transcripts checked | Safari 27.0.1 on macOS 27.0.1; isolated presentation fixtures, browser-only scope |
| `pnpm test:pilot-conformance` | All 24 bundle/language combinations pass | Real compiler/interpreter containers: 180 correct canonical results; 114 wrong starter results rejected; 24 compiled mutation candidates rejected |

[Recorded compiler report](../artifacts/phase10-conformance-2026-10-06.json) binds each result to canonical bundle, raw asset and actual pinned image digests. The remaining 66 starter outputs legitimately equal zero; they are not counted as wrong-result rejections. All fixture expected results also have independent brute-force/deletion oracle checks. Trace tests independently check prefix counts, pointer branches, window frequencies and stack cancellation.

Real SQL integration covers author/self-review/learner denial, stale checksum rejection, draft visibility, publication atomicity/immutability, actual audit receipt export, all 24 published workspace/trace routes, durable assistance, correct/incorrect structured reasoning, overlapping collections and insufficient external readiness. Authentication and reviewer identities in those tests are explicitly synthetic fixtures; the SQL repositories, migrations and route handlers are real. The disposable test data is removed after the suite.

Browser verification covers every trace state, transcript, all six language editor switches, keyboard boundaries, reduced motion, 320px layout, 200% zoom, the optional isometric view, unavailable bundles, truthful library coverage and staff access denial. The expanded suite caught missing skip-link targets on the two new pages; both were corrected. Compiler verification caught and corrected the TypeScript stack's empty-array type inference. Prototype public projection and local draft isolation were tightened before final verification.

The fresh audit found [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) in the transitive production image-processing dependency. An exact workspace override upgrades `sharp` to the maintainer's patched 0.35.5 release and matching prebuilt binaries. Production audit is clear; the existing exact development-only `braces` allowance was preserved. Build and browser regressions were rerun after the patch.

These results do not assert that every possible state or every assistive technology has been exercised. Existing anonymous/recovery browser fixtures can log expected dependency-unavailable responses. Unit execution-policy tests use controlled Docker transport; compiler conformance uses ordinary Docker Desktop containers. The separate [actual Linux/gVisor report](../artifacts/phase10-local-linux-learning-loop-2026-10-06.json) contains all 24 pilot/language journeys with matching bundle checksums, real wrong-answer and passing executions, persisted reasoning/reference assistance, authored tutor fallback and reviewed external handoff journaling. Synthetic authentication and publication actors remain confined to disposable tests. The owner explicitly chose local work, so no Phase 10 commit, push, PR or remote CI result exists.

## Concrete publication and manual review runbook

1. On the chosen local/staging database, use the normal operator role bootstrap and apply migrations through 0038. Use existing approved authentication and role-grant administration. Do not create fictional human identities or grant learner sessions staff roles to bypass publication.
2. As the real author, open `/admin/pilot` and import each `content/patterns/*/bundle.json`, then `content/collections/pilot-transfer.json`. Packets appear as draft. Re-importing an identical bundle by its author is idempotent; changed content requires a registered successor version rather than editing published contracts.
3. Actual technical and pedagogical reviewers, distinct from the author and each other, inspect each complete private packet. Record all six pilot kinds against the displayed checksum: technical, pedagogical, accessibility, rights, trace and conformance. Pedagogical/accessibility kinds require the pedagogical reviewer role; the other four require technical reviewer authority. Record concrete review notes, not an automated fixture signature. Rejected or stale/currently revoked reviews block publication.
4. Follow each packet's `/admin/content/{versionId}` link. Independent technical/pedagogical reviewers also record the standard content decisions. The designated publisher, distinct from author and reviewers, runs validation and publishes only after accepting the evidence. The database guards require all six published manifests and both exercises. The final fourth publication releases the graph and queues governed derivation for all four bundles. Run the existing worker and inspect derivation/retrieval operations before qualifying tutor availability.
5. As the appropriate independent reviewer, open `/admin/readiness`. For each `ref_1111111111111111` through `ref_4444444444444444`, manually inspect the official destination, attribution, relation and rationale. Use the existing `review_reference` command with `status: "reviewed"` only after accepting the link. Review each `pilot.{pattern}.external.v1` version 1 with `technical_review` and `pedagogical_review`, then publish as the separate publisher. Unreviewed references and draft readiness policies remain unavailable; reachability is not approval. The four official links were reachable during the 2026-10-06 check, but require a fresh check before publication.
6. Complete manual assistive-technology review on every bundle: VoiceOver/Safari and a supported Windows screen-reader/browser combination, keyboard-only navigation, focus/reveal/announcement order, all frequency/pointer/stack states, transcript reading, 200% zoom, high contrast, reduced motion and low-power flat presentation. Record device/browser/AT versions, checksum, findings and reviewer identity. Automated axe checks cannot replace this record.
7. After actual publication, retrieve authenticated publisher/evaluator `GET /api/admin/pilot?export=published`. Store the response array outside the web/public tree as an operator-owned execution-host file. Set `LOCAL_PUBLISHED_PILOTS_FILE` to that absolute file on the approved Linux host, alongside its existing signing/image/runtime configuration. Restart the host and require healthy gVisor preflight; the default remains pilot-disabled without this file. Do not install raw draft authoring assets or synthetic receipt exports.
8. On that host, run each published bundle in all six languages through the real learning loop. Qualify the connected guided → verified run → structured reasoning → external readiness/handoff → journal/review → roadmap → authored/live-approved tutor journeys. Reconcile withdrawal/rights behavior and refreshed host catalogs. Combine this evidence with actual human signatures to close the retained persistent-publication release gate. Local F10 closure does not satisfy that gate; Phase 11 authorization remains separate.

## Separate publication and release gates

- Actual checksum-bound human technical/pedagogical/accessibility/rights/trace/conformance and publisher records for the four source bundles.
- Independent human publication approval remains separate from the completed delegated mapping/design review. Manual assistive-technology review is excluded from the owner-authorized browser-only scope; no pass is claimed.
- Remote CI qualification is deferred under the explicit keep-local instruction. Actual local Linux/gVisor qualification is complete.
- Later AI/privacy-owner provider, model, region, data-policy, budget and measured live evaluation before enabling live AI. Supply credentials to the configured gateway environment, not to tracked source or review packets.
- F10 local closure is recorded from the owner's 2026-10-07 completion request; explicit authorization for Phase 11 remains outstanding.


## Local verification closure — 2026-10-06/07

The owner asked the assistant to perform verification and keep Phase 10 local. Browser-only frontend scope was clarified afterward. [Delegated review findings](./phase10-review-record.md) bind the exact current checksums; they are not independent human signatures. No manual screen-reader pass is claimed. VoiceOver is off and the opened accessibility apps are closed.

The review fixed concrete issues before final reruns:

- Pattern-specific distractors and meaningful tier-five partial implementation hints replaced generic/repeated guidance.
- Workspace bootstrap now includes the separately allowlisted public pilot projection. Previously it overwrote the lesson/checkpoint metadata fetched from the public problem endpoint, causing the UI to fall back to the old exercise. Real SQL integration now compares the entire public projection for all 24 workspace combinations; the native browser test also checks the checkpoint prompt.
- Workspace headings use the actual pattern. Isometric pressed state now describes the active view. Trace navigation ignores modified keys so browser/platform shortcuts are not intercepted.
- Disposable native test learners receive the actual learner role grant required by tutor policy. This fixes the test fixture, not production authorization.

A new isolated Lima VZ VM, `algocove-phase10-assurance`, ran Ubuntu 26.04 arm64, kernel `7.0.0-34-generic`, Docker `29.8.2`, gVisor `release-20260928.0`, Node `22.22.0` and pnpm `12.4.2`. It has no host filesystem mounts. Docker context and existing Docker Desktop state were unchanged. Pinned execution profiles were built inside the VM; gVisor smoke execution succeeded. The Linux suite then passed all three scenarios in 311.20 seconds, with 93 report entries (84 execution outcomes and nine resume/recovery assertions). Of those executions, the pilot journeys contribute 24 wrong-answer rejections and 24 passing submissions. All 24 preserve the exact compiler-reviewed bundle checksums.

The first transport attempt was blocked by macOS AppleDouble metadata in the source archive; those generated files were removed only in the owned VM copy. Connected reruns exposed the real workspace projection bug and the missing fixture learner grant. One legacy TypeScript compile exceeded its existing eight-second limit while concurrent host verification was running. A fresh full run after the fixes and without that competing build load passed all scenarios; production limits were not relaxed. These local environment limitations are retained rather than hidden.

Reproduction in that owned VM, after pinned dependency/image build and `docker compose up -d --wait db`:

```sh
ALGO_COVE_REAL_LOOP_CI=1 \
DATABASE_TEST_OPERATOR_URL=postgres://postgres:postgres@127.0.0.1:54329/postgres \
node scripts/test-real-learning-loop.ts
```

The [Linux report](../artifacts/phase10-local-linux-learning-loop-2026-10-06.json), [compiler report](../artifacts/phase10-conformance-2026-10-06.json) and [local environment record](../artifacts/phase10-local-linux-environment-2026-10-06.json) are reviewable locally. Test databases and actors are disposable; production pilot publication has not been performed. Owned test services and VM are stopped after verification. F10 local closure was recorded on 2026-10-07 following the owner's completion request. Actual independent publication signatures remain outstanding. The owner subsequently authorized Phase 11 preparation; the persistent local database upgrade and checks are recorded in [release readiness](./phase10-release-readiness.md). No new permission request is pending and no Phase 10 work is committed or pushed.

## F10 closure record — 2026-10-07

The existing compiler and Linux reports were checked against the current four bundle files and recorded implementation-file hashes before updating the checkpoint. All 24 bundle/language identities and checksums match; the Linux report records actual sandbox execution, reasoning, authored fallback and external handoff journaling for each journey. No new runtime run was performed for this documentation-only closure.

The owner-requested closure applies to local engineering and delegated browser verification. It does not certify the original persistent-publication acceptance criteria. Those requirements remain listed in the plan/task ledger and enforced by the existing authenticated role-separated publication workflow. No source, database publication policy, role grant, production content or execution-host activation was changed for closure. No commit, push, PR, deployment or Phase 11 implementation was performed.
