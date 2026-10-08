# Tutor and retrieval evaluation operations

Task 45 implements the local configuration promotion gate described in the [data and AI architecture](data-and-ai-architecture.md). [Task 44 delivery](tutor-operations.md) still defaults to authored help without a live adapter.

## Immutable evidence and authority

`PostgresEvaluationRepository` owns declaration, admission, review, promotion and rollback. All operations check application permissions and current database grants. Evaluators declare suites and record runs; operators register versioned configurations and change rollout channels. The human reviewer must be a different evaluator from the run submitter. Reviewer grants are checked again during promotion. Test reviewers and scores are fixture data, not actual pedagogical approval.

Migration `0032_evaluation_promotion.sql` stores immutable suite membership, thresholds, rubric/sample, configuration pins, checksummed runs, independent human judgments and decisions. Runs carry a code version, environment and exact suite/configuration versions. Configuration pins cover corpus, index, retrieval, generation, prompt and policy versions. Changing any pin requires a new configuration version; changing cases or thresholds requires a new suite version. Duplicate, missing and foreign case results are rejected. JSON checksums are recomputed when the gate reads records. Database triggers prevent evidence mutation and pointer changes without a matching accepted decision. The shared application database role is trusted to use these repository commands, consistent with other staff workflows; this is not a security boundary against arbitrary SQL from a compromised runtime role or migration owner.

Both `fixture` and `production` channels initially select `authored.off.v1`, an available provider-free rollback target. A production decision rejects fixture configurations. Nonfixture configuration registration requires an owner approval reference, and its runs require the `approved-evaluation` environment. An approval reference records a previously reviewed decision; it does not create provider, region or learner-data-policy approval.

The registry is the rollout selection record for subsequent approved adapter composition. It does not toggle embedding flags, promote content indexes, construct a live transport, or change the default web runtime. Existing enabled search catalog entries and explicitly composed test adapters are distinct from a production rollout. Task 45a now implements this binding for model/prompt/policy/catalog versions and HTTPS route identities; see [roadmap AI operations](roadmap-ai-operations.md). Actual provider activation remains pending the named live decision and real synthetic evaluation. Live activation remains gated by the documented model/data-policy decision.

## Evaluation data and metrics

The admitted dataset format contains only synthetic original case IDs, relevance/forbidden IDs, expected validated/fallback disposition and critical labels. Query text, learner IDs, source code, tutor requests and raw provider responses are not admitted. There is no learner-payload export/import path. Strict nested field lists reject undeclared private-data fields; synthetic provenance is an evaluator attestation and still needs review. A new approved provenance policy would require a separate implementation and review.

`evaluateRanking` computes binary relevance recall@k, reciprocal rank@k and nDCG@k over unique canonical IDs. It checks forbidden results across the whole supplied ranking, including entries below the display cutoff. Empty relevance, duplicate IDs and conflicting labels fail admission. `evaluatePromotion` computes suite means and enforces positive quality thresholds, worst-case completion latency and per-request reserved character cost. Any reported policy/privacy violation or forbidden retrieval blocks promotion regardless of average quality. Critical cases additionally require the expected abstention/validation outcome.

`measureEvaluationCase` runs a synthetic generator with a maximum four-second abort/race deadline, buffers and invokes the actual validator, scans validated output for declared synthetic leakage canaries, derives disposition and records duration and character units. Text is discarded; only IDs, counts and metrics are returned. At this buffered boundary time to first validated response equals completion time. Cost units are prompt characters plus bounded candidate characters (16,000 + 12,000 maximum), matching the conservative reservation policy; they are **not billed tokens, currency or a live-provider pricing benchmark**. Production evaluation needs approved model-specific measurement and pricing evidence before activation.

Generation fixture cases exercise structure, versions, citations, unsupported claims, tool directives, tier restrictions and abstention. Human rubric `grounding.pedagogy.v1` separately reviews correctness, citation support/completeness and pedagogical usefulness: a score at least 0.8 and explicit acceptance are required for every declared sample. An unresolved negative judgment blocks promotion even alongside a positive judgment. Fixture scores test this gate; they do not establish production generation quality or delayed learning gains. Canary and pattern checks cover declared cases and do not prove absence of all semantic leakage.

## Promotion and rollback workflow

1. An operator registers an immutable candidate manifest referencing retained, reviewed corpus/index/model/prompt/policy versions. The candidate and current rollback artifacts must remain available.
2. An evaluator declares a versioned suite and thresholds before recording measured results. Use synthetic harness inputs and keep raw candidates out of the evaluation tables.
3. A second evaluator records the declared human sample with its exact rubric, score, acceptance and a bounded rationale code. No learner text belongs in rationale codes.
4. Call `promote(context, { channel, runId, expectedActive, rollbackVersion })`. The rollback version must equal the current available configuration. The command locks the channel, reads stored evidence, recomputes metrics and records an accepted or rejected decision. Accepted decision and pointer update commit together. Rejection returns reasons and leaves the current pointer intact. Stale commands conflict.
5. Call `rollback(context, channel, acceptedPromotionDecisionId)`. Only the current accepted promotion can be rolled back; it returns to its retained available target and records a new immutable decision atomically. A stale decision, a second rollback or a missing/unavailable target fails.
6. Inspect `active(context, channel)` and the decision history. Keep prior configuration artifacts available for the rollback window. Do not infer runtime/provider activation from fixture registry state.

## Reproducible local verification

- `pnpm test:retrieval-eval`: ranking arithmetic, exact suite membership, strict private-data exclusion, positive thresholds, critical regressions, cost/latency and human gates.
- `pnpm test:adversarial`: actual fixture gateway/validator, prompt injection, solution/tier bypass, citation/version forgery, unsupported output, leakage canary outside the pattern filter and an ignored-cancellation deadline.
- `pnpm test:integration`: disposable PostgreSQL fixtures demonstrate accepted promotion, durable rejection, rollback, stale/concurrent fencing, atomic failure recovery, role revocation, immutability and real permission-filtered retrieval against eight original labelled queries.

Integration uses its existing isolated database/role fixture on `DATABASE_TEST_OPERATOR_URL` (default loopback port 54329); it never migrates a retained learner database. Fixture configuration approvals and human scores exist only in that disposable database. Evidence and limitations are recorded in the [Phase 9 evidence](../evidence/phases/phase9-evidence.md).
