# Retrieval operations — Task 43

## Current composition

`PostgresRetrievalRepository` is a server-only database adapter exported by `@algocove/db`. `packages/retrieval` owns input validation, bounded fusion and canonical evidence checksums. There is no learner retrieval endpoint or provider invocation in this task. Task 44 will compose the allowed tutor action, approved embedding/provider ports and validate-before-display delivery.

Fresh retrieval and embedding configurations default to disabled. Task 42 worker credentials cannot activate models or promote indexes. Task 43 introduces no activation command. Evaluated corpus approval, provider/data policy and promotion remain Tasks 44–45a. A published source or completed derivation job is insufficient for learner retrieval.

The adapter accepts an authenticated request context, a strict retrieval request, and a server-prepared query embedding. Browser input cannot supply roles, language, level, hint ceiling, candidate IDs, vectors or source text. The query embedding must name the exact immutable embedding configuration pinned by the retrieval configuration; dimensions, finiteness and normalization are validated.

## Authorization and ranking

The adapter rechecks an active database learner grant, owned viable attempt/session, current published problem and rights, and a published compatible curriculum. The attempt owns the programming language and mode. Hint scope is the minimum of recorded exposure, mode ceiling and the pre-submission ceiling of five. Retrieval does not record or advance hint exposure. Foreign-problem hint units are excluded; compatible original problem statements may be retrieved across the pinned curriculum/concept scope. Content language is `neutral` and target level is `unspecified`, matching the current authored schema.

A shared materialized SQL relation applies the mandatory filters before either ranker sees content: exact corpus index IDs, readiness/evaluation reference, current publication and rights, original provenance, canonical checksum, policy/validity, compatible curriculum/language/concepts, chunk visibility/scan/level, hint tier and enabled compatible model. Lexical candidates use English `plainto_tsquery` and `ts_rank_cd` with normalization 32. Dense candidates use exact pgvector cosine distance. These are PostgreSQL full-text and exact vector rankings; no BM25 or approximate index is claimed. See [PostgreSQL text-search controls](https://www.postgresql.org/docs/current/textsearch-controls.html) and [pgvector distance documentation](https://github.com/pgvector/pgvector).

The immutable configuration bounds each branch to at most 50 candidates, selection to at most 10 units, context to 80,000 characters and the retrieval deadline to at most two seconds. Equal-weight reciprocal-rank fusion, its constant, deterministic chunk-ID ties, exact-text deduplication and whole-unit context budgeting are versioned. Different snapshots of the same pedagogical source flag `version_disagreement`; this is not semantic contradiction detection. Empty or conflicting evidence carries `lowConfidence` and must not authorize an answer by itself.

## Receipts and retries

`0030_retrieval_evidence.sql` persists private immutable packages in `tutor.evidence_package`. A package includes the raw bounded request, normalized query, derived scope, configuration/corpus IDs, model and query vector, both original ranks/scores, candidate lineage/checksums, selected text/provenance, exclusions, conservative contradiction flags and timing. Canonical sorted-key JSON supplies a checksum that survives PostgreSQL JSONB key ordering. Package timing names its pre-persistence boundary explicitly; benchmark timing additionally includes commit.

Before persistence, all ranked sources are locked in sorted order and rechecked against current permission/publication/rights and immutable metadata. Persistence is atomic. The database binds package and attempt ownership and configuration identity; update/delete triggers protect receipts and configuration snapshots. Only the configuration enable flag may change. An owner-scoped idempotency key is serialized by a transaction advisory lock: an exact retry returns its original package and original vector; a changed request with that key conflicts.

`read(context, packageId)` and retries revalidate the current owner, grant, attempt/curriculum, exposure ceiling and enabled configuration. Every ranked candidate is rechecked, including unselected exclusions. Withdrawal of an unselected source therefore makes the entire historical package unavailable for serving. Historical rows are retained unchanged; this task does not implement the later privacy/takedown purge workflow. A changed model/corpus requires a new configuration and a new request key.

The overall deadline is reduced to the configured budget, including accumulated authorization/query/package work, and SQL statements receive the remaining timeout. Timeout cancellation becomes a safe dependency-unavailable result; failed transactions create no partial receipt. No provider call occurs while these locks are held.

## Local regression corpus

The declared corpus lives in [pilot-corpus.ts](../../tests/retrieval-eval/pilot-corpus.ts); database setup, permission controls, labels and measurement live in [retrieval.test.ts](../../tests/integration/retrieval.test.ts). [The recorded baseline](retrieval-baseline.json) includes PostgreSQL/pgvector versions, immutable corpus snapshots/checksums, configuration, scope, labels, selected IDs and full-operation latency.

The fixture has 23 pinned indexes: an original six-tier teaching problem, twelve original related two-pointer explanations and ten negative/control sources. Fifteen forbidden chunks cover unready/quarantined indexes, wrong language/curriculum/concept, expiry, draft/retired/tombstoned content and foreign-problem hints. The eight labeled queries use a hand-authored eight-dimensional term basis, exclusively in a disposable database. This is a deterministic plumbing/regression benchmark, not external-model quality evidence, human pedagogical review or production approval.

Run against an explicitly disposable local PostgreSQL operator connection with pgvector installed:

```sh
DATABASE_TEST_OPERATOR_URL='postgres://postgres:postgres@127.0.0.1:54329/postgres' \
ALGOCOVE_RETRIEVAL_REPORT_PATH=docs/architecture/retrieval-baseline.json \
pnpm exec vitest run --project integration tests/integration/retrieval.test.ts
```

The test creates and drops its own database and roles. Omit `ALGOCOVE_RETRIEVAL_REPORT_PATH` for normal tests so they do not rewrite the checked-in report. Provider promotion, production/load latency, multilingual natural-language retrieval, additional authored target levels and wider curriculum quality remain separate acceptance work.
