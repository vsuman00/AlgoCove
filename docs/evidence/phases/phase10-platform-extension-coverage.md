# Phase 10 extension journey coverage

2026-10-07. Local engineering evidence for Tasks 45b–45g and 50a–50c. HTTP browser fixtures verify interface contracts; PostgreSQL integration verifies ownership, publication and persistence; the isolated Linux report verifies actual execution. Synthetic reviewer actors do not supply independent human publication signatures. Private/shared sheets, interviews, account export/deletion and live AI remain later-phase work and have no new advertised actions.

Release identities: the original `prb_dddddddddddddddd`; four immutable pilot v1 bundles resolved through `pilotIdentity`; a disposable SQL-only `prb_6666666666666666`; a generated disposable typed release in `pilot-curriculum.test.ts`; canonical destination fixtures `ref_7777777777777777` / `ref_8888888888888888`. The Linux report pins each of its 24 pilot journeys to its exact problem/content/bundle checksum. All fixture publications occur only in disposable databases.

Evidence abbreviations: **B** = `tests/e2e/learning-platform-extension.spec.ts`; **P** = `tests/e2e/pilot-curriculum.spec.ts`; **D** = `tests/integration/pilot-curriculum.test.ts`; **L** = [actual Linux report](../artifacts/phase10-extension-linux-learning-loop-2026-10-07.json); **A** = `tests/accessibility`; **R** = `tests/e2e/roadmap.spec.ts`, `roadmap-provider.spec.ts` and `tests/integration/roadmap.test.ts`; **C** = `tests/e2e/companion-journey.spec.ts` and companion integration; **S** = `tests/e2e/draft-sync.spec.ts`, draft route/unit/integration tests. See [delivery evidence](./phase10-platform-extension-evidence.md) for final check totals.

| Journey | Task and evidence | Release / remaining boundary |
| --- | --- | --- |
| J01 Home and resume | 45f/50c; A home recommendation, S, L | Original + pilot v1; recommendations retain existing authority |
| J02 Authentication/onboarding return | 45f; B, return-target unit tests, A onboarding | Bounded same-origin context and explicit cancel; live Clerk account handshake is not fixture evidence |
| J03 Topics and lessons | 45c/45g/50a; D release projection/publication, B/P discovery, typed lesson page | Latest eligible release; advanced course authoring belongs to 58–59 |
| J04 Search/filter/deep links | 45c/50a; B pagination/search/language/retry, P alias reload, D SQL filters | Stable slug/alias and exact version; invalid syntax returns 404, valid unavailable slugs render an unavailable workspace |
| J05 Learning stages and reasoning | 45c/45e; B distinct typed panels/draft preservation, D grading, L | Draft-owning panels stay mounted; free text is not a correctness proof |
| J06 Walkthrough timeline | 45e; walkthrough unit tests and P all frames, playback, speed, scrub, keyboard, flat/spatial | Schema-1 legacy and schema-2 adapter/schema-3 timeline; one reviewed approach/scenario per current pilot; future alternatives require authored assets |
| J07 Edit/run/submit/recover | 45c/50c; S, A, L | Six languages, owned pins, no judged credit from presentation |
| J08 Curated sheets/progress | 45d/50a; B ordered entries, D canonical dedup and isolated owner progress | Membership occurrences retained; one canonical progress state, self-report remains distinct from mastery |
| J09 Private sheet edits | Task 59a deferred | No private-sheet action added |
| J10 Share/revoke/moderate | Task 59b deferred | No sharing action added |
| J11 External solve/media/return | 45d/45g/50a; C, D independent reconciliation, release packet media tests | Canonical solve URL separate from source and optional explanation/video; ordinary safe anchors |
| J12 Planning/replan/history | 50b/50c; R, D shared catalog and overlapping collection coverage | Exact supported versions, deterministic estimates v1, insufficient full-course scope explicit; live AI separate |
| J13 Hints/reference/tutor | 45c/45e/50c; D/P reveal accounting, L, worker-offline browser test | Assistance recorded before reference delivery; authored fallback remains usable |
| J14 Review/progress/summary | 50c; A phase6, review/progress integration, L | Existing evidence/projection policy remains authoritative; unavailable release exercises are hidden |
| J15 DSA interview | Tasks 61–64 deferred | No interview action added |
| J16 Code review interview | Tasks 65–66/68 deferred | No interview action added |
| J17 Design interview | Tasks 65/67–68 deferred | No interview action added |
| J18 Author/preview/publish/withdraw | 45g; D typed preflight, independent reviews, stale revision rejection and withdrawal; packet/walkthrough validation; P staff denial | Atomic release packet with exact role/language pins; published versions immutable; human signatures separate |
| J19 Privacy/accessibility/operations | 45f/50c; S ownership isolation, B/P/A keyboard/mobile/axe, L infrastructure errors, shell status exit | Export/delete/support moderation remain Phase 11/later; manual assistive-technology review outside browser-only scope |

