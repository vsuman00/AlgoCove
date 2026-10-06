import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { canonicalJson, verifyEvidence } from "@algocove/retrieval";
import { checksum } from "@algocove/content";
import { pilotCorpus, pilotVector } from "../retrieval-eval/pilot-corpus.ts";
import { createRetrievalFixture } from "./support/retrieval-fixture.ts";
let fixture: Awaited<ReturnType<typeof createRetrievalFixture>>;
let runtime: typeof fixture.runtime,
  repo: typeof fixture.repo,
  config: typeof fixture.config,
  current: typeof fixture.current,
  corpus: typeof fixture.corpus,
  ids: typeof fixture.ids,
  context: typeof fixture.context,
  input: typeof fixture.input,
  embedding: typeof fixture.embedding,
  learner: typeof fixture.learner,
  other: typeof fixture.other,
  attempt: typeof fixture.attempt,
  now: typeof fixture.now,
  blocked: typeof fixture.blocked,
  pool: typeof fixture.pool,
  migrationUrl: typeof fixture.migrationUrl,
  modelId: typeof fixture.modelId,
  model: typeof fixture.model,
  retrieve: typeof fixture.retrieve;
let entropy = 900000;
describe("Task 43 permission-first hybrid retrieval", () => {
  beforeAll(async () => {
    fixture = await createRetrievalFixture();
    ({
      runtime,
      repo,
      config,
      current,
      corpus,
      ids,
      context,
      input,
      embedding,
      learner,
      other,
      attempt,
      now,
      blocked,
      pool,
      migrationUrl,
      modelId,
      model,
      retrieve,
    } = fixture);
  });
  afterAll(async () => {
    await fixture?.close();
  });
  it("filters forbidden content before scoring and packaging, with no unexposed or foreign hints", async () => {
    const result = await retrieve(input());
    expect(verifyEvidence(result)).toBe(true);
    expect(result.scope.maximumHintTier).toBe(0);
    expect(result.candidates.length).toBeGreaterThan(5);
    for (const row of [...result.lexical, ...result.dense, ...result.candidates])
      expect(blocked).not.toContain(row.chunkId);
    for (const row of result.selected) expect(row.candidate.hintTier).toBe(0);
    expect(result.candidates.map((r) => r.chunkId)).not.toContain(current.chunks[1]!.chunkId);
  });
  it("rejects forged scopes, wrong owners, incompatible curricula, and missing active grants", async () => {
    await expect(
      repo.retrieve(context(other), input(), embedding("container")),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      repo.retrieve(context(learner, ["operator"]), input(), embedding("container")),
    ).rejects.toMatchObject({ category: "authorization" });
    await expect(
      retrieve(input("container", { curriculumVersionId: "cur_bbbbbbbbbbbbbbbb" })),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      repo.retrieve(context(), { ...input(), maximumHintTier: 6 }, embedding("container")),
    ).rejects.toMatchObject({ category: "validation" });
    await runtime.query(
      "UPDATE platform.role_grant SET revoked_at=clock_timestamp() WHERE learner_id=$1 AND role='learner'",
      [learner],
    );
    try {
      await expect(retrieve(input())).rejects.toMatchObject({ category: "authorization" });
    } finally {
      await runtime.query(
        "UPDATE platform.role_grant SET revoked_at=NULL WHERE learner_id=$1 AND role='learner'",
        [learner],
      );
    }
  });
  it("persists a checksum-stable immutable receipt, reproduces RRF, and serializes idempotent retries", async () => {
    const raw = input("shorter boundary invariant");
    const [a, b] = await Promise.all([retrieve(raw), retrieve(raw)]);
    expect(b).toEqual(a);
    expect(await repo.read(context(), a.packageId)).toEqual(a);
    const reproduced = await retrieve({ ...raw, idempotencyKey: `reproduce:${entropy++}` });
    expect(reproduced.lexical).toEqual(a.lexical);
    expect(reproduced.dense).toEqual(a.dense);
    expect(reproduced.candidates).toEqual(a.candidates);
    expect(reproduced.selected).toEqual(a.selected);
    const rows = (
      await runtime.query("SELECT body FROM tutor.evidence_package WHERE package_id=$1", [
        a.packageId,
      ])
    ).rows[0].body;
    expect(verifyEvidence(rows)).toBe(true);
    for (const r of a.candidates) {
      const expected =
        (r.lexicalRank ? 1 / (60 + r.lexicalRank) : 0) + (r.denseRank ? 1 / (60 + r.denseRank) : 0);
      expect(r.fusedScore).toBe(expected);
    }
    const chunks = (
      await runtime.query(
        "SELECT chunk_id FROM search.content_chunk WHERE index_id=ANY($1::text[])",
        [config.indexIds],
      )
    ).rows;
    expect(chunks.length).toBeGreaterThan(a.candidates.length);
    await expect(repo.read(context(other), a.packageId)).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(retrieve({ ...raw, query: "changed request" })).rejects.toMatchObject({
      category: "conflict",
    });
    await expect(
      runtime.query("UPDATE tutor.evidence_package SET body=body WHERE package_id=$1", [
        a.packageId,
      ]),
    ).rejects.toMatchObject({ code: "55006" });
    await expect(
      runtime.query("DELETE FROM tutor.evidence_package WHERE package_id=$1", [a.packageId]),
    ).rejects.toMatchObject({ code: "55006" });
    await expect(
      runtime.query(
        "UPDATE search.retrieval_configuration SET body=jsonb_set(body,'{topK}','4') WHERE configuration_version=$1",
        [config.version],
      ),
    ).rejects.toMatchObject({ code: "55006" });
  });
  it("fails closed for disabled configuration/model and invalid vectors without persisting a package", async () => {
    const count = async () =>
      Number((await runtime.query("SELECT count(*) FROM tutor.evidence_package")).rows[0].count);
    const before = await count();
    for (const table of ["retrieval_configuration", "embedding_configuration"]) {
      const column =
          table === "retrieval_configuration" ? "configuration_version" : "configuration_id",
        id = table === "retrieval_configuration" ? config.version : modelId;
      await runtime.query(`UPDATE search.${table} SET enabled=false WHERE ${column}=$1`, [id]);
      try {
        await expect(retrieve(input())).rejects.toMatchObject({ code: "dependency_unavailable" });
      } finally {
        await runtime.query(`UPDATE search.${table} SET enabled=true WHERE ${column}=$1`, [id]);
      }
    }
    await expect(
      repo.retrieve(context(), input(), { configurationId: modelId, vector: [1, NaN] }),
    ).rejects.toMatchObject({ category: "validation" });
    await expect(
      repo.retrieve(context(), input(), {
        configurationId: "emb_" + "f".repeat(40),
        vector: pilotVector("area"),
      }),
    ).rejects.toMatchObject({ category: "validation" });
    expect(await count()).toBe(before);
  });
  it("rolls back a persistence failure and permits an empty corpus to abstain", async () => {
    const empty = {
      ...config,
      version: "retrieval.empty.v1",
      indexIds: [corpus.get("candidate")!.indexId],
    };
    await runtime.query(
      "INSERT INTO search.retrieval_configuration(configuration_version,embedding_configuration_id,body,enabled) VALUES($1,$2,$3,true)",
      [empty.version, modelId, JSON.stringify(empty)],
    );
    const abstention = await retrieve(input("container", { configurationVersion: empty.version }));
    expect(abstention.selected).toEqual([]);
    expect(abstention.lowConfidence).toBe(true);
    const before = (await runtime.query("SELECT count(*) FROM tutor.evidence_package")).rows[0]
      .count;
    const setup = pool(migrationUrl);
    await setup.query(
      "CREATE FUNCTION tutor.fail_fixture_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture persistence failure' USING ERRCODE='23514'; END $$",
    );
    await setup.query(
      "CREATE TRIGGER fail_fixture_insert BEFORE INSERT ON tutor.evidence_package FOR EACH ROW EXECUTE FUNCTION tutor.fail_fixture_insert()",
    );
    try {
      await expect(retrieve(input())).rejects.toMatchObject({ code: "23514" });
      expect(
        (await runtime.query("SELECT count(*) FROM tutor.evidence_package")).rows[0].count,
      ).toBe(before);
    } finally {
      await setup.query("DROP TRIGGER fail_fixture_insert ON tutor.evidence_package");
      await setup.query("DROP FUNCTION tutor.fail_fixture_insert()");
      await setup.end();
    }
  });
  it("enforces the configured overall deadline without partial evidence", async () => {
    const bounded = { ...config, version: "retrieval.deadline.v1", timeoutMs: 1 };
    await runtime.query(
      "INSERT INTO search.retrieval_configuration(configuration_version,embedding_configuration_id,body,enabled) VALUES($1,$2,$3,true)",
      [bounded.version, modelId, JSON.stringify(bounded)],
    );
    const before = (await runtime.query("SELECT count(*) FROM tutor.evidence_package")).rows[0]
      .count;
    await expect(
      retrieve(input("container", { configurationVersion: bounded.version })),
    ).rejects.toMatchObject({ category: "dependency_unavailable" });
    expect((await runtime.query("SELECT count(*) FROM tutor.evidence_package")).rows[0].count).toBe(
      before,
    );
  });
  it("honors recorded exposure and denies solution review until submission", async () => {
    await runtime.query(
      "INSERT INTO practice.hint_exposure(exposure_id,learner_id,attempt_id,problem_version_id,hint_id,tier,idempotency_key,exposed_at) VALUES($1,$2,$3,$4,'pilot-hint-6',6,'pilot-exposure',$5)",
      [ids.generate("event"), learner, attempt, current.problemVersionId, now],
    );
    const active = await retrieve(input("container hint"));
    expect(active.scope.maximumHintTier).toBe(5);
    expect(active.candidates.map((r) => r.chunkId)).not.toContain(current.chunks[6]!.chunkId);
    await runtime.query(
      "UPDATE practice.attempt SET status='submitted',terminal_reason='submitted',ended_at=$2 WHERE attempt_id=$1",
      [attempt, now],
    );
    const submitted = await retrieve(input("container hint"));
    expect(submitted.scope.maximumHintTier).toBe(6);
    expect(submitted.candidates.map((r) => r.chunkId)).toContain(current.chunks[6]!.chunkId);
  });
  it("records a labeled pilot recall and latency baseline against actual PostgreSQL queries", async () => {
    const labels = pilotCorpus.filter((e) => "query" in e);
    const durations: number[] = [];
    let hits = 0,
      rr = 0;
    const cases: unknown[] = [];
    let benchmarkScope: unknown;
    for (let warm = 0; warm < 3; warm++) await retrieve(input("container area"));
    for (let repeat = 0; repeat < 5; repeat++)
      for (const label of labels) {
        if (!("query" in label)) continue;
        const start = performance.now();
        const result = await retrieve(input(label.query));
        durations.push(performance.now() - start);
        benchmarkScope = result.scope;
        const expected = corpus.get(label.key)!.chunks[0]!.chunkId;
        const rank = result.selected.findIndex((e) => e.evidenceItemId === expected) + 1;
        if (rank) {
          hits++;
          rr += 1 / rank;
        }
        if (repeat === 0)
          cases.push({
            label: label.key,
            query: label.query,
            expectedChunkId: expected,
            selectedChunkIds: result.selected.map((e) => e.evidenceItemId),
            rank: rank || null,
          });
      }
    durations.sort((a, b) => a - b);
    const percentile = (p: number) =>
      durations[Math.min(durations.length - 1, Math.ceil(p * durations.length) - 1)]!;
    const report = {
      schemaVersion: 1,
      kind: "local-synthetic-pilot",
      productionPromotion: false,
      generatedAt: new Date().toISOString(),
      postgres: (await runtime.query("SELECT version() AS version")).rows[0].version,
      pgvector: (await runtime.query("SELECT extversion FROM pg_extension WHERE extname='vector'"))
        .rows[0].extversion,
      corpusVersion: config.corpusVersion,
      scope: benchmarkScope,
      corpusIndexCount: config.indexIds.length,
      blockedChunkCount: blocked.length,
      corpusSnapshots: [current, ...corpus.values()].map((d) => ({
        indexId: d.indexId,
        contentVersionId: d.contentVersionId,
        problemVersionId: d.problemVersionId,
        sourceChecksum: d.sourceChecksum,
        normalizedChecksum: d.normalizedChecksum,
        chunks: d.chunks.map((c) => ({
          chunkId: c.chunkId,
          textChecksum: c.textChecksum,
          kind: c.kind,
          tier: c.hintTier,
        })),
      })),
      corpusChecksum: checksum(
        canonicalJson(
          [current, ...corpus.values()].map((d) => ({
            indexId: d.indexId,
            normalizedChecksum: d.normalizedChecksum,
          })),
        ),
      ),
      configuration: config,
      configurationChecksum: checksum(canonicalJson(config)),
      embedding: model,
      approvedIndices: "Disposable test database only; no deployed promotion",
      labels: labels.length,
      warmups: 3,
      samples: durations.length,
      recallAt3: hits / durations.length,
      mrrAt3: rr / durations.length,
      p50Ms: percentile(0.5),
      p95Ms: percentile(0.95),
      maximumMs: durations.at(-1),
      latencyScope:
        "Full authorization, lexical+dense queries, current-source recheck, immutable persistence and commit",
      cases,
      limitations: [
        "Original small two-pointer corpus; hand-authored term vectors, not a live semantic embedding model",
        "Warm loopback PostgreSQL; excludes external provider network and production load",
        "A local regression baseline, not Task45 human quality approval or index promotion",
      ],
    };
    console.log(
      "Task43 pilot baseline",
      JSON.stringify({
        recallAt3: report.recallAt3,
        mrrAt3: report.mrrAt3,
        p50Ms: report.p50Ms,
        p95Ms: report.p95Ms,
        samples: report.samples,
      }),
    );
    if (process.env.ALGOCOVE_RETRIEVAL_REPORT_PATH)
      writeFileSync(
        process.env.ALGOCOVE_RETRIEVAL_REPORT_PATH,
        JSON.stringify(report, null, 2) + "\n",
      );
    expect(report.recallAt3).toBe(1);
    expect(report.p95Ms).toBeLessThan(2000);
  });
  it("denies stored receipts after an unselected candidate is retired", async () => {
    const raw = input("container area"),
      result = await retrieve(raw);
    const excluded = result.candidates.find(
      (c) =>
        !result.selected.some((s) => s.evidenceItemId === c.chunkId) &&
        c.contentVersionId !== current.contentVersionId,
    )!;
    expect(excluded).toBeDefined();
    await runtime.query(
      "UPDATE content.content_version SET status='retired',retired_at=$2,retirement_reason='rights_withdrawn',payload_status='tombstoned' WHERE content_version_id=$1",
      [excluded.contentVersionId, now],
    );
    await expect(repo.read(context(), result.packageId)).rejects.toMatchObject({
      category: "conflict",
    });
    await expect(retrieve(raw)).rejects.toMatchObject({ category: "conflict" });
  });
});
