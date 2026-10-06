import type { Pool } from "pg";
import {
  CHUNK_POLICY_VERSION,
  identity,
  deriveChunks,
  DerivationFailure,
  type Derivation,
  type IndexSource,
} from "@algocove/content";
import {
  embeddingConfigurationId,
  validateEmbeddings,
  type ContentDescriptor,
  type EmbeddingConfiguration,
  type IndexJob,
  type IndexStore,
} from "@algocove/retrieval";
import type { ClaimedOutboxEvent } from "./outbox-relay-repository.ts";
import { PostgresWorkerEffectsRepository } from "./worker-effects-repository.ts";
import type { Transaction } from "./transaction.ts";

const sourceSql = `SELECT jsonb_build_object(
 'contentVersionId',v.content_version_id,'problemVersionId',p.problem_version_id,'sourceChecksum',v.checksum,
 'title',v.title,'statement',CASE WHEN v.payload_status='available' THEN p.statement ELSE NULL END,
 'provenance',v.provenance_kind,'status',v.status,'payloadStatus',v.payload_status,'publishedAt',v.published_at,'rightsExpiresAt',v.rights_expires_at,
 'concepts',COALESCE((SELECT jsonb_agg(concept_id ORDER BY concept_id) FROM learning.problem_concept WHERE problem_version_id=p.problem_version_id),'[]'::jsonb),
 'curricula',COALESCE((SELECT jsonb_agg(DISTINCT n.curriculum_version_id ORDER BY n.curriculum_version_id) FROM learning.curriculum_node n JOIN learning.curriculum_graph_version g USING(curriculum_version_id) WHERE g.status='published' AND EXISTS(SELECT 1 FROM learning.problem_concept pc WHERE pc.problem_version_id=p.problem_version_id AND pc.concept_id=n.concept_id)),'[]'::jsonb),
 'languages',COALESCE((SELECT jsonb_agg(language ORDER BY language) FROM content.problem_language_manifest WHERE problem_version_id=p.problem_version_id AND status='published'),'[]'::jsonb),
 'hints',COALESCE((SELECT jsonb_agg(jsonb_build_object('hintId',hint_id,'tier',tier,'kind',kind,'body',body) ORDER BY tier,hint_id) FROM content.problem_hint WHERE problem_version_id=p.problem_version_id),'[]'::jsonb)) AS source
 FROM content.content_version v JOIN content.problem_version p USING(content_version_id) WHERE v.content_version_id=$1 AND v.checksum=$2`;
