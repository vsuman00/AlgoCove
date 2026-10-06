import { createHash } from "node:crypto";
import type { Pool } from "pg";
import {
  requireRole,
  authorizationError,
  validationError,
  type RequestContext,
} from "@algocove/application";
import { canonicalJson } from "@algocove/retrieval";
import type { RoadmapProposalEvidence } from "@algocove/tutor";
import { withTransaction } from "./transaction.ts";
export class PostgresRoadmapGenerationRepository {
  private readonly pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }
  async record(context: RequestContext, evidence: RoadmapProposalEvidence): Promise<void> {
    requireRole(context, "learner");
    if (
      Object.keys(evidence).sort().join() !==
        "bundleVersion,candidateCharacters,latencyMs,model,modelVersion,outcome,policyVersion,promptCharacters,promptVersion,provider,schemaVersion" ||
      evidence.schemaVersion !== 1 ||
      !["validated", "rejected"].includes(evidence.outcome)
    )
      throw validationError("Bounded generation metadata required.");
    for (const text of [
      evidence.bundleVersion,
      evidence.modelVersion,
      evidence.provider,
      evidence.model,
      evidence.promptVersion,
      evidence.policyVersion,
    ])
      if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/.test(text))
        throw validationError("Versioned generation identity required.");
    for (const [value, max] of [
      [evidence.latencyMs, 10000],
      [evidence.promptCharacters, 16000],
      [evidence.candidateCharacters, 12000],
    ])
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max!)
        throw validationError("Bounded generation measurements required.");
    await withTransaction(this.pool, async (tx) => {
      if (
        !(
          await tx.query(
            "SELECT 1 FROM platform.role_grant WHERE learner_id=$1 AND role='learner' AND revoked_at IS NULL FOR SHARE",
            [context.actor.userId],
          )
        ).rowCount
      )
        throw authorizationError("Current learner grant required.");
      await tx.query(
        "INSERT INTO tutor.roadmap_generation_evidence(evidence_id,configuration_version,body,checksum,created_at) VALUES($1,$2,$3,$4,$5)",
        [
          context.ids.generate("event"),
          evidence.bundleVersion,
          evidence,
          "sha256:" + createHash("sha256").update(canonicalJson(evidence)).digest("hex"),
          context.now,
        ],
      );
    });
  }
}
