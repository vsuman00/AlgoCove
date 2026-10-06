import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createActor, createRequestContext, type IdGenerator } from "@algocove/application";
import { formatId, parseInstant } from "@algocove/domain";
import {
  createPool,
  bootstrapDatabase,
  migrate,
  PostgresContentIndexRepository,
  PostgresRetrievalRepository,
} from "@algocove/db";
import { CHUNK_POLICY_VERSION, checksum, deriveChunks, type Derivation } from "@algocove/content";
import {
  embeddingConfigurationId,
  type RetrievalConfiguration,
  type RetrievalInput,
} from "@algocove/retrieval";
import { pilotCorpus, pilotVector } from "../../retrieval-eval/pilot-corpus.ts";

export async function createRetrievalFixture() {
  const suffix = `${process.pid}_${Date.now()}`,
    database = `algocove_retrieval_${suffix}`;
  const operator = new URL(
    process.env.DATABASE_TEST_OPERATOR_URL ??
      process.env.DATABASE_ADMIN_URL ??
      "postgres://postgres:postgres@127.0.0.1:54329/postgres",
  );
  operator.pathname = "/postgres";
  const target = new URL(operator);
  target.pathname = `/${database}`;
  const migrationRole = `retrieval_mig_${suffix}`,
    runtimeRole = `retrieval_run_${suffix}`;
  const migrationUrl = new URL(target),
    runtimeUrl = new URL(target);
  migrationUrl.username = migrationRole;
  migrationUrl.password = randomUUID();
  runtimeUrl.username = runtimeRole;
  runtimeUrl.password = randomUUID();
  const pool = (u: URL) =>
    createPool({
      connectionString: u.toString(),
      applicationName: "retrieval-test",
      maxConnections: 4,
      statementTimeoutMs: 5000,
    });
  const admin = pool(operator),
    runtime = pool(runtimeUrl),
    repo = new PostgresRetrievalRepository(runtime);
  const instant = parseInstant("2026-10-06T00:00:00.000Z");
  if (!instant.ok) throw Error();
  const now = instant.value;
  let entropy = 70000;
  const ids: IdGenerator = {
    generate(kind) {
      const id = formatId(kind, String(entropy++).padStart(16, "0"));
      if (!id.ok) throw Error();
      return id.value;
    },
  };
  const learner = "usr_0000000000000001",
    other = "usr_0000000000000002";
  const context = (userId = learner, roles: ("learner" | "operator")[] = ["learner"]) =>
    createRequestContext({
      actor: createActor({ userId, sessionId: "ses_0000000000000001", roles }),
      clock: { now: () => now },
      ids,
      serviceName: "retrieval-test",
    });
  const model = {
    provider: "retrieval-pilot-test",
    model: "original-term-basis.v1",
    dimensions: 8,
    normalization: "unit" as const,
    policyVersion: "embedding.pilot.v1",
  };
  const modelId = embeddingConfigurationId(model);
  const corpus = new Map<string, Derivation>();
  const blocked: string[] = [];
  function input(
    query = "container area",
    overrides: Partial<RetrievalInput> = {},
  ): RetrievalInput {
    return {
      attemptId: attempt,
      curriculumVersionId: "cur_aaaaaaaaaaaaaaaa",
      configurationVersion: config.version,
      intent: "explain",
      query,
      idempotencyKey: `retrieve:${entropy++}`,
      ...overrides,
    };
  }
  const embedding = (text: string) => ({ configurationId: modelId, vector: pilotVector(text) });
  async function source(text: string, hints = false, draft = false): Promise<Derivation> {
    const con = ids.generate("content"),
      pro = ids.generate("problem"),
      cnt = ids.generate("contentVersion"),
      prb = ids.generate("problemVersion");
    await runtime.query(
      "INSERT INTO content.content_item(content_id,content_kind) VALUES($1,'problem')",
      [con],
    );
    await runtime.query("INSERT INTO content.problem(problem_id,content_id) VALUES($1,$2)", [
      pro,
      con,
    ]);
    await runtime.query(
      "INSERT INTO content.content_version(content_version_id,content_id,title,checksum,provenance_kind,rights_holder,license,author_id,status,payload_status) VALUES($1,$2,'Original retrieval pilot',$3,'original','AlgoCove','test',$4,'draft','available')",
      [cnt, con, checksum(text), learner],
    );
    await runtime.query(
      "INSERT INTO content.problem_version(problem_version_id,problem_id,content_version_id,statement) VALUES($1,$2,$3,$4)",
      [prb, pro, cnt, text],
    );
    await runtime.query(
      "INSERT INTO learning.problem_concept(problem_version_id,concept_id,rationale,mapped_by) SELECT $1,concept_id,rationale,mapped_by FROM learning.problem_concept WHERE problem_version_id='prb_dddddddddddddddd'",
      [prb],
    );
    await runtime.query(
      "INSERT INTO content.problem_language_manifest(manifest_id,problem_version_id,language,starter_template,entry_signature,adapter_id,limits_profile,status) SELECT $1,$2,language,starter_template,entry_signature,adapter_id,limits_profile,'published' FROM content.problem_language_manifest WHERE problem_version_id='prb_dddddddddddddddd' AND language='python'",
      [ids.generate("languageManifest"), prb],
    );
    if (hints)
      for (let tier = 1; tier <= 6; tier++)
        await runtime.query(
          "INSERT INTO content.problem_hint(problem_version_id,hint_id,tier,kind,body) VALUES($1,$2,$3,$4,$5)",
          [
            prb,
            `pilot-hint-${tier}`,
            tier,
            [
              "clarification",
              "example",
              "invariant",
              "pseudocode_scaffold",
              "partial_structure",
              "solution_review",
            ][tier - 1],
            `Container hint tier ${tier}: ${tier === 6 ? "full solution review" : "guided pointer reasoning"}.`,
          ],
        );
    if (!draft)
      await runtime.query(
        "UPDATE content.content_version SET status='published',published_at=$2 WHERE content_version_id=$1",
        [cnt, now],
      );
    const loaded = await new PostgresContentIndexRepository(runtime, "pilot-test", () => now).load({
      contentVersionId: cnt,
      sourceChecksum: checksum(text),
      policyVersion: CHUNK_POLICY_VERSION,
    });
    return deriveChunks(
      draft ? { ...loaded!, status: "published", publishedAt: now } : loaded!,
      CHUNK_POLICY_VERSION,
      now,
    );
  }
  async function index(
    d: Derivation,
    options: {
      state?: string;
      languages?: string[];
      curricula?: string[];
      concepts?: string[];
      expiry?: string;
    } = {},
  ): Promise<void> {
    await runtime.query(
      "INSERT INTO search.content_index(index_id,content_version_id,problem_version_id,policy_version,source_checksum,normalized_checksum,scan_version,concept_ids,curriculum_version_ids,languages,valid_from,valid_until,created_at,state,evaluation_reference) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$11,$13,$14)",
      [
        d.indexId,
        d.contentVersionId,
        d.problemVersionId,
        d.policyVersion,
        d.sourceChecksum,
        d.normalizedChecksum,
        d.scanVersion,
        options.concepts ?? d.concepts,
        options.curricula ?? d.curricula,
        options.languages ?? d.languages,
        now,
        options.expiry ?? d.validUntil,
        options.state ?? "ready",
        options.state === "candidate" ? null : "DISPOSABLE-FIXTURE-ONLY",
      ],
    );
    for (const c of d.chunks) {
      await runtime.query(
        "INSERT INTO search.content_chunk(chunk_id,index_id,kind,ordinal,source_object_id,text,text_checksum,hint_tier,language,target_level,visibility,scan_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
        [
          c.chunkId,
          d.indexId,
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
      await runtime.query(
        "INSERT INTO search.chunk_embedding(chunk_id,configuration_id,vector,text_checksum,created_at) VALUES($1,$2,$3::public.vector,$4,$5)",
        [c.chunkId, modelId, `[${pilotVector(c.text).join(",")}]`, c.textChecksum, now],
      );
    }
  }
  async function retrieve(raw: RetrievalInput) {
    return repo.retrieve(context(), raw, embedding(raw.query));
  }

  admin.on("error", () => undefined);
  runtime.on("error", () => undefined);
  await admin.query(`CREATE DATABASE "${database}"`);
  await bootstrapDatabase({
    operatorConnectionString: target.toString(),
    migrationRole: { name: migrationRole, password: migrationUrl.password },
    runtimeRole: { name: runtimeRole, password: runtimeUrl.password },
    logger: { info: () => undefined },
  });
  await migrate({ connectionString: migrationUrl.toString(), logger: { info: () => undefined } });
  execFileSync(process.execPath, ["packages/db/src/cli/seed-practice.ts"], {
    env: { ...process.env, DATABASE_ADMIN_URL: target.toString() },
    stdio: "pipe",
  });
  await runtime.query("INSERT INTO platform.learner(learner_id) VALUES($1),($2)", [learner, other]);
  await runtime.query(
    "INSERT INTO platform.role_grant(learner_id,role) VALUES($1,'learner'),($2,'learner')",
    [learner, other],
  );
  await runtime.query(
    "INSERT INTO search.embedding_configuration(configuration_id,provider,model,dimensions,normalization,policy_version,enabled) VALUES($1,$2,$3,$4,$5,$6,true)",
    [modelId, model.provider, model.model, 8, model.normalization, model.policyVersion],
  );
  const current = await source(
    "Find the largest container area using two pointers without mutating the heights array.",
    true,
  );
  await index(current);
  for (const entry of pilotCorpus) {
    const d = await source(entry.text);
    await index(d);
    corpus.set(entry.key, d);
  }
  for (const [key, options] of Object.entries({
    candidate: { state: "candidate" },
    quarantine: { state: "quarantined" },
    language: { languages: ["java"] },
    curriculum: { curricula: ["cur_bbbbbbbbbbbbbbbb"] },
    concept: { concepts: ["cpt_bbbbbbbbbbbbbbbb"] },
    expired: { expiry: new Date(Date.now() - 60000).toISOString() },
    retired: {},
    draft: {},
    tombstone: {},
    foreignHints: {},
  })) {
    const d = await source(
      `Forbidden ${key} container area pointer evidence.`,
      key === "foreignHints",
      key === "draft",
    );
    await index(d, options);
    corpus.set(key, d);
    if (key === "retired")
      await runtime.query(
        "UPDATE content.content_version SET status='retired',retired_at=$2,retirement_reason='rights_withdrawn',payload_status='tombstoned' WHERE content_version_id=$1",
        [d.contentVersionId, now],
      );
    if (key === "tombstone")
      await runtime.query(
        "UPDATE content.content_version SET status='retired',retired_at=$2,retirement_reason='rights_withdrawn',payload_status='tombstoned' WHERE content_version_id=$1",
        [d.contentVersionId, now],
      );
    blocked.push(
      ...d.chunks
        .filter((c) => key !== "foreignHints" || c.kind === "hint_tier")
        .map((c) => c.chunkId),
    );
  }
  const session = ids.generate("session");
  const attempt = ids.generate("attempt");
  await runtime.query(
    "INSERT INTO practice.learning_session(session_id,learner_id,mode,status,started_at,updated_at) VALUES($1,$2,'practice','active',$3,$3)",
    [session, learner, now],
  );
  const manifest = (
    await runtime.query(
      "SELECT manifest_id FROM content.problem_language_manifest WHERE problem_version_id=$1 AND language='python'",
      [current.problemVersionId],
    )
  ).rows[0].manifest_id;
  await runtime.query(
    "INSERT INTO practice.attempt(attempt_id,session_id,learner_id,problem_version_id,manifest_id,language,mode,status,started_at,updated_at) VALUES($1,$2,$3,$4,$5,'python','practice','active',$6,$6)",
    [attempt, session, learner, current.problemVersionId, manifest, now],
  );
  const config: RetrievalConfiguration = {
    schemaVersion: 1,
    version: "retrieval.pilot.v1",
    corpusVersion: "original.two-pointer.pilot.v1",
    indexIds: [current.indexId, ...[...corpus.values()].map((d) => d.indexId)].sort(),
    embeddingConfigurationId: modelId,
    chunkPolicyVersion: CHUNK_POLICY_VERSION,
    lexicalPolicy: "english.plainto.cover-density.32.v1",
    densePolicy: "exact.cosine.v1",
    fusionPolicy: "rrf.equal.exact-duplicate.v1",
    rrfK: 60,
    candidateLimit: 50,
    topK: 3,
    maximumTextCharacters: 80000,
    timeoutMs: 2000,
  };
  await runtime.query(
    "INSERT INTO search.retrieval_configuration(configuration_version,embedding_configuration_id,body,enabled) VALUES($1,$2,$3,true)",
    [config.version, modelId, JSON.stringify(config)],
  );

  async function close() {
    await runtime.end();
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH(FORCE)`);
    await admin.query(`DROP ROLE IF EXISTS "${migrationRole}"`);
    await admin.query(`DROP ROLE IF EXISTS "${runtimeRole}"`);
    await admin.end();
  }
  return {
    runtime,
    repo,
    now,
    context,
    input,
    embedding,
    learner,
    other,
    attempt,
    current,
    config,
    corpus,
    blocked,
    ids,
    pool,
    migrationUrl,
    modelId,
    model,
    retrieve,
    close,
  };
}
