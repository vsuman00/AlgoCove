import { createHash } from "node:crypto";
import type { Pool } from "pg";
import type { ExternalReadinessRepository, ExternalReadinessSnapshot } from "@algocove/application";
import {
  parseContentChecksum,
  type ExternalReadinessEvidence,
  type ExternalReadinessRubric,
  type LearningAttempt,
  type ReadinessBinding,
} from "@algocove/domain";
import { parsedId } from "./learning-source-repository.ts";
import { withTransaction, type Transaction } from "./transaction.ts";

export class PostgresExternalReadinessRepository implements ExternalReadinessRepository {
  private readonly pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }

  loadOwnedReadiness(
    attemptId: LearningAttempt["attemptId"],
    learnerId: ReadinessBinding["learnerId"],
  ): Promise<ExternalReadinessSnapshot | null> {
    return withTransaction(this.pool, (tx) => loadReadinessSnapshot(tx, attemptId, learnerId), {
      isolationLevel: "repeatable read",
      readOnly: true,
    });
  }
}

export async function loadReadinessSnapshot(
  tx: Transaction,
  attemptId: LearningAttempt["attemptId"],
  learnerId: ReadinessBinding["learnerId"],
): Promise<ExternalReadinessSnapshot | null> {
  const result = await tx.query<{
    problem_version_id: string;
    manifest_id: string;
    mode: LearningAttempt["mode"];
    content_available: boolean;
    current_text: string | null;
    reasoning_revision: string | null;
    assistance: number;
    rubric: ExternalReadinessRubric | null;
  }>(
    `SELECT a.problem_version_id,a.manifest_id,a.mode,
        (a.status IN ('active','submitted') AND cv.status='published' AND cv.payload_status='available'
         AND (cv.rights_expires_at IS NULL OR cv.rights_expires_at>now()) AND m.status='published') AS content_available,
        d.current_text, CASE WHEN p.saved_revision=p.current_revision AND pr.revision IS NOT NULL THEN p.saved_revision ELSE 0 END AS reasoning_revision,
        GREATEST(COALESCE((SELECT max(h.tier) FROM practice.hint_exposure h WHERE h.learner_id=a.learner_id AND h.problem_version_id=a.problem_version_id),0),COALESCE((SELECT max(t.tier) FROM tutor.assistance t WHERE t.learner_id=a.learner_id AND t.problem_version_id=a.problem_version_id),0))::integer AS assistance,
        CASE WHEN r.rubric_id IS NULL THEN NULL ELSE jsonb_build_object('rubricId',r.rubric_id,'version',r.version,
          'problemVersionId',r.problem_version_id,'mode',r.mode,'published',true,'requirements',r.requirements,
          'maximumAssistanceTier',r.maximum_assistance_tier) END AS rubric
       FROM practice.attempt a
       JOIN content.problem_version pv ON pv.problem_version_id=a.problem_version_id
       JOIN content.content_version cv ON cv.content_version_id=pv.content_version_id
       JOIN content.problem_language_manifest m ON m.manifest_id=a.manifest_id
       LEFT JOIN practice.draft d ON d.attempt_id=a.attempt_id AND d.learner_id=a.learner_id AND d.kind='source' AND d.expires_at>now()
       LEFT JOIN practice.pseudocode_artifact p ON p.attempt_id=a.attempt_id AND p.learner_id=a.learner_id
       LEFT JOIN practice.pseudocode_revision pr ON pr.pseudocode_id=p.pseudocode_id AND pr.learner_id=a.learner_id AND pr.revision=p.saved_revision
       LEFT JOIN content.external_readiness_rubric r ON r.problem_version_id=a.problem_version_id AND r.mode=a.mode AND r.status='published'
       WHERE a.attempt_id=$1 AND a.learner_id=$2`,
    [attemptId, learnerId],
  );
  const row = result.rows[0];
  if (row === undefined) return null;
  const digest =
    row.current_text === null
      ? null
      : parseContentChecksum(
          `sha256:${createHash("sha256").update(row.current_text).digest("hex")}`,
        );
  if (digest !== null && !digest.ok) throw Error("Invalid source checksum.");
  const binding: ReadinessBinding = {
    learnerId,
    attemptId,
    problemVersionId: parsedId("problemVersion", row.problem_version_id),
    manifestId: parsedId("languageManifest", row.manifest_id),
    sourceChecksum: digest?.ok ? digest.value : null,
    reasoningRevision: Number(row.reasoning_revision ?? 0),
  };
  const facts = await tx.query<{
    evidence_id: string;
    source_checksum: string;
    reasoning_revision: string;
    rubric_id: string;
    rubric_version: number;
    category: ExternalReadinessEvidence["category"];
    check_id: string;
    provenance: ExternalReadinessEvidence["provenance"];
    correct: boolean;
  }>(
    `SELECT DISTINCT ON (category,check_id) evidence_id,source_checksum,reasoning_revision,rubric_id,rubric_version,category,check_id,provenance,correct
          FROM practice.external_readiness_evidence WHERE learner_id=$1 AND attempt_id=$2 AND problem_version_id=$3 AND manifest_id=$4 AND mode=$5
          AND source_checksum=$6 AND reasoning_revision=$7 AND rubric_id=$8 AND rubric_version=$9 ORDER BY category,check_id,observed_at DESC,evidence_id DESC`,
    [
      learnerId,
      attemptId,
      binding.problemVersionId,
      binding.manifestId,
      row.mode,
      binding.sourceChecksum,
      binding.reasoningRevision,
      row.rubric?.rubricId ?? null,
      row.rubric?.version ?? null,
    ],
  );
  const evidence = facts.rows.map((fact): ExternalReadinessEvidence => ({
    ...binding,
    evidenceId: parsedId("event", fact.evidence_id),
    rubricId: fact.rubric_id,
    rubricVersion: fact.rubric_version,
    category: fact.category,
    checkId: fact.check_id,
    provenance: fact.provenance,
    correct: fact.correct,
  }));
  return {
    binding,
    mode: row.mode,
    contentAvailable: row.content_available,
    rubric: row.rubric,
    highestAssistanceTier: row.assistance,
    evidence,
  };
}
