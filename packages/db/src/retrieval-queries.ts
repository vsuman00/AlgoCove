import { performance } from "node:perf_hooks";
import type { Pool, QueryResultRow, QueryResult } from "pg";
import { HINT_CEILINGS, PERMISSIONS, type LearningMode } from "@algocove/domain";
import {
  requirePermission,
  authorizationError,
  conflictError,
  dependencyUnavailableError,
  notFoundError,
  validationError,
  type RequestContext,
} from "@algocove/application";
import { checksum } from "@algocove/content";
import {
  assertPermittedCandidate,
  canonicalJson,
  embeddingConfigurationId,
  fuseCandidates,
  normalizeRetrievalQuery,
  parseRetrievalInput,
  sealEvidence,
  validateEmbeddings,
  validateRetrievalConfiguration,
  verifyEvidence,
  type EmbeddingConfiguration,
  type EvidencePackage,
  type RetrievalCandidate,
  type RetrievalConfiguration,
  type RetrievalInput,
  type RetrievalScope,
} from "@algocove/retrieval";
import { withTransaction } from "./transaction.ts";

const permittedSql = `WITH permitted AS MATERIALIZED (
 SELECT c.*,i.content_version_id,i.problem_version_id,i.source_checksum,i.normalized_checksum,i.concept_ids,i.curriculum_version_ids,i.languages,
 p.problem_id,v.title,v.rights_holder,v.license,e.vector
 FROM search.content_chunk c JOIN search.content_index i USING(index_id)
 JOIN content.problem_version p ON p.problem_version_id=i.problem_version_id AND p.content_version_id=i.content_version_id
 JOIN content.content_version v ON v.content_version_id=i.content_version_id
 JOIN search.chunk_embedding e ON e.chunk_id=c.chunk_id AND e.configuration_id=$8
 JOIN search.embedding_configuration f USING(configuration_id)
 WHERE i.index_id=ANY($1::text[]) AND i.state='ready' AND i.evaluation_reference IS NOT NULL AND i.policy_version=$7
 AND v.status='published' AND v.payload_status='available' AND v.provenance_kind='original' AND v.checksum=i.source_checksum
 AND (v.rights_expires_at IS NULL OR v.rights_expires_at>greatest($12::timestamptz,clock_timestamp()))
 AND i.valid_from<=greatest($12::timestamptz,clock_timestamp()) AND (i.valid_until IS NULL OR i.valid_until>greatest($12::timestamptz,clock_timestamp()))
 AND f.enabled AND f.provider<>'fixture' AND public.vector_dims(e.vector)=f.dimensions AND e.text_checksum=c.text_checksum
 AND $2=ANY(i.curriculum_version_ids) AND $3=ANY(i.languages) AND i.concept_ids && $6::text[]
 AND c.visibility='published_curriculum' AND c.language='neutral' AND c.target_level='unspecified' AND c.scan_status='passed'
 AND length($9::text)>=0 AND public.vector_dims($10::public.vector)>0 AND $11::integer>0
 AND c.hint_tier<=$4 AND (c.kind='problem_statement' OR (c.kind='hint_tier' AND i.problem_version_id=$5))
)`;
function candidateJson(score: string): string {
  return `jsonb_build_object('chunkId',chunk_id,'indexId',index_id,'contentVersionId',content_version_id,'problemVersionId',problem_version_id,'problemId',problem_id,
 'sourceObjectId',source_object_id,'kind',kind,'hintTier',hint_tier,'text',text,'textChecksum',text_checksum,'sourceChecksum',source_checksum,'normalizedChecksum',normalized_checksum,
 'title',title,'rightsHolder',rights_holder,'license',license,'conceptIds',concept_ids,'curriculumVersionIds',curriculum_version_ids,'languages',languages,
 'language',language,'targetLevel',target_level,'visibility',visibility,'score',${score})`;
}
const lexicalScore = "ts_rank_cd(lexical_document,plainto_tsquery('english',$9),32)";
const lexicalSql =
  permittedSql +
  ` SELECT ${candidateJson(lexicalScore)} AS candidate,${lexicalScore} AS score
 FROM permitted WHERE lexical_document @@ plainto_tsquery('english',$9) ORDER BY score DESC,chunk_id LIMIT $11`;
