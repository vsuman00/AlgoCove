import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PostgresEvaluationRepository } from "@algocove/db";
import { createActor, createRequestContext } from "@algocove/application";
import type { Role } from "@algocove/domain";
import { createRetrievalFixture } from "./support/retrieval-fixture.ts";
import { evaluateRanking } from "@algocove/retrieval";
import { pilotCorpus } from "../retrieval-eval/pilot-corpus.ts";
import { suite, run, config, reviews } from "../retrieval-eval/evaluation-fixture.ts";
let f: Awaited<ReturnType<typeof createRetrievalFixture>>, repo: PostgresEvaluationRepository;
function ctx(userId: string, roles: Role[]) {
  const base = f.context();
  return createRequestContext({
    actor: createActor({ userId, sessionId: base.actor.sessionId, roles }),
    clock: { now: () => base.now },
    ids: f.ids,
    serviceName: "promotion-fixture",
  });
}
const operator = () => ctx(f.learner, ["operator"]),
  evaluator = () => ctx(f.learner, ["evaluator"]),
  reviewer = () => ctx(f.other, ["evaluator"]);
async function reviewed(measured = run) {
  const id = await repo.recordRun(evaluator(), measured);
  await repo.review(reviewer(), id, reviews[0]!, "fixture.reviewed");
  return id;
}
describe("Task45 durable fixture promotion and rollback", () => {
  beforeAll(async () => {
    f = await createRetrievalFixture();
    repo = new PostgresEvaluationRepository(f.runtime);
    await f.runtime.query(
      "INSERT INTO platform.role_grant(learner_id,role) VALUES($1,'operator'),($1,'evaluator'),($2,'evaluator')",
      [f.learner, f.other],
    );
    await repo.declareSuite(evaluator(), suite);
    await repo.registerConfiguration(operator(), config);
  });
  afterAll(async () => await f?.close());
  it("starts both channels authored/off and does not activate fixture providers", async () => {
    expect((await repo.active(operator(), "fixture")).version).toBe("authored.off.v1");
    expect((await repo.active(operator(), "production")).version).toBe("authored.off.v1");
  });
  it("scores the real permission-filtered PostgreSQL pipeline against original fixture labels", async () => {
    for (const item of pilotCorpus) {
      if (!("query" in item)) continue;
      const evidence = await f.retrieve(f.input(item.query!));
      const relevant = f.corpus.get(item.key)!.chunks[0]!.chunkId;
      const metrics = evaluateRanking(
        evidence.selected.map((r) => r.candidate.chunkId),
        [relevant],
        f.blocked,
        3,
      );
      expect(metrics).toMatchObject({ recall: 1, reciprocalRank: 1, ndcg: 1, forbiddenCount: 0 });
    }
  });
  it("rejects missing suite, private payload and wrong result membership", async () => {
    await expect(
      repo.recordRun(evaluator(), { ...run, suiteVersion: "undeclared" }),
    ).rejects.toThrow();
    await expect(repo.recordRun(evaluator(), { ...run, privateCode: "CANARY" })).rejects.toThrow();
    await expect(
      repo.recordRun(evaluator(), { ...run, measurements: run.measurements.slice(1) }),
    ).rejects.toThrow();
  });
  it("requires independent human review and records rejection without changing active config", async () => {
    const id = await repo.recordRun(evaluator(), run);
    await expect(repo.review(evaluator(), id, reviews[0]!, "self.review")).rejects.toThrow();
    const decision = await repo.promote(operator(), {
      channel: "fixture",
      runId: id,
      expectedActive: "authored.off.v1",
      rollbackVersion: "authored.off.v1",
    });
    expect(decision).toMatchObject({ accepted: false, reasons: ["human_review"] });
    expect(
      (
        await f.runtime.query(
          "SELECT accepted FROM tutor.configuration_decision WHERE decision_id=$1",
          [decision.decisionId],
        )
      ).rows[0].accepted,
    ).toBe(false);
  });
  it("blocks a single critical privacy regression and a fixture on production", async () => {
    const changed = structuredClone(run);
    changed.measurements[2]!.privacyViolations = 1;
    const id = await reviewed(changed);
    expect(
      (
        await repo.promote(operator(), {
          channel: "fixture",
          runId: id,
          expectedActive: "authored.off.v1",
          rollbackVersion: "authored.off.v1",
        })
      ).reasons,
    ).toContain("critical_policy_privacy");
    const good = await reviewed();
    expect(
      (
        await repo.promote(operator(), {
          channel: "production",
          runId: good,
          expectedActive: "authored.off.v1",
          rollbackVersion: "authored.off.v1",
        })
      ).reasons,
    ).toContain("fixture_configuration");
  });
  it("requires current rollback target, promotes complete reviewed fixture, and rolls back atomically", async () => {
    const id = await reviewed();
    await expect(
      repo.promote(operator(), {
        channel: "fixture",
        runId: id,
        expectedActive: "authored.off.v1",
        rollbackVersion: config.version,
      }),
    ).rejects.toThrow();
    const promoted = await repo.promote(operator(), {
      channel: "fixture",
      runId: id,
      expectedActive: "authored.off.v1",
      rollbackVersion: "authored.off.v1",
    });
    expect(promoted.accepted).toBe(true);
    expect((await repo.active(operator(), "fixture")).version).toBe(config.version);
    await expect(repo.rollback(operator(), "fixture", "evt_aaaaaaaaaaaaaaaa")).rejects.toThrow();
    const rolled = await repo.rollback(operator(), "fixture", promoted.decisionId);
    expect(rolled.accepted).toBe(true);
    expect((await repo.active(operator(), "fixture")).version).toBe("authored.off.v1");
    await expect(repo.rollback(operator(), "fixture", promoted.decisionId)).rejects.toThrow();
  });

  it("serializes concurrent promotions and rejects stale commands", async () => {
    const id = await reviewed();
    const input = {
      channel: "fixture" as const,
      runId: id,
      expectedActive: "authored.off.v1",
      rollbackVersion: "authored.off.v1",
    };
    const results = await Promise.allSettled([
      repo.promote(operator(), input),
      repo.promote(operator(), input),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    const result = results.find((r) => r.status === "fulfilled")!;
    if (result.status !== "fulfilled") throw Error("Missing promotion");
    await repo.rollback(operator(), "fixture", result.value.decisionId);
  });
  it("rolls back the decision insert if the active pointer cannot persist", async () => {
    const id = await reviewed(),
      migration = f.pool(f.migrationUrl);
    const count = (
      await f.runtime.query("SELECT count(*)::integer AS n FROM tutor.configuration_decision")
    ).rows[0].n;
    try {
      await migration.query(
        "CREATE FUNCTION tutor.fixture_fail_rollout() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture pointer failure'; END; $$",
      );
      await migration.query(
        "CREATE TRIGGER fixture_fail_rollout BEFORE UPDATE ON tutor.configuration_channel FOR EACH ROW EXECUTE FUNCTION tutor.fixture_fail_rollout()",
      );
      await expect(
        repo.promote(operator(), {
          channel: "fixture",
          runId: id,
          expectedActive: "authored.off.v1",
          rollbackVersion: "authored.off.v1",
        }),
      ).rejects.toThrow();
      expect((await repo.active(operator(), "fixture")).version).toBe("authored.off.v1");
      expect(
        (await f.runtime.query("SELECT count(*)::integer AS n FROM tutor.configuration_decision"))
          .rows[0].n,
      ).toBe(count);
    } finally {
      await migration.query(
        "DROP TRIGGER IF EXISTS fixture_fail_rollout ON tutor.configuration_channel",
      );
      await migration.query("DROP FUNCTION IF EXISTS tutor.fixture_fail_rollout()");
      await migration.end();
    }
  });
  it("rechecks current grants and rejects forged browser roles", async () => {
    await expect(repo.active(ctx(f.other, ["operator"]), "fixture")).rejects.toThrow();
    const id = await reviewed();
    await f.runtime.query(
      "UPDATE platform.role_grant SET revoked_at=clock_timestamp() WHERE learner_id=$1 AND role='evaluator'",
      [f.other],
    );
    expect(
      (
        await repo.promote(operator(), {
          channel: "fixture",
          runId: id,
          expectedActive: "authored.off.v1",
          rollbackVersion: "authored.off.v1",
        })
      ).reasons,
    ).toContain("human_review");
    await expect(repo.review(reviewer(), id, reviews[0]!, "fixture.reviewed")).rejects.toThrow();
  });
  it("database prevents mutation of evidence and pointer changes without accepted decision", async () => {
    await expect(
      f.runtime.query("UPDATE tutor.evaluation_suite SET body=body WHERE version=$1", [
        suite.version,
      ]),
    ).rejects.toThrow();
    await expect(f.runtime.query("DELETE FROM tutor.evaluation_run")).rejects.toThrow();
    await expect(
      f.runtime.query(
        "UPDATE tutor.configuration_channel SET active_version=$1 WHERE channel='fixture'",
        [config.version],
      ),
    ).rejects.toThrow();
    await expect(
      f.runtime.query(
        'UPDATE tutor.evaluation_configuration SET body=body || \'{"query":"private"}\'::jsonb WHERE version=$1',
        [config.version],
      ),
    ).rejects.toThrow();
  });
});
