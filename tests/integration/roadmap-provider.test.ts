import { writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from "vitest";
import {
  createActor,
  createRequestContext,
  saveOwnedRoadmapIntent,
  buildOwnedRoadmap,
  commandOwnedRoadmap,
} from "@algocove/application";
import {
  PostgresRoadmapIntentRepository,
  PostgresRoadmapRepository,
  PostgresEvaluationRepository,
  PostgresBudgetRepository,
} from "@algocove/db";
import type { Role } from "@algocove/domain";
import {
  type RoadmapGenerationPort,
  ROADMAP_PROMPT_VERSION,
  ROADMAP_POLICY_VERSION,
} from "@algocove/tutor";
import {
  createRoadmapOptional,
  roadmapBundleIdentity,
} from "../../apps/web/src/planning/proposal-runtime";
import { createRetrievalFixture } from "./support/retrieval-fixture.ts";
import { suite, run, config, reviews } from "../retrieval-eval/evaluation-fixture.ts";
let f: Awaited<ReturnType<typeof createRetrievalFixture>>,
  plans: PostgresRoadmapRepository,
  evaluation: PostgresEvaluationRepository,
  promotion: string;
const primary: RoadmapGenerationPort = {
  configuration: {
    version: "roadmap.fixture.v1",
    provider: "fixture",
    model: "original.schedule.v1",
    kind: "fixture",
    approvalReference: null,
    region: "local",
    dataPolicy: "synthetic-only",
    allowPrivateCode: false,
  },
  generate: vi.fn<RoadmapGenerationPort["generate"]>(async (r) => ({
    items: r.items.map((i) => ({ index: i.index, day: i.day })),
  })),
};
const fallback: RoadmapGenerationPort = {
  ...primary,
  configuration: { ...primary.configuration, version: "roadmap.fixture.fallback.v1" },
  generate: vi.fn<RoadmapGenerationPort["generate"]>(async (r) => ({
    items: r.items.map((i) => ({ index: i.index, day: i.day })),
  })),
};
const context = (userId: string, roles: Role[]) =>
  createRequestContext({
    actor: createActor({ userId, sessionId: f.context().actor.sessionId, roles }),
    clock: { now: () => f.now },
    ids: f.ids,
    serviceName: "roadmap-provider-fixture",
  });
const operator = () => context(f.learner, ["operator"]);
async function optional() {
  return createRoadmapOptional({
    pool: f.runtime,
    context: f.context(),
    repository: plans,
    primary,
    fallback,
    channel: "fixture",
  });
}
async function promote() {
  const source = await plans.source(f.context().actor.userId, f.now);
  const c = {
    ...config,
    version: "roadmap.fixture.bundle.v1",
    corpusVersion: source.catalog.curriculumVersionId ?? "synthetic.catalog.v1",
    generationVersion: roadmapBundleIdentity(primary, fallback),
    promptVersion: ROADMAP_PROMPT_VERSION,
    policyVersion: ROADMAP_POLICY_VERSION,
    retrievalVersion: "roadmap.catalog.v1",
    indexVersion: "roadmap.catalog.v1",
  };
  await evaluation.registerConfiguration(operator(), c);
  const id = await evaluation.recordRun(context(f.learner, ["evaluator"]), {
    ...run,
    configurationVersion: c.version,
  });
  await evaluation.review(context(f.other, ["evaluator"]), id, reviews[0]!, "synthetic.reviewed");
  const decision = await evaluation.promote(operator(), {
    channel: "fixture",
    runId: id,
    expectedActive: "authored.off.v1",
    rollbackVersion: "authored.off.v1",
  });
  expect(decision.accepted).toBe(true);
  promotion = decision.decisionId;
}
let serial = 1;
async function build(token: string | null = null) {
  return buildOwnedRoadmap(
    f.context(),
    plans,
    {
      scope: "reviewed_pilot",
      expectedToken: token,
      idempotencyKey: `gateway-fixture:${serial++}`,
      useProposal: true,
    },
    await optional(),
  );
}
describe("Task45a promoted roadmap gateway and durable budget", () => {
  beforeAll(async () => {
    f = await createRetrievalFixture();
    plans = new PostgresRoadmapRepository(f.runtime);
    evaluation = new PostgresEvaluationRepository(f.runtime);
    await f.runtime.query(
      "INSERT INTO platform.role_grant(learner_id,role) VALUES($1,'operator'),($1,'evaluator'),($2,'evaluator')",
      [f.learner, f.other],
    );
    await saveOwnedRoadmapIntent(f.context(), new PostgresRoadmapIntentRepository(f.runtime), {
      planId: null,
      expectedVersion: null,
      idempotencyKey: "gateway-preferences",
      preferences: {
        goal: "PRIVATE_GOAL_CANARY",
        targetRole: "PRIVATE_ROLE_CANARY",
        horizonMonths: 1,
        startDay: "2026-10-06",
        timezone: "UTC",
        dailyCapacityMinutes: 90,
        studyWeekdays: [1, 2, 3, 4, 5],
        preferredLanguages: ["python"],
        collectionIds: [],
      },
    });
    await evaluation.declareSuite(context(f.learner, ["evaluator"]), suite);
  });
  afterAll(async () => {
    if (f && process.env.ROADMAP_EVALUATION_REPORT_PATH) {
      const measurements = (
        await f.runtime.query(
          "SELECT body FROM tutor.roadmap_generation_evidence ORDER BY created_at,evidence_id",
        )
      ).rows.map((r) => r.body);
      const configurations = (
        await f.runtime.query(
          "SELECT body FROM tutor.evaluation_configuration WHERE version='roadmap.fixture.bundle.v1'",
        )
      ).rows.map((r) => r.body);
      const files = [
        "packages/tutor/src/plan-proposal-adapter.ts",
        "apps/web/src/planning/proposal-runtime.ts",
        "apps/web/src/planning/proposal-gateway.ts",
        "packages/db/src/roadmap-generation-repository.ts",
        "packages/application/src/roadmap-use-cases.ts",
        "packages/domain/src/budget.ts",
      ];
      const sourceVersion =
        "sha256:" +
        createHash("sha256")
          .update(files.map((file) => file + "\n" + readFileSync(file, "utf8")).join("\n"))
          .digest("hex");
      writeFileSync(
        process.env.ROADMAP_EVALUATION_REPORT_PATH,
        JSON.stringify(
          {
            schemaVersion: 1,
            scenarioSet: "roadmap.gateway.synthetic.v1",
            governanceFixtureSuite: suite.version,
            sourceVersion,
            environment: "synthetic-local",
            providerTransport: "injected original fixture; no live vendor",
            costUnit: "bounded prompt/candidate characters, not billed tokens or currency",
            configuration: configurations,
            measurements,
          },
          null,
          2,
        ) + "\n",
      );
    }
    await f?.close();
  });
  beforeEach(async () => {
    vi.clearAllMocks();
    await f.runtime.query(
      "DELETE FROM platform.optional_reservation WHERE operation='plan_proposal'",
    );
    await f.runtime.query("DELETE FROM platform.operation_breaker WHERE operation='plan_proposal'");
  });
  it("AI-off/default promotion never calls a provider", async () => {
    expect(await optional()).toBeUndefined();
    expect((await build()).lineage).toBe("baseline_ai_off");
    expect(primary.generate).not.toHaveBeenCalled();
  });
  it("connects the promoted fixture bundle and saves metadata before candidate delivery, requiring separate acceptance", async () => {
    await promote();
    expect(await evaluation.promotedConfiguration()).toBeNull();
    const candidate = await build();
    expect(candidate.status).toBe("valid");
    expect(candidate.lineage).toBe("gateway_validated:roadmap.fixture.bundle.v1");
    expect((await plans.view(f.context().actor.userId, f.now)).state).toBeNull();
    const metadata = (await f.runtime.query("SELECT body FROM tutor.roadmap_generation_evidence"))
      .rows;
    expect(metadata.length).toBeGreaterThan(0);
    expect(metadata.at(-1)?.body).toMatchObject({
      outcome: "validated",
      bundleVersion: "roadmap.fixture.bundle.v1",
    });
    expect(JSON.stringify(metadata)).not.toContain("PRIVATE_GOAL_CANARY");
    expect(JSON.stringify(vi.mocked(primary.generate).mock.calls)).not.toContain(
      "PRIVATE_ROLE_CANARY",
    );
    const snapshot = await new PostgresBudgetRepository(f.runtime).evaluationSnapshot(
      operator(),
      f.context().actor.userId,
    );
    expect(snapshot).toContainEqual(
      expect.objectContaining({
        operation: "plan_proposal",
        reservedUnits: 56000,
        pending: 0,
        policyVersion: 2,
      }),
    );
    const accepted = await commandOwnedRoadmap(f.context(), plans, {
      action: "accept",
      candidateId: candidate.candidateId,
      expectedToken: null,
      idempotencyKey: "gateway-accept-fixture",
    });
    expect(accepted.state).not.toBeNull();
  });
  it("provider outage keeps the active plan and yields a separate baseline preview", async () => {
    const state = (await plans.view(f.context().actor.userId, f.now)).state!;
    const p = vi.spyOn(primary, "generate").mockRejectedValueOnce(Error("PRIVATE_PROVIDER_CANARY")),
      fb = vi.spyOn(fallback, "generate").mockRejectedValueOnce(Error("PRIVATE_PROVIDER_CANARY"));
    const candidate = await build(state.token);
    expect(candidate.lineage).toBe("baseline_provider_fallback");
    expect((await plans.view(f.context().actor.userId, f.now)).state).toEqual(state);
    p.mockRestore();
    fb.mockRestore();
  });
  it("budget exhaustion calls neither provider and preserves active schedule", async () => {
    const budget = new PostgresBudgetRepository(f.runtime);
    for (let i = 0; i < 20; i++) {
      const input = {
        learnerId: f.context().actor.userId,
        operation: "plan_proposal" as const,
        key: `quota:${i}`,
        digest: `quota:${i}`,
        now: f.now,
      };
      await f.runtime.query(
        "INSERT INTO platform.optional_reservation(learner_id,operation,reservation_key,digest,units,policy_version,created_at,finished_at,outcome) VALUES($1,$2,$3,$4,56000,2,$5,$5,'success')",
        [input.learnerId, input.operation, input.key, input.digest, input.now],
      );
    }
    const state = (await plans.view(f.context().actor.userId, f.now)).state!,
      candidate = await build(state.token);
    expect(candidate.lineage).toBe("baseline_budget_daily_cap");
    expect(primary.generate).not.toHaveBeenCalled();
    expect(fallback.generate).not.toHaveBeenCalled();
    expect((await plans.view(f.context().actor.userId, f.now)).state).toEqual(state);
    expect(
      (await budget.evaluationSnapshot(operator(), f.context().actor.userId))[0]!.requests,
    ).toBe(20);
  });
  it("settles abandoned reservations before new admission", async () => {
    const old = new Date(Date.parse(f.now) - 31000).toISOString();
    await f.runtime.query(
      "INSERT INTO platform.optional_reservation(learner_id,operation,reservation_key,digest,units,policy_version,created_at) VALUES($1,'plan_proposal','abandoned','abandoned',56000,2,$2)",
      [f.learner, old],
    );
    const candidate = await build((await plans.view(f.context().actor.userId, f.now)).state!.token);
    expect(candidate.lineage).toBe("gateway_validated:roadmap.fixture.bundle.v1");
    expect(
      (
        await f.runtime.query(
          "SELECT outcome FROM platform.optional_reservation WHERE reservation_key='abandoned'",
        )
      ).rows[0].outcome,
    ).toBe("failure");
  });
  it("rollback closes previously composed ports and immutable metrics cannot be modified", async () => {
    const composed = await optional();
    expect(composed).toBeDefined();
    await evaluation.rollback(operator(), "fixture", promotion);
    expect(await optional()).toBeUndefined();
    const state = (await plans.view(f.context().actor.userId, f.now)).state!,
      candidate = await buildOwnedRoadmap(
        f.context(),
        plans,
        {
          scope: "reviewed_pilot",
          expectedToken: state.token,
          idempotencyKey: "rollback-buffered-fixture",
          useProposal: true,
        },
        composed,
      );
    expect(candidate.lineage).toBe("baseline_provider_fallback");
    expect(primary.generate).not.toHaveBeenCalled();
    await expect(
      f.runtime.query("DELETE FROM tutor.roadmap_generation_evidence"),
    ).rejects.toThrow();
  });
});