const denseScore = "vector OPERATOR(public.<=>) $10::public.vector";
const denseSql =
  permittedSql +
  ` SELECT ${candidateJson(denseScore)} AS candidate,${denseScore} AS distance FROM permitted ORDER BY distance,chunk_id LIMIT $11`;
const currentSql =
  permittedSql +
  ` SELECT ${candidateJson("0")} AS candidate FROM permitted WHERE chunk_id=ANY($13::text[]) AND length($9)>=0 AND public.vector_dims($10::public.vector)>0 AND $11>0 ORDER BY chunk_id`;
type Query = <T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: readonly unknown[],
) => Promise<QueryResult<T>>;
type Model = EmbeddingConfiguration & { configurationId: string };
type RankedRow = { candidate: RetrievalCandidate };
function parameters(
  scope: RetrievalScope,
  c: RetrievalConfiguration,
  normalizedQuery: string,
  vector: readonly number[],
  now: string,
): readonly unknown[] {
  return [
    c.indexIds,
    scope.curriculumVersionId,
    scope.language,
    scope.maximumHintTier,
    scope.problemVersionId,
    scope.conceptIds,
    c.chunkPolicyVersion,
    c.embeddingConfigurationId,
    normalizedQuery,
    "[" + vector.join(",") + "]",
    c.candidateLimit,
    now,
  ];
}
/** Server-only retrieval. No provider calls, progress writes or learner-source reads. */
export class PostgresRetrievalRepository {
  private readonly pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }
  private async scope(
    q: Query,
    ctx: RequestContext,
    input: RetrievalInput,
  ): Promise<RetrievalScope> {
    requirePermission(ctx, PERMISSIONS.profileRead);
    const role = await q(
      "SELECT 1 FROM platform.role_grant WHERE learner_id=$1 AND role='learner' AND revoked_at IS NULL FOR SHARE",
      [ctx.actor.userId],
    );
    if (!role.rowCount) throw authorizationError("Active learner access is required.");
    const attempt = (
      await q<{
        problem_version_id: string;
        content_version_id: string;
        language: string;
        mode: LearningMode;
        status: string;
      }>(
        `SELECT a.problem_version_id,p.content_version_id,a.language,a.mode,a.status FROM practice.attempt a
   JOIN practice.learning_session s ON s.session_id=a.session_id AND s.learner_id=a.learner_id
   JOIN content.problem_version p ON p.problem_version_id=a.problem_version_id JOIN content.content_version v USING(content_version_id)
   WHERE a.attempt_id=$1 AND a.learner_id=$2 AND a.status IN ('active','submitted') AND
   ((a.status='active' AND s.status='active') OR (a.status='submitted' AND s.status IN ('active','completed')))
   AND v.status='published' AND v.payload_status='available' AND (v.rights_expires_at IS NULL OR v.rights_expires_at>greatest($3::timestamptz,clock_timestamp()))
   FOR SHARE OF a,s,v`,
        [input.attemptId, ctx.actor.userId, ctx.now],
      )
    ).rows[0];
    if (!attempt) throw notFoundError("Owned learning context is unavailable.");
    const concepts = (
      await q<{ concept_id: string }>(
        "SELECT concept_id FROM learning.problem_concept WHERE problem_version_id=$1 ORDER BY concept_id",
        [attempt.problem_version_id],
      )
    ).rows.map((r) => r.concept_id);
    const curriculum = await q(
      `SELECT 1 FROM learning.curriculum_graph_version g WHERE curriculum_version_id=$1 AND status='published'
   AND NOT EXISTS(SELECT 1 FROM unnest($2::text[]) c(concept_id) WHERE NOT EXISTS(SELECT 1 FROM learning.curriculum_node n WHERE n.curriculum_version_id=g.curriculum_version_id AND n.concept_id=c.concept_id)) FOR SHARE OF g`,
      [input.curriculumVersionId, concepts],
    );
    if (!concepts.length || !curriculum.rowCount)
      throw notFoundError("Compatible published curriculum is unavailable.");
    const exposure = (
      await q<{ highest: number }>(
        "SELECT COALESCE(max(tier),0)::integer AS highest FROM practice.hint_exposure WHERE learner_id=$1 AND problem_version_id=$2",
        [ctx.actor.userId, attempt.problem_version_id],
      )
    ).rows[0]!.highest;
    return {
      learnerId: ctx.actor.userId,
      attemptId: input.attemptId,
      problemVersionId: attempt.problem_version_id,
      curriculumVersionId: input.curriculumVersionId,
      language: attempt.language,
      conceptIds: concepts,
      targetLevel: "unspecified",
      visibility: "published_curriculum",
      maximumHintTier: Math.min(
        exposure,
        HINT_CEILINGS[attempt.mode],
        attempt.status === "submitted" ? 6 : 5,
      ),
    };
  }
  private async configuration(
    q: Query,
    version: string,
  ): Promise<{ configuration: RetrievalConfiguration; model: Model }> {
    const row = (
      await q<{
        body: RetrievalConfiguration;
        configuration_id: string;
        provider: string;
        model: string;
        dimensions: number;
        normalization: "unit" | "none";
        policy_version: string;
      }>(
        `SELECT r.body,f.* FROM search.retrieval_configuration r JOIN search.embedding_configuration f ON f.configuration_id=r.embedding_configuration_id
   WHERE r.configuration_version=$1 AND r.enabled AND f.enabled AND f.provider<>'fixture' FOR SHARE OF r,f`,
        [version],
      )
    ).rows[0];
    if (!row) throw dependencyUnavailableError("Evaluated retrieval configuration is unavailable.");
    try {
      validateRetrievalConfiguration(row.body);
    } catch {
      throw dependencyUnavailableError("Retrieval configuration is invalid.");
    }
    const model: Model = {
      configurationId: row.configuration_id,
      provider: row.provider,
      model: row.model,
      dimensions: row.dimensions,
      normalization: row.normalization,
      policyVersion: row.policy_version,
    };
    if (
      row.body.version !== version ||
      row.body.embeddingConfigurationId !== embeddingConfigurationId(model)
    )
      throw dependencyUnavailableError("Retrieval model identity is invalid.");
    return { configuration: row.body, model };
  }
  private async recheck(
    q: Query,
    ctx: RequestContext,
    scope: RetrievalScope,
    c: RetrievalConfiguration,
    query: string,
    vector: readonly number[],
    rows: readonly RetrievalCandidate[],
  ): Promise<void> {
    const unique = [...new Map(rows.map((row) => [row.chunkId, row])).values()];
    if (!unique.length) return;
    for (const contentId of [...new Set(unique.map((row) => row.contentVersionId))].sort())
      await q("SELECT content.lock_index_source($1)", [contentId]);
    const ids = unique.map((row) => row.chunkId);
    const current = (
      await q<RankedRow>(currentSql, [...parameters(scope, c, query, vector, ctx.now), ids])
    ).rows.map((row) => row.candidate);
    if (current.length !== unique.length)
      throw conflictError("Retrieval evidence became unavailable.");
    const currentMap = new Map(current.map((row) => [row.chunkId, row]));
    for (const old of unique) {
      const fresh = currentMap.get(old.chunkId);
      if (!fresh) throw conflictError("Retrieval evidence became unavailable.");
      assertPermittedCandidate(fresh, scope, c);
      const { score: _oldScore, ...oldBody } = old;
      const { score: _freshScore, ...freshBody } = fresh;
      if (canonicalJson(oldBody) !== canonicalJson(freshBody))
        throw conflictError("Retrieval evidence lineage changed.");
    }
  }
  async retrieve(
    ctx: RequestContext,
    raw: unknown,
    embedding: { configurationId: string; vector: readonly number[] },
  ): Promise<EvidencePackage> {
    let input: RetrievalInput;
    try {
      input = parseRetrievalInput(raw);
    } catch {
      throw validationError("A bounded retrieval request is required.");
    }
    const digest = checksum(canonicalJson(input)),
      start = performance.now();
    return withTransaction(
      this.pool,
      async (tx) => {
        let deadline = start + 2000;
        const q: Query = async <T extends QueryResultRow>(
          sql: string,
          params?: readonly unknown[],
        ): Promise<QueryResult<T>> => {
          const remaining = Math.floor(deadline - performance.now());
          if (remaining < 1) throw dependencyUnavailableError("Retrieval deadline exceeded.");
          try {
            await tx.query("SELECT set_config('statement_timeout',$1,true)", [String(remaining)]);
            return await tx.query<T>(sql, params);
          } catch (error) {
            if (
              typeof error === "object" &&
              error !== null &&
              "code" in error &&
              error.code === "57014"
            )
              throw dependencyUnavailableError("Retrieval deadline exceeded.");
            throw error;
          }
        };
        const scope = await this.scope(q, ctx, input);
        await q("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
          ctx.actor.userId + ":" + input.idempotencyKey,
        ]);
        const { configuration: c, model } = await this.configuration(q, input.configurationVersion);
        deadline = Math.min(deadline, start + c.timeoutMs);
        const existing = (
          await q<{ body: EvidencePackage; request_digest: string }>(
            "SELECT body,request_digest FROM tutor.evidence_package WHERE learner_id=$1 AND idempotency_key=$2",
            [ctx.actor.userId, input.idempotencyKey],
          )
        ).rows[0];
        if (existing) {
          if (existing.request_digest !== digest)
            throw conflictError("Retrieval key was reused for another request.");
          await this.validateStored(q, ctx, scope, c, existing.body);
          return existing.body;
        }
        if (embedding.configurationId !== c.embeddingConfigurationId)
          throw validationError("Query embedding configuration must match retrieval.");
        let vector: readonly number[];
        try {
          validateEmbeddings([embedding.vector], 1, model);
          vector = embedding.vector.map(Math.fround);
        } catch {
          throw validationError("Query embedding is invalid.");
        }
        const normalized = normalizeRetrievalQuery(input.query);
        if (!normalized) throw validationError("Retrieval query is empty.");
        const args = parameters(scope, c, normalized, vector, ctx.now),
          authorizationEnd = performance.now();
        const lexical = (await q<RankedRow>(lexicalSql, args)).rows.map((row) => row.candidate),
          lexicalEnd = performance.now();
        const dense = (await q<RankedRow>(denseSql, args)).rows.map((row) => row.candidate),
          denseEnd = performance.now();
        const fused = fuseCandidates(lexical, dense, scope, c);
        await this.recheck(q, ctx, scope, c, normalized, vector, [...lexical, ...dense]);
        const end = performance.now();
        const evidence = sealEvidence({
          schemaVersion: 1,
          packageId: ctx.ids.generate("event"),
          requestId: ctx.requestId,
          createdAt: ctx.now,
          request: input,
          normalizedQuery: normalized,
          scope,
          configuration: c,
          queryVector: vector,
          model: {
            provider: model.provider,
            model: model.model,
            dimensions: model.dimensions,
            normalization: model.normalization,
            policyVersion: model.policyVersion,
          },
          lexical: lexical.map((row, i) => ({
            chunkId: row.chunkId,
            rank: i + 1,
            score: row.score,
          })),
          dense: dense.map((row, i) => ({
            chunkId: row.chunkId,
            rank: i + 1,
            distance: row.score,
          })),
          candidates: fused.ranked.map((entry) => ({
            chunkId: entry.candidate.chunkId,
            indexId: entry.candidate.indexId,
            contentVersionId: entry.candidate.contentVersionId,
            textChecksum: entry.candidate.textChecksum,
            sourceChecksum: entry.candidate.sourceChecksum,
            normalizedChecksum: entry.candidate.normalizedChecksum,
            lexicalRank: entry.lexicalRank,
            denseRank: entry.denseRank,
            fusedScore: entry.fusedScore,
          })),
          selected: fused.selected.map((entry) => ({
            evidenceItemId: entry.candidate.chunkId,
            ...entry,
          })),
          excluded: fused.excluded,
          contradictions: fused.contradictions,
          lowConfidence: fused.lowConfidence,
          timing: {
            authorizationMs: authorizationEnd - start,
            lexicalMs: lexicalEnd - authorizationEnd,
            denseMs: denseEnd - lexicalEnd,
            packagingMs: end - denseEnd,
            totalBeforePersistenceMs: end - start,
          },
        });
        await q(
          "INSERT INTO tutor.evidence_package(package_id,learner_id,attempt_id,idempotency_key,request_digest,configuration_version,body,checksum,created_at) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)",
          [
            evidence.packageId,
            ctx.actor.userId,
            input.attemptId,
            input.idempotencyKey,
            digest,
            c.version,
            JSON.stringify(evidence),
            evidence.checksum,
            ctx.now,
          ],
        );
        return evidence;
      },
      { statementTimeoutMs: 2000 },
    );
  }
  private async validateStored(
    q: Query,
    ctx: RequestContext,
    scope: RetrievalScope,
    c: RetrievalConfiguration,
    evidence: EvidencePackage,
  ): Promise<void> {
    if (
      !verifyEvidence(evidence) ||
      canonicalJson(evidence.configuration) !== canonicalJson(c) ||
      scope.maximumHintTier < evidence.scope.maximumHintTier ||
      canonicalJson({ ...scope, maximumHintTier: evidence.scope.maximumHintTier }) !==
        canonicalJson(evidence.scope)
    )
      throw conflictError("Stored retrieval evidence is no longer permitted.");
    // Candidate IDs and exclusions are evidence too: fail closed if any source
    // in the stored union has lost permission, even when it was not selected.
    for (const contentId of [...new Set(evidence.candidates.map((r) => r.contentVersionId))].sort())
      await q("SELECT content.lock_index_source($1)", [contentId]);
    if (evidence.candidates.length) {
      const rows = (
        await q<RankedRow>(currentSql, [
          ...parameters(scope, c, evidence.normalizedQuery, evidence.queryVector, ctx.now),
          evidence.candidates.map((r) => r.chunkId),
        ])
      ).rows.map((r) => r.candidate);
      const current = new Map(rows.map((r) => [r.chunkId, r]));
      if (current.size !== evidence.candidates.length)
        throw conflictError("Stored retrieval evidence is no longer permitted.");
      for (const old of evidence.candidates) {
        const fresh = current.get(old.chunkId)!;
        assertPermittedCandidate(fresh, scope, c);
        for (const key of [
          "indexId",
          "contentVersionId",
          "textChecksum",
          "sourceChecksum",
          "normalizedChecksum",
        ] as const)
          if (fresh[key] !== old[key]) throw conflictError("Stored retrieval lineage changed.");
      }
    }
    await this.recheck(
      q,
      ctx,
      scope,
      c,
      evidence.normalizedQuery,
      evidence.queryVector,
      evidence.selected.map((item) => item.candidate),
    );
  }
  async read(ctx: RequestContext, packageId: string): Promise<EvidencePackage> {
    const start = performance.now();
    return withTransaction(
      this.pool,
      async (tx) => {
        let deadline = start + 2000;
        const q: Query = async <T extends QueryResultRow>(
          sql: string,
          params?: readonly unknown[],
        ): Promise<QueryResult<T>> => {
          const remaining = Math.floor(deadline - performance.now());
          if (remaining < 1) throw dependencyUnavailableError("Retrieval deadline exceeded.");
          try {
            await tx.query("SELECT set_config('statement_timeout',$1,true)", [String(remaining)]);
            return await tx.query<T>(sql, params);
          } catch (error) {
            if (
              typeof error === "object" &&
              error !== null &&
              "code" in error &&
              error.code === "57014"
            )
              throw dependencyUnavailableError("Retrieval deadline exceeded.");
            throw error;
          }
        };
        requirePermission(ctx, PERMISSIONS.profileRead);
        const row = (
          await q<{ body: EvidencePackage }>(
            "SELECT body FROM tutor.evidence_package WHERE package_id=$1 AND learner_id=$2",
            [packageId, ctx.actor.userId],
          )
        ).rows[0];
        if (!row) throw notFoundError("Evidence package is unavailable.");
        const scope = await this.scope(q, ctx, row.body.request),
          { configuration } = await this.configuration(q, row.body.request.configurationVersion);
        deadline = Math.min(deadline, start + configuration.timeoutMs);
        await this.validateStored(q, ctx, scope, configuration, row.body);
        return row.body;
      },
      { statementTimeoutMs: 2000 },
    );
  }
}
