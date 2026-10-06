import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { PERMISSIONS, type LearnerId } from "@algocove/domain";
import {
  requirePermission,
  authorizationError,
  notFoundError,
  conflictError,
  type RequestContext,
  type TutorRepository,
  type TutorInput,
  type TutorView,
  type TutorWork,
  type AllowedTutorAction,
  type TutorResponse,
  type TutorModelConfiguration,
} from "@algocove/application";
import {
  allowedTutorAction,
  parseTutorInput,
  validateTutorResponse,
  PROMPT_VERSION,
} from "@algocove/tutor";
import { canonicalJson, type EvidencePackage } from "@algocove/retrieval";
import { checksum } from "@algocove/content";
import { withTransaction, type Transaction } from "./transaction.ts";
import { reserveOptional, finishOptional } from "./budget-repository.ts";
type Row = {
  request_id: string;
  learner_id: LearnerId;
  input: TutorInput;
  action: AllowedTutorAction;
  state: TutorView["status"];
  claim: string | null;
  reason: string | null;
  expires_at: Date;
};
export class PostgresTutorRepository implements TutorRepository {
  private readonly readonlyPool: Pool;
  constructor(pool: Pool) {
    this.readonlyPool = pool;
  } // No provider credentials or tools belong to this adapter.
  private async action(
    tx: Transaction,
    ctx: RequestContext,
    input: TutorInput,
  ): Promise<AllowedTutorAction> {
    requirePermission(ctx, PERMISSIONS.profileRead);
    const grant = await tx.query(
      "SELECT 1 FROM platform.role_grant WHERE learner_id=$1 AND role='learner' AND revoked_at IS NULL FOR SHARE",
      [ctx.actor.userId],
    );
    if (!grant.rowCount) throw authorizationError("Learner access is unavailable.");
    const row = (
      await tx.query<{
        problem_version_id: string;
        content_version_id: string;
        mode: AllowedTutorAction["mode"];
        status: string;
        highest: number;
      }>(
        `SELECT a.problem_version_id,p.content_version_id,a.mode,a.status,(SELECT coalesce(max(tier),0)::integer FROM practice.hint_exposure WHERE learner_id=a.learner_id AND problem_version_id=a.problem_version_id) AS highest FROM practice.attempt a JOIN practice.learning_session s ON s.session_id=a.session_id AND s.learner_id=a.learner_id JOIN content.problem_version p USING(problem_version_id) JOIN content.content_version v USING(content_version_id) WHERE a.attempt_id=$1 AND a.learner_id=$2 AND a.status IN ('active','submitted') AND ((a.status='active' AND s.status='active') OR (a.status='submitted' AND s.status IN ('active','completed'))) AND v.status='published' AND v.payload_status='available' AND v.provenance_kind='original' AND (v.rights_expires_at IS NULL OR v.rights_expires_at>greatest($3::timestamptz,clock_timestamp())) FOR SHARE OF a,s,v`,
        [input.attemptId, ctx.actor.userId, ctx.now],
      )
    ).rows[0];
    if (!row) throw notFoundError("Owned learning context is unavailable.");
    const allowed = allowedTutorAction(input, {
      learnerId: ctx.actor.userId,
      attemptId: input.attemptId,
      problemVersionId: row.problem_version_id,
      contentVersionId: row.content_version_id,
      mode: row.mode,
      attemptStatus: row.status,
      highest: row.highest,
    });
    if (allowed.shareCode) {
      const draft = (
        await tx.query<{ draft_id: string; saved_revision: string }>(
          "SELECT draft_id,saved_revision FROM practice.draft WHERE attempt_id=$1 AND learner_id=$2 AND kind='source' AND saved_revision=current_revision AND expires_at>clock_timestamp()",
          [input.attemptId, ctx.actor.userId],
        )
      ).rows[0];
      if (draft) {
        allowed.draftId = draft.draft_id;
        allowed.codeRevision = Number(draft.saved_revision);
      }
    }
    return allowed;
  }
  private async row(tx: Transaction, ctx: RequestContext, id: string): Promise<Row> {
    const row = (
      await tx.query<Row>(
        "SELECT * FROM tutor.request WHERE request_id=$1 AND learner_id=$2 FOR UPDATE",
        [id, ctx.actor.userId],
      )
    ).rows[0];
    if (!row) throw notFoundError("Tutor request is unavailable.");
    const action = await this.action(tx, ctx, row.input);
    if (
      row.input.shareCode &&
      (action.draftId !== row.action.draftId || action.codeRevision !== row.action.codeRevision)
    )
      throw conflictError("Saved debug code changed; start a new request.");
    return row;
  }
  private async finishBudget(tx: Transaction, ctx: RequestContext, row: Row, success = false) {
    await finishOptional(tx, {
      learnerId: row.learner_id,
      operation: "tutor_generation",
      key: row.request_id,
      now: ctx.now,
      outcome: success ? "success" : "failure",
    });
  }
  private async view(tx: Transaction, ctx: RequestContext, row: Row): Promise<TutorView> {
    if (
      (row.state === "pending" || row.state === "running") &&
      row.expires_at.getTime() <= Date.now()
    ) {
      await tx.query(
        "UPDATE tutor.request SET state='fallback',claim=NULL,reason='expired' WHERE request_id=$1",
        [row.request_id],
      );
      await this.finishBudget(tx, ctx, row);
      row = { ...row, state: "fallback", reason: "expired", claim: null };
    }
    const persisted = (
      await tx.query<{ body: TutorResponse; checksum: string; evidence_id: string | null }>(
        "SELECT * FROM tutor.response WHERE request_id=$1",
        [row.request_id],
      )
    ).rows[0];
    if (persisted) {
      if (checksum(canonicalJson(persisted.body)) !== persisted.checksum)
        throw conflictError("Tutor receipt is invalid.");
      await this.checkEvidence(tx, ctx, row, persisted.evidence_id);
    }
    return {
      requestId: row.request_id,
      status: row.state,
      reason: row.reason,
      response: persisted?.body ?? null,
    };
  }
  private async checkEvidence(
    tx: Transaction,
    ctx: RequestContext,
    row: Row,
    id: string | null,
  ): Promise<EvidencePackage | null> {
    if (!id) return null;
    const e = (
      await tx.query<{ body: EvidencePackage }>(
        "SELECT body FROM tutor.evidence_package WHERE package_id=$1 AND learner_id=$2 AND attempt_id=$3",
        [id, ctx.actor.userId, row.input.attemptId],
      )
    ).rows[0]?.body;
    if (!e) throw conflictError("Evidence is unavailable.");
    for (const cid of [...new Set(e.candidates.map((c) => c.contentVersionId))].sort())
      await tx.query("SELECT content.lock_index_source($1)", [cid]);
    const config = await tx.query(
      `SELECT 1 FROM search.retrieval_configuration r JOIN search.embedding_configuration f ON f.configuration_id=r.embedding_configuration_id JOIN learning.curriculum_graph_version g ON g.curriculum_version_id=$2 WHERE r.configuration_version=$1 AND r.enabled AND f.enabled AND g.status='published' FOR SHARE OF r,f,g`,
      [e.configuration.version, e.scope.curriculumVersionId],
    );
    const count = await tx.query<{ n: number }>(
      `SELECT count(*)::integer AS n FROM search.eligible_chunk c JOIN search.chunk_embedding x ON x.chunk_id=c.chunk_id AND x.configuration_id=$2 WHERE c.chunk_id=ANY($1::text[])`,
      [e.candidates.map((c) => c.chunkId), e.configuration.embeddingConfigurationId],
    );
    if (!config.rowCount || count.rows[0]!.n !== e.candidates.length)
      throw conflictError("Evidence is no longer permitted.");
    return e;
  }
  async start(ctx: RequestContext, input: TutorInput): Promise<TutorView> {
    input = parseTutorInput(input);
    return withTransaction(this.readonlyPool, async (tx) => {
      const action = await this.action(tx, ctx, input),
        digest = checksum(canonicalJson(input));
      await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        ctx.actor.userId + ":tutor:" + input.idempotencyKey,
      ]);
      const old = (
        await tx.query<Row & { digest: string }>(
          "SELECT * FROM tutor.request WHERE learner_id=$1 AND idempotency_key=$2 FOR UPDATE",
          [ctx.actor.userId, input.idempotencyKey],
        )
      ).rows[0];
      if (old) {
        if (old.digest !== digest) throw conflictError("Tutor key was reused.");
        return this.view(tx, ctx, old);
      }
      // Recover bounded owner-scoped abandoned work before counting concurrency.
      const expired = (
        await tx.query<Row>(
          "SELECT * FROM tutor.request WHERE learner_id=$1 AND state IN ('pending','running') AND expires_at<=clock_timestamp() ORDER BY created_at,request_id LIMIT 20 FOR UPDATE SKIP LOCKED",
          [ctx.actor.userId],
        )
      ).rows;
      for (const stale of expired) {
        await tx.query(
          "UPDATE tutor.request SET state='fallback',claim=NULL,reason='expired' WHERE request_id=$1",
          [stale.request_id],
        );
        await this.finishBudget(tx, ctx, stale);
      }
      const id = ctx.ids.generate("event"),
        reservation = await reserveOptional(tx, {
          learnerId: ctx.actor.userId,
          operation: "tutor_generation",
          key: id,
          digest,
          now: ctx.now,
        });
      const row = (
        await tx.query<Row>(
          `INSERT INTO tutor.request(request_id,learner_id,attempt_id,idempotency_key,digest,input,action,state,reason,created_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,clock_timestamp(),clock_timestamp()+interval '15 seconds') RETURNING *`,
          [
            id,
            ctx.actor.userId,
            input.attemptId,
            input.idempotencyKey,
            digest,
            JSON.stringify(input),
            JSON.stringify(action),
            reservation.allowed ? "pending" : "fallback",
            reservation.allowed ? null : "budget_exhausted",
          ],
        )
      ).rows[0]!;
      return this.view(tx, ctx, row);
    });
  }
  read(ctx: RequestContext, id: string): Promise<TutorView> {
    return withTransaction(this.readonlyPool, async (tx) =>
      this.view(tx, ctx, await this.row(tx, ctx, id)),
    );
  }
  claim(ctx: RequestContext, id: string): Promise<TutorWork | null> {
    return withTransaction(this.readonlyPool, async (tx) => {
      const row = await this.row(tx, ctx, id);
      const view = await this.view(tx, ctx, row);
      if (view.status !== "pending") return null;
      if (canonicalJson(await this.action(tx, ctx, row.input)) !== canonicalJson(row.action))
        throw conflictError("Tutor context changed; start a new request.");
      const claim = randomUUID();
      await tx.query("UPDATE tutor.request SET state='running',claim=$2 WHERE request_id=$1", [
        id,
        claim,
      ]);
      return {
        requestId: id,
        input: row.input,
        action: await this.action(tx, ctx, row.input),
        claim,
      };
    });
  }
  cancel(ctx: RequestContext, id: string): Promise<TutorView> {
    return withTransaction(this.readonlyPool, async (tx) => {
      let row = await this.row(tx, ctx, id);
      if (row.state === "pending" || row.state === "running") {
        await tx.query(
          "UPDATE tutor.request SET state='cancelled',claim=NULL,reason='cancelled' WHERE request_id=$1",
          [id],
        );
        await this.finishBudget(tx, ctx, row);
        row = { ...row, state: "cancelled", claim: null, reason: "cancelled" };
      }
      return this.view(tx, ctx, row);
    });
  }
  async code(ctx: RequestContext, work: TutorWork): Promise<string | null> {
    return withTransaction(this.readonlyPool, async (tx) => {
      const action = await this.action(tx, ctx, work.input);
      if (!action.shareCode || work.input.intent !== "debug")
        throw authorizationError("Explicit debug consent is required.");
      const row = (
        await tx.query<{ current_text: string }>(
          "SELECT current_text FROM practice.draft WHERE attempt_id=$1 AND learner_id=$2 AND draft_id=$3 AND saved_revision=$4 AND kind='source' AND saved_revision=current_revision AND expires_at>clock_timestamp()",
          [
            work.input.attemptId,
            ctx.actor.userId,
            work.action.draftId ?? null,
            work.action.codeRevision ?? null,
          ],
        )
      ).rows[0];
      return row && row.current_text.length <= 8000 ? row.current_text : null;
    });
  }
  finish(
    ctx: RequestContext,
    work: TutorWork,
    response: TutorResponse | null,
    evidenceId: string | null,
    reason: string | null,
    model?: TutorModelConfiguration,
  ): Promise<TutorView> {
    return withTransaction(this.readonlyPool, async (tx) => {
      let row = await this.row(tx, ctx, work.requestId);
      if (
        row.state !== "running" ||
        row.claim !== work.claim ||
        row.expires_at.getTime() <= Date.now()
      )
        return this.view(tx, ctx, row);
      const action = await this.action(tx, ctx, row.input);
      if (canonicalJson(action) !== canonicalJson(work.action))
        throw conflictError("Tutor context changed.");
      let delivered = response,
        selectedHint: { hint_id: string; tier: number; body: string } | undefined;
      if (delivered) {
        if (
          !model ||
          model.version !== delivered.modelConfigVersion ||
          (model.kind === "approved" && !model.approvalReference)
        )
          throw conflictError("Generation configuration is invalid.");
        const evidence = await this.checkEvidence(tx, ctx, row, evidenceId);
        if (!evidence) throw conflictError("Validated evidence is required.");
        delivered = validateTutorResponse(
          delivered,
          action,
          row.input,
          evidence,
          delivered.modelConfigVersion,
        );
      } else {
        selectedHint = (
          await tx.query<{ hint_id: string; tier: number; body: string }>(
            "SELECT hint_id,tier,body FROM content.problem_hint WHERE problem_version_id=$1 AND tier=$2 ORDER BY hint_id LIMIT 1",
            [action.problemVersionId, row.input.intent === "hint" ? action.requestedTier : 1],
          )
        ).rows[0];
        if (selectedHint) {
          const v = (
            await tx.query<{ problem_id: string; title: string }>(
              "SELECT p.problem_id,v.title FROM content.problem_version p JOIN content.content_version v USING(content_version_id) WHERE problem_version_id=$1",
              [action.problemVersionId],
            )
          ).rows[0]!;
          delivered = {
            intent: row.input.intent,
            hintTier: selectedHint.tier,
            message: selectedHint.body,
            citations: [
              {
                contentId: v.problem_id,
                contentVersion: action.contentVersionId,
                evidenceItemId: selectedHint.hint_id,
                title: v.title,
              },
            ],
            confidence: "high",
            unsupported: false,
            policyVersion: action.policyVersion,
            retrievalConfigVersion: "authored",
            promptVersion: PROMPT_VERSION,
            modelConfigVersion: "authored",
          };
        }
      }
      if (delivered) {
        await tx.query(
          "INSERT INTO tutor.response(request_id,evidence_id,body,checksum,created_at,model_configuration) VALUES($1,$2,$3,$4,$5,$6)",
          [
            row.request_id,
            response ? evidenceId : null,
            JSON.stringify(delivered),
            checksum(canonicalJson(delivered)),
            ctx.now,
            response ? JSON.stringify(model) : null,
          ],
        );
        await tx.query(
          "INSERT INTO tutor.assistance(request_id,learner_id,attempt_id,problem_version_id,tier,recorded_at) VALUES($1,$2,$3,$4,$5,$6)",
          [
            row.request_id,
            ctx.actor.userId,
            row.input.attemptId,
            action.problemVersionId,
            delivered.hintTier,
            ctx.now,
          ],
        );
        if (selectedHint)
          await tx.query(
            "INSERT INTO practice.hint_exposure(exposure_id,learner_id,attempt_id,problem_version_id,hint_id,tier,idempotency_key,exposed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
            [
              ctx.ids.generate("event"),
              ctx.actor.userId,
              row.input.attemptId,
              action.problemVersionId,
              selectedHint.hint_id,
              selectedHint.tier,
              "tutor:" + row.request_id,
              ctx.now,
            ],
          );
      }
      const state = response ? "completed" : "fallback";
      await tx.query("UPDATE tutor.request SET state=$2,claim=NULL,reason=$3 WHERE request_id=$1", [
        row.request_id,
        state,
        reason,
      ]);
      await this.finishBudget(tx, ctx, row, !!response);
      row = { ...row, state, claim: null, reason };
      return this.view(tx, ctx, row);
    });
  }
}
