import { createHash } from "node:crypto";
import type { Pool } from "pg";
import {
  requirePermission,
  authorizationError,
  conflictError,
  validationError,
  type RequestContext,
} from "@algocove/application";
import { PERMISSIONS } from "@algocove/domain";
import {
  parseEvaluationSuite,
  parseEvaluationConfiguration,
  parseEvaluationRun,
  evaluatePromotion,
  canonicalEvaluation,
  type EvaluationConfiguration,
  type HumanEvaluation,
} from "@algocove/tutor";
import { withTransaction, type Transaction } from "./transaction.ts";
const digest = (body: unknown) =>
  "sha256:" + createHash("sha256").update(canonicalEvaluation(body)).digest("hex");
async function authorize(tx: Transaction, ctx: RequestContext, role: "operator" | "evaluator") {
  requirePermission(
    ctx,
    role === "operator" ? PERMISSIONS.operationsManage : PERMISSIONS.contentEvaluate,
  );
  const grant = await tx.query(
    "SELECT 1 FROM platform.role_grant WHERE learner_id=$1 AND role=$2 AND revoked_at IS NULL FOR SHARE",
    [ctx.actor.userId, role],
  );
  if (!grant.rowCount)
    throw authorizationError("An active server-owned evaluation or operator grant is required.");
}
async function record(
  tx: Transaction,
  table: "evaluation_suite" | "evaluation_configuration" | "evaluation_run",
  column: "version" | "run_id",
  value: string,
) {
  const result = await tx.query(`SELECT * FROM tutor.${table} WHERE ${column}=$1 FOR SHARE`, [
    value,
  ]);
  const row = result.rows[0];
  if (!row || digest(row.body) !== row.checksum)
    throw validationError("Missing or corrupt immutable evaluation record.");
  return row;
}
async function configuration(tx: Transaction, version: string) {
  const row = await record(tx, "evaluation_configuration", "version", version);
  if (!row.available) throw conflictError("Configuration is unavailable.");
  return row;
}
export class PostgresEvaluationRepository {
  private readonly pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }
  async declareSuite(ctx: RequestContext, raw: unknown): Promise<string> {
    const body = parseEvaluationSuite(raw);
    return withTransaction(this.pool, async (tx) => {
      await authorize(tx, ctx, "evaluator");
      await tx.query(
        "INSERT INTO tutor.evaluation_suite(version,body,checksum,owner_id,created_at) VALUES($1,$2,$3,$4,$5)",
        [body.version, body, digest(body), ctx.actor.userId, ctx.now],
      );
      return body.version;
    });
  }
  async registerConfiguration(ctx: RequestContext, raw: unknown): Promise<string> {
    const body = parseEvaluationConfiguration(raw);
    return withTransaction(this.pool, async (tx) => {
      await authorize(tx, ctx, "operator");
      await tx.query(
        "INSERT INTO tutor.evaluation_configuration(version,body,checksum,registered_by,registered_at) VALUES($1,$2,$3,$4,$5)",
        [body.version, body, digest(body), ctx.actor.userId, ctx.now],
      );
      return body.version;
    });
  }
  async recordRun(ctx: RequestContext, raw: unknown): Promise<string> {
    const body = parseEvaluationRun(raw);
    return withTransaction(this.pool, async (tx) => {
      await authorize(tx, ctx, "evaluator");
      const suite = await record(tx, "evaluation_suite", "version", body.suiteVersion);
      const config = await configuration(tx, body.configurationVersion);
      if (!config.body.fixture && body.environment !== "approved-evaluation")
        throw validationError("Fixture evidence cannot qualify a live configuration.");
      if (evaluatePromotion(suite.body, body, []).reasons.includes("case_membership"))
        throw validationError("Every declared case must have exactly one result.");
      const runId = ctx.ids.generate("event");
      await tx.query(
        "INSERT INTO tutor.evaluation_run(run_id,suite_version,configuration_version,evaluator_id,body,checksum,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          runId,
          body.suiteVersion,
          body.configurationVersion,
          ctx.actor.userId,
          body,
          digest(body),
          ctx.now,
        ],
      );
      return runId;
    });
  }
  async review(
    ctx: RequestContext,
    runId: string,
    review: HumanEvaluation,
    rationaleCode: string,
  ): Promise<void> {
    if (
      !/^[a-z0-9_.:-]{1,80}$/.test(rationaleCode) ||
      !Number.isFinite(review.score) ||
      review.score < 0 ||
      review.score > 1 ||
      typeof review.accepted !== "boolean" ||
      Object.keys(review).sort().join() !== "accepted,caseId,rubricVersion,score"
    )
      throw validationError("Use a bounded rubric score and rationale code, without learner text.");
    return withTransaction(this.pool, async (tx) => {
      await authorize(tx, ctx, "evaluator");
      const run = await record(tx, "evaluation_run", "run_id", runId);
      const suite = parseEvaluationSuite(
        (await record(tx, "evaluation_suite", "version", run.suite_version)).body,
      );
      if (
        run.evaluator_id === ctx.actor.userId ||
        review.rubricVersion !== suite.rubricVersion ||
        !suite.humanSample.includes(review.caseId)
      )
        throw authorizationError(
          "An independent reviewer must review the declared sample and rubric.",
        );
      await tx.query(
        "INSERT INTO tutor.evaluation_review(run_id,case_id,reviewer_id,rubric_version,score,accepted,rationale_code,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          runId,
          review.caseId,
          ctx.actor.userId,
          review.rubricVersion,
          review.score,
          review.accepted,
          rationaleCode,
          ctx.now,
        ],
      );
    });
  }
  async active(
    ctx: RequestContext,
    channel: "fixture" | "production",
  ): Promise<{
    version: string;
    decisionId: string | null;
    configuration: EvaluationConfiguration | { version: string; kind: "authored-off" };
  }> {
    return withTransaction(this.pool, async (tx) => {
      await authorize(tx, ctx, "operator");
      const row = (
        await tx.query("SELECT * FROM tutor.configuration_channel WHERE channel=$1", [channel])
      ).rows[0];
      if (!row) throw validationError("Unknown rollout channel.");
      const config = await configuration(tx, row.active_version);
      return {
        version: row.active_version as string,
        decisionId: row.decision_id as string | null,
        configuration: config.body as
          EvaluationConfiguration | { version: string; kind: "authored-off" },
      };
    });
  }
  /** Internal server composition read: current immutable evidence, never browser flags. */
  async promotedConfiguration(
    channelName: "fixture" | "production" = "production",
  ): Promise<EvaluationConfiguration | null> {
    return withTransaction(
      this.pool,
      async (tx) => {
        const channel = (
          await tx.query("SELECT * FROM tutor.configuration_channel WHERE channel=$1 FOR SHARE", [
            channelName,
          ])
        ).rows[0];
        if (!channel || channel.active_version === "authored.off.v1") return null;
        const candidate = parseEvaluationConfiguration(
          (await configuration(tx, channel.active_version)).body,
        );
        const decision = (
          await tx.query(
            "SELECT * FROM tutor.configuration_decision WHERE decision_id=$1 AND accepted FOR SHARE",
            [channel.decision_id],
          )
        ).rows[0];
        if (
          !decision ||
          decision.target_version !== candidate.version ||
          (channelName === "production" && candidate.fixture)
        )
          return null;
        // A rollback may point to an earlier accepted configuration; locate its own qualifying run.
        const qualifying = (
          await tx.query(
            "SELECT run_id FROM tutor.configuration_decision WHERE target_version=$1 AND channel=$2 AND action='promote' AND accepted ORDER BY created_at DESC,decision_id DESC LIMIT 1",
            [candidate.version, channelName],
          )
        ).rows[0];
        if (!qualifying) return null;
        const run = await record(tx, "evaluation_run", "run_id", qualifying.run_id);
        const suite = await record(tx, "evaluation_suite", "version", run.suite_version);
        const rows = await tx.query(
          "SELECT r.case_id,r.rubric_version,r.score,r.accepted FROM tutor.evaluation_review r JOIN platform.role_grant g ON g.learner_id=r.reviewer_id AND g.role='evaluator' AND g.revoked_at IS NULL WHERE r.run_id=$1 FOR SHARE OF r,g",
          [qualifying.run_id],
        );
        const reviews = rows.rows.map((r) => ({
          caseId: r.case_id,
          rubricVersion: r.rubric_version,
          score: r.score,
          accepted: r.accepted,
        })) as HumanEvaluation[];
        return evaluatePromotion(suite.body, run.body, reviews).passed ? candidate : null;
      },
      { statementTimeoutMs: 2000 },
    );
  }
  async promote(
    ctx: RequestContext,
    input: {
      channel: "fixture" | "production";
      runId: string;
      expectedActive: string;
      rollbackVersion: string;
    },
  ): Promise<{ decisionId: string; accepted: boolean; reasons: string[] }> {
    return withTransaction(
      this.pool,
      async (tx) => {
        await authorize(tx, ctx, "operator");
        const channel = (
          await tx.query("SELECT * FROM tutor.configuration_channel WHERE channel=$1 FOR UPDATE", [
            input.channel,
          ])
        ).rows[0];
        if (
          !channel ||
          channel.active_version !== input.expectedActive ||
          input.rollbackVersion !== input.expectedActive
        )
          throw conflictError(
            "Promotion requires the current available configuration as rollback target.",
          );
        await configuration(tx, input.rollbackVersion);
        const run = await record(tx, "evaluation_run", "run_id", input.runId);
        const suite = await record(tx, "evaluation_suite", "version", run.suite_version);
        const candidate = parseEvaluationConfiguration(
          (await configuration(tx, run.configuration_version)).body,
        );
        const reviewRows = await tx.query(
          "SELECT r.case_id,r.rubric_version,r.score,r.accepted FROM tutor.evaluation_review r JOIN platform.role_grant g ON g.learner_id=r.reviewer_id AND g.role='evaluator' AND g.revoked_at IS NULL WHERE r.run_id=$1 FOR SHARE OF r,g",
          [input.runId],
        );
        const reviews = reviewRows.rows.map((r) => ({
          caseId: r.case_id,
          rubricVersion: r.rubric_version,
          score: r.score,
          accepted: r.accepted,
        })) as HumanEvaluation[];
        const evidence = evaluatePromotion(suite.body, run.body, reviews);
        if (input.channel === "production" && candidate.fixture) {
          evidence.passed = false;
          evidence.reasons.push("fixture_configuration");
        }
        if (candidate.version === input.expectedActive) {
          evidence.passed = false;
          evidence.reasons.push("already_active");
        }
        return this.decide(
          tx,
          ctx,
          input.channel,
          "promote",
          input.expectedActive,
          candidate.version,
          input.rollbackVersion,
          input.runId,
          evidence,
        );
      },
      { statementTimeoutMs: 3000 },
    );
  }
  async rollback(
    ctx: RequestContext,
    channelName: "fixture" | "production",
    expectedDecisionId: string,
  ): Promise<{ decisionId: string; accepted: boolean; reasons: string[] }> {
    return withTransaction(
      this.pool,
      async (tx) => {
        await authorize(tx, ctx, "operator");
        const channel = (
          await tx.query("SELECT * FROM tutor.configuration_channel WHERE channel=$1 FOR UPDATE", [
            channelName,
          ])
        ).rows[0];
        if (!channel || channel.decision_id !== expectedDecisionId)
          throw conflictError("The rollout has changed.");
        const prior = (
          await tx.query("SELECT * FROM tutor.configuration_decision WHERE decision_id=$1", [
            expectedDecisionId,
          ])
        ).rows[0];
        if (
          !prior ||
          !prior.accepted ||
          prior.action !== "promote" ||
          channel.active_version !== prior.target_version
        )
          throw conflictError("Only the current promotion can be rolled back.");
        await configuration(tx, prior.rollback_version);
        return this.decide(
          tx,
          ctx,
          channelName,
          "rollback",
          channel.active_version,
          prior.rollback_version,
          channel.active_version,
          prior.run_id,
          { passed: true, reasons: [], sourceDecision: expectedDecisionId },
        );
      },
      { statementTimeoutMs: 3000 },
    );
  }
  private async decide(
    tx: Transaction,
    ctx: RequestContext,
    channel: string,
    action: string,
    previous: string,
    target: string,
    rollback: string,
    runId: string,
    evidence: { passed: boolean; reasons: string[]; sourceDecision?: string },
  ) {
    const decisionId = ctx.ids.generate("event");
    await tx.query(
      "INSERT INTO tutor.configuration_decision(decision_id,channel,action,previous_version,target_version,rollback_version,run_id,operator_id,accepted,evidence,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
      [
        decisionId,
        channel,
        action,
        previous,
        target,
        rollback,
        runId,
        ctx.actor.userId,
        evidence.passed,
        evidence,
        ctx.now,
      ],
    );
    if (evidence.passed)
      await tx.query(
        "UPDATE tutor.configuration_channel SET active_version=$2,decision_id=$3 WHERE channel=$1",
        [channel, target, decisionId],
      );
    return { decisionId, accepted: evidence.passed, reasons: evidence.reasons };
  }
}
