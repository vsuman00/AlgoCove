import { practiceDestination } from "@algocove/domain";
import {
  authorizationError,
  conflictError,
  validationError,
  type RequestContext,
} from "@algocove/application";
import { createHash } from "node:crypto";
import type { Transaction } from "./transaction.ts";
import { PostgresPilotRepository } from "./pilot-repository.ts";
export class PostgresDestinationRepository {
  private readonly tx: Transaction;
  constructor(tx: Transaction) {
    this.tx = tx;
  }
  async pending(ctx: RequestContext): Promise<readonly Record<string, unknown>[]> {
    await new PostgresPilotRepository(this.tx).requireRole(ctx, [
      "author",
      "technical_reviewer",
      "publisher",
    ]);
    return (
      await this.tx.query(
        'SELECT r.external_reference_id AS "referenceId",r.title,r.provider AS "legacyProvider",r.canonical_url AS "sourceUrl",r.version,m.reason FROM content.external_reference r JOIN content.external_destination_mapping m USING(external_reference_id) WHERE m.status=\'pending_review\' ORDER BY r.external_reference_id LIMIT 100',
      )
    ).rows;
  }
  async reconcile(
    ctx: RequestContext,
    input: { referenceId: string; expectedVersion: number; solveUrl: string; notes: string },
  ): Promise<{ destinationId: string }> {
    await new PostgresPilotRepository(this.tx).requireRole(ctx, ["technical_reviewer"]);
    const d = practiceDestination(input.solveUrl);
    if (!d || !input.notes?.trim() || input.notes.length > 1600)
      throw validationError(
        "A reviewed canonical solve URL and bounded reconciliation notes are required.",
      );
    const row = (
      await this.tx.query(
        "SELECT author_id,version,url_status FROM content.external_reference WHERE external_reference_id=$1 FOR UPDATE",
        [input.referenceId],
      )
    ).rows[0];
    if (!row || row.version !== input.expectedVersion || row.url_status !== "reviewed")
      throw conflictError("Review the source reference and reload its version first.");
    if (row.author_id === ctx.actor.userId)
      throw authorizationError("An independent reviewer must reconcile the destination.");
    const destinationId = `dst_${createHash("md5").update(`${d.platform}:${d.canonicalKey}`).digest("hex")}`;
    await this.tx.query(
      "INSERT INTO content.practice_destination(destination_id,platform,canonical_key,canonical_url) VALUES($1,$2,$3,$4) ON CONFLICT(platform,canonical_key) DO NOTHING",
      [destinationId, d.platform, d.canonicalKey, d.canonicalUrl],
    );
    await this.tx.query(
      "UPDATE content.external_reference SET version=version+1 WHERE external_reference_id=$1",
      [input.referenceId],
    );
    await this.tx.query(
      "UPDATE content.external_destination_mapping SET destination_id=$2,status='reviewed',reviewed_by=$3,reviewed_at=$4,reason=$5 WHERE external_reference_id=$1",
      [input.referenceId, destinationId, ctx.actor.userId, ctx.now, input.notes],
    );
    await this.tx.query(
      "INSERT INTO platform.audit_event(event_id,actor_id,action,resource_type,resource_id,payload,occurred_at) VALUES($1,$2,'destination.reconcile','external_reference',$3,$4::jsonb,$5)",
      [
        ctx.ids.generate("event"),
        ctx.actor.userId,
        input.referenceId,
        JSON.stringify({ destinationId, notes: input.notes }),
        ctx.now,
      ],
    );
    return { destinationId };
  }
}