| Edge | Evidence and behavior | Remaining boundary |
| --- | --- | --- |
| E01 Loading/empty/no matches/partial | B/D bounded pages and retry; R insufficient scope | No full-course claim |
| E02 Session expiry/cross-owner | S, web ownership tests, D role denial and owner progress | Private workspace remains actor scoped |
| E03 Alias/missing/withdrawn | P/D, A malformed-route 404; lesson unavailable exit | Valid slug availability checked by published API; no fixed slug allowlist |
| E04 Back/stage/language/unload | B stage draft preservation, P six-language switch, S reload; best-effort unload warning | Browser termination cannot guarantee recovery; anonymous edits have no private save claim |
| E05 Offline/lost response/multiple tabs | S draft sync, integration expected-version conflicts, C lost handoff response | Local and remote receipts remain distinct |
| E06 Duplicate/stale/reordered | D packet replay/stale reviews, web draft/trace generation guards, R stale candidates | Reconciliation conflicts require reloading the source version |
| E07 Language/executor failures | P languages; L actual compile/runtime/limits/cancel/host loss/missing images | Infrastructure failures grant no correctness credit |
| E08 Timeline/reset/malformed | Walkthrough unit tests; P step/scrub/play/pause/speed/end; prop change resets playback | Current authored pilots have one approach/scenario; no synthetic alternatives |
| E09 Reasoning/reveal | D server-only keys and hint exposure; L graded structured checks | Alternate free-text explanations remain advisory |
| E10 Broken/editorial/external return | C blocked links/lost handoff/journal correction; D ambiguous sources and independent reconciliation | Source list is never inferred to be a solve destination |
| E11 Optional media/transcript | Release packet validation, separate media roles and ordinary anchor fallback | No embed dependency; unprovided media is absent; essential transcript required |
| E12 Infeasible/stale/missed/replan | R capacity rejection, preview/accept/pause/history | Live generation approvals remain separate |
| E13 Duplicate memberships | D ordered occurrences, distinct counts and canonical owner overlay; B sheet labels | Private reorder/edit is Task 59a |
| E14 Share revoke/abuse | Deferred 59b; D release withdrawal covers shipped catalog | Sharing/moderation not advertised |
| E15 Interview reconnect/deadline | Deferred 61–64 | Interviews not advertised |
| E16 AI unavailable/budget | Worker-offline browser test, roadmap-provider fixtures, budget/provider integration | Authored/off baseline; no live-provider activation |
| E17 Projection/correction/repeated sheets | A phase6 pending receipts, C journal correction, D dedup; L signed callbacks | Self-report does not create mastery evidence |
| E18 Export/delete/logout/jobs | Existing actor-scoped draft tests; export/delete lifecycle deferred 52–55a | No new export/delete promise |
| E19 Keyboard/mobile/reduced motion | B/P/A; 320px, zoom, keyboard, semantic current step, flat/text equivalent | Browser automation/axe is not a manual screen-reader pass |
