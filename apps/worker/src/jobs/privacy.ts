import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { ExecutionRelay } from "@algocove/application";
import { parseId } from "@algocove/domain";

export type PrivacyDeletionLedger = {
  append(record: { requestId: string; learnerId: string; requestedAt: string }): Promise<void>;
};

/** External cancellation precedes the atomic purge. Failed jobs retain a fenced,
 * expiring lease and can retry; no raw source or provider body is logged. */
export async function processPrivacyDeletion(
  pool: Pool,
  relay: Pick<ExecutionRelay, "cancel"> | null,
  ledger?: PrivacyDeletionLedger,
): Promise<{ state: string; activePrivateReferences?: number }> {
  const token = randomUUID();
  const job = (
    await pool.query<{ request_id: string; learner_id: string; requested_at: Date }>(
      "SELECT request_id,learner_id,requested_at FROM platform.claim_privacy_deletion($1)",
      [token],
    )
  ).rows[0];
  if (!job) return { state: "idle" };
  if (ledger)
    await ledger.append({
      requestId: job.request_id,
      learnerId: job.learner_id,
      requestedAt: job.requested_at.toISOString(),
    });
  const cancellations = (
    await pool.query<{ run_id: string }>(
      "SELECT run_id FROM platform.privacy_cancellation WHERE request_id=$1 AND confirmed_at IS NULL",
      [job.request_id],
    )
  ).rows;
  for (const cancellation of cancellations) {
    const run = parseId("codeRun", cancellation.run_id);
    if (!run.ok || !relay) throw Error("Execution cancellation dependency unavailable.");
    await relay.cancel({ runId: run.value, reason: "system" });
    await pool.query("SELECT platform.confirm_privacy_cancellation($1,$2,$3)", [
      job.request_id,
      cancellation.run_id,
      token,
    ]);
  }
  return (
    await pool.query<{ result: { state: string; activePrivateReferences: number } }>(
      "SELECT platform.complete_privacy_deletion($1,$2) AS result",
      [job.request_id, token],
    )
  ).rows[0]!.result;
}
