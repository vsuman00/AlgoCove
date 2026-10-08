import type { Pool } from "pg";
import {
  authorizationError,
  notFoundError,
  conflictError,
  type ConceptMappingRepository,
} from "@algocove/application";
import { withTransaction } from "./transaction.ts";
export class PostgresConceptMappingRepository implements ConceptMappingRepository {
  private readonly pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }
  async replaceDraftMapping(
    input: Parameters<ConceptMappingRepository["replaceDraftMapping"]>[0],
  ): Promise<void> {
    await withTransaction(this.pool, async (tx) => {
      const row = (
        await tx.query<{ content_version_id: string; author_id: string; status: string }>(
          "SELECT v.content_version_id,v.author_id,v.status FROM content.content_version v JOIN content.problem_version p USING(content_version_id) WHERE p.problem_version_id=$1 FOR UPDATE OF v",
          [input.problemVersionId],
        )
      ).rows[0];
      if (row === undefined) throw notFoundError("Problem version is unavailable.");
      if (row.author_id !== input.learnerId)
        throw authorizationError("Only the draft author may change concept mappings.");
      if (row.status !== "draft")
        throw conflictError(
          "Published mappings are immutable. Create a reviewed successor version.",
        );
      if (
        (
          await tx.query("SELECT 1 FROM content.pilot_bundle WHERE problem_version_id=$1", [
            input.problemVersionId,
          ])
        ).rowCount
      )
        throw conflictError(
          "Pilot concept mappings are checksum-bound; create a registered successor.",
        );
      await tx.query("DELETE FROM learning.problem_concept WHERE problem_version_id=$1", [
        input.problemVersionId,
      ]);
      for (const mapping of input.mappings)
        await tx.query(
          "INSERT INTO learning.problem_concept(problem_version_id,concept_id,rationale,mapped_by,mapped_at) VALUES($1,$2,$3,$4,$5)",
          [
            input.problemVersionId,
            mapping.conceptId,
            mapping.rationale,
            input.learnerId,
            input.now,
          ],
        );
      await tx.query("DELETE FROM content.content_review WHERE content_version_id=$1", [
        row.content_version_id,
      ]);
      await tx.query("DELETE FROM content.content_validation WHERE content_version_id=$1", [
        row.content_version_id,
      ]);
    });
  }
}