export class PostgresContentIndexRepository implements IndexStore {
  private readonly effects: PostgresWorkerEffectsRepository;
  private readonly pool: Pool;
  private readonly relayId: string;
  private readonly now: () => string;
  constructor(pool: Pool, relayId: string, now: () => string) {
    this.pool = pool;
    this.relayId = relayId;
    this.now = now;
    this.effects = new PostgresWorkerEffectsRepository(pool);
  }
  async load(d: ContentDescriptor): Promise<IndexSource | null> {
    return (
      (
        await this.pool.query<{ source: IndexSource }>(sourceSql, [
          d.contentVersionId,
          d.sourceChecksum,
        ])
      ).rows[0]?.source ?? null
    );
  }
  private async canonical(
    tx: Transaction,
    d: ContentDescriptor,
    expected?: Derivation,
  ): Promise<boolean> {
    await tx.query("SELECT content.lock_index_source($1)", [d.contentVersionId]);
    const source = (
      await tx.query<{ source: IndexSource }>(sourceSql, [d.contentVersionId, d.sourceChecksum])
    ).rows[0]?.source;
    if (!source) return false;
    try {
      const current = deriveChunks(
        source,
        expected?.policyVersion ?? CHUNK_POLICY_VERSION,
        this.now(),
      );
      if (expected && JSON.stringify(current) !== JSON.stringify(expected))
        throw Error("Canonical derivation changed.");
      return true;
    } catch (error) {
      if (error instanceof DerivationFailure && error.code === "unavailable") return false;
      throw error;
    }
  }
  private async expectation(tx: Transaction, eventId: string, state: string): Promise<void> {
    await tx.query("UPDATE platform.worker_derivation_expectation SET state=$2 WHERE event_id=$1", [
      eventId,
      state,
    ]);
  }
  async commitDerivation(job: IndexJob, d: ContentDescriptor, derived: Derivation): Promise<void> {
    await this.effects.apply(
      job as ClaimedOutboxEvent,
      this.relayId,
      "content.derivation.v1",
      this.now(),
      async (tx) => {
        if (!(await this.canonical(tx, d, derived))) {
          await this.expectation(tx, job.eventId, "obsolete");
          return { obsolete: 1 };
        }
        const inserted = await tx.query(
          `INSERT INTO search.content_index(index_id,content_version_id,problem_version_id,policy_version,source_checksum,normalized_checksum,scan_version,concept_ids,curriculum_version_ids,languages,valid_from,valid_until,created_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(index_id) DO NOTHING`,
          [
            derived.indexId,
            derived.contentVersionId,
            derived.problemVersionId,
            derived.policyVersion,
            derived.sourceChecksum,
            derived.normalizedChecksum,
            derived.scanVersion,
            derived.concepts,
            derived.curricula,
            derived.languages,
            derived.validFrom,
            derived.validUntil,
            this.now(),
          ],
        );
        if (inserted.rowCount)
          for (const c of derived.chunks)
            await tx.query(
              `INSERT INTO search.content_chunk(chunk_id,index_id,kind,ordinal,source_object_id,text,text_checksum,hint_tier,language,target_level,visibility,scan_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
              [
                c.chunkId,
                derived.indexId,
                c.kind,
                c.ordinal,
                c.sourceObjectId,
                c.text,
                c.textChecksum,
                c.hintTier,
                c.language,
                c.targetLevel,
                c.visibility,
                c.scanStatus,
              ],
            );
        else {
          const rows = await tx.query<{ chunk_id: string; text_checksum: string }>(
            "SELECT chunk_id,text_checksum FROM search.content_chunk WHERE index_id=$1 ORDER BY ordinal",
            [derived.indexId],
          );
          if (
            JSON.stringify(rows.rows) !==
            JSON.stringify(
              derived.chunks.map((c) => ({ chunk_id: c.chunkId, text_checksum: c.textChecksum })),
            )
          )
            throw Error("Existing index lineage mismatch.");
        }
        await this.expectation(tx, job.eventId, "ready");
        return { chunks: derived.chunks.length, indexes: inserted.rowCount ?? 0 };
      },
    );
  }
  async commitEmbeddings(
    job: IndexJob,
    d: ContentDescriptor,
    derived: Derivation,
    config: EmbeddingConfiguration,
    vectors: readonly (readonly number[])[],
  ): Promise<void> {
    validateEmbeddings(vectors, derived.chunks.length, config);
    const configId = embeddingConfigurationId(config);
    await this.effects.apply(
      job as ClaimedOutboxEvent,
      this.relayId,
      "content.embedding.v1",
      this.now(),
      async (tx) => {
        if (!(await this.canonical(tx, d, derived))) {
          await this.expectation(tx, job.eventId, "obsolete");
          return { obsolete: 1 };
        }
        const existing = await tx.query(
          "SELECT 1 FROM search.content_index WHERE index_id=$1 AND state IN ('candidate','ready') FOR UPDATE",
          [derived.indexId],
        );
        if (!existing.rowCount) throw Error("Derivation candidate must exist before embedding.");
        await tx.query(
          "INSERT INTO search.embedding_configuration(configuration_id,provider,model,dimensions,normalization,policy_version) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(configuration_id) DO NOTHING",
          [
            configId,
            config.provider,
            config.model,
            config.dimensions,
            config.normalization,
            config.policyVersion,
          ],
        );
        let count = 0;
        for (const [i, c] of derived.chunks.entries()) {
          const vector = "[" + vectors[i]!.map((x) => Math.fround(x)).join(",") + "]";
          const result = await tx.query(
            "INSERT INTO search.chunk_embedding(chunk_id,configuration_id,vector,text_checksum,created_at) VALUES($1,$2,$3::public.vector,$4,$5) ON CONFLICT(chunk_id,configuration_id) DO NOTHING",
            [c.chunkId, configId, vector, c.textChecksum, this.now()],
          );
          count += result.rowCount ?? 0;
        }
        await this.expectation(tx, job.eventId, "ready");
        return { embeddings: count };
      },
    );
  }
  async quarantine(
    job: IndexJob,
    d: ContentDescriptor,
    reason: Parameters<IndexStore["quarantine"]>[2],
  ): Promise<void> {
    await this.effects.apply(
      job as ClaimedOutboxEvent,
      this.relayId,
      "content.quarantine.v1",
      this.now(),
      async (tx) => {
        await tx.query("SELECT content.lock_index_source($1)", [d.contentVersionId]);
        const available = await tx.query(
          "SELECT 1 FROM content.content_version WHERE content_version_id=$1 AND checksum=$2 AND status='published' AND payload_status='available' AND (rights_expires_at IS NULL OR rights_expires_at>$3)",
          [d.contentVersionId, d.sourceChecksum, this.now()],
        );
        if (!available.rowCount) {
          await this.expectation(tx, job.eventId, "obsolete");
          return { obsolete: 1 };
        }
        await tx.query(
          "INSERT INTO search.index_failure(event_id,content_version_id,source_checksum,policy_version,reason,recorded_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(event_id) DO NOTHING",
          [job.eventId, d.contentVersionId, d.sourceChecksum, d.policyVersion, reason, this.now()],
        );
        await tx.query(
          "UPDATE search.content_index SET state='quarantined' WHERE content_version_id=$1 AND policy_version=$2 AND state='candidate'",
          [
            d.contentVersionId,
            reason === "invalid_embedding" ? CHUNK_POLICY_VERSION : d.policyVersion,
          ],
        );
        await this.expectation(tx, job.eventId, "quarantined");
        return { quarantined: 1 };
      },
    );
  }
}

/** Called inside the existing governed publication transaction; no derivation runs here. */
export async function enqueuePublishedContentDerivation(
  tx: Transaction,
  input: { contentVersionId: string; sourceChecksum: string; now: string },
): Promise<string | null> {
  const eligible = await tx.query(
    "SELECT 1 FROM content.content_version WHERE content_version_id=$1 AND checksum=$2 AND provenance_kind='original' AND status='published' AND payload_status='available' AND (rights_expires_at IS NULL OR rights_expires_at>$3)",
    [input.contentVersionId, input.sourceChecksum, input.now],
  );
  if (!eligible.rowCount) return null;
  const topic = "content.derivation.requested";
  const eventId = identity("evt_", [
    topic,
    input.contentVersionId,
    CHUNK_POLICY_VERSION,
    input.sourceChecksum,
  ]);
  const descriptor = {
    schemaVersion: 1,
    contentVersionId: input.contentVersionId,
    sourceChecksum: input.sourceChecksum,
    policyVersion: CHUNK_POLICY_VERSION,
  };
  await tx.query(
    "INSERT INTO platform.outbox_event(event_id,topic,aggregate_id,payload,occurred_at,available_at) VALUES($1,$2,$3,$4::jsonb,$5,$5) ON CONFLICT(event_id) DO NOTHING",
    [eventId, topic, input.contentVersionId, JSON.stringify(descriptor), input.now],
  );
  await tx.query(
    "INSERT INTO platform.worker_derivation_expectation(content_version_id,policy_version,source_checksum,topic,event_id,registered_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(content_version_id,policy_version,topic) DO NOTHING",
    [input.contentVersionId, CHUNK_POLICY_VERSION, input.sourceChecksum, topic, eventId, input.now],
  );
  return eventId;
}
