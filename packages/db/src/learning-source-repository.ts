import { createHash } from "node:crypto";
import type { Pool } from "pg";
import {
  conflictError,
  notFoundError,
  validationError,
  createOutboxEvent,
  type LearningObservationReceipt,
  type LearningReviewRepository,
} from "@algocove/application";
import {
  gradeReviewedQuestions,
  parseReviewedQuestions,
  parseId,
  parseInstant,
  parseMasteryEvidence,
  type MasteryEvidence,
  type OpaqueId,
  type LearnerId,
  type Instant,
} from "@algocove/domain";
import { withTransaction, type Transaction } from "./transaction.ts";
import { recordStudyActivity } from "./study-activity.ts";
export function sourceDigest(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}
export async function lockStudyOwner(tx: Transaction, learnerId: LearnerId): Promise<void> {
  const row = await tx.query(
    "SELECT 1 FROM platform.learner WHERE learner_id=$1 FOR NO KEY UPDATE",
    [learnerId],
  );
  if (row.rowCount !== 1) throw notFoundError("Learner is unavailable.");
}
export function parsedId<K extends Parameters<typeof parseId>[0]>(
  kind: K,
  value: unknown,
): OpaqueId<K> {
  const p = parseId(kind, value);
  if (!p.ok) throw Error("Invalid persisted identifier.");
  return p.value;
}
export function sourceInstant(value: Date | string): Instant {
  const p = parseInstant(value instanceof Date ? value : new Date(value));
  if (!p.ok) throw Error("Invalid persisted time.");
  return p.value;
}
export async function replayLearning(
  tx: Transaction,
  learnerId: LearnerId,
  kind: string,
  key: string,
  digest: string,
): Promise<LearningObservationReceipt | null> {
  const result = await tx.query<{ facts: unknown; submission_digest: string }>(
    "SELECT facts,submission_digest FROM practice.learning_observation WHERE learner_id=$1 AND source_kind=$2 AND source_key=$3",
    [learnerId, kind, key],
  );
  const row = result.rows[0];
  if (row === undefined) return null;
  if (row.submission_digest !== digest)
    throw conflictError("The learning observation already has different submitted facts.");
  const fact = parseMasteryEvidence(row.facts);
  if (!fact.ok) throw Error(fact.error.message);
  return {
    observationId: fact.value.observationId,
    sourceEventId: fact.value.sourceEventId,
    correct: fact.value.correct,
    disposition: "replayed",
  };
}
export async function persistLearning(
  tx: Transaction,
  fact: MasteryEvidence,
  key: string,
  digest: string,
): Promise<LearningObservationReceipt> {
  const validated = parseMasteryEvidence(fact);
  if (!validated.ok) throw validationError(validated.error.message);
  await tx.query(
    "INSERT INTO practice.learning_observation(observation_id,learner_id,attempt_id,problem_version_id,source_kind,source_key,facts,observed_at,submission_digest) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)",
    [
      fact.observationId,
      fact.learnerId,
      fact.attemptId,
      fact.problemVersionId,
      fact.sourceKind,
      key,
      JSON.stringify(validated.value),
      fact.observedAt,
      digest,
    ],
  );
  const event = createOutboxEvent({
    eventId: fact.sourceEventId,
    topic: "practice.assessment.observed",
    aggregateId: fact.attemptId,
    occurredAt: fact.observedAt,
    payload: {
      observationId: fact.observationId,
      learnerId: fact.learnerId,
      sourceKind: fact.sourceKind,
      provenance: fact.provenance,
      correct: fact.correct,
    },
  });
  await tx.query(
    "INSERT INTO platform.outbox_event(event_id,topic,aggregate_id,payload,occurred_at) VALUES($1,$2,$3,$4::jsonb,$5)",
    [
      event.eventId,
      event.topic,
      event.aggregateId,
      JSON.stringify(event.payload),
      event.occurredAt,
    ],
  );
  await recordStudyActivity(tx, {
    learnerId: fact.learnerId,
    observationId: fact.observationId,
    occurredAt: fact.observedAt,
    kind: fact.sourceKind === "review" ? "review" : "explanation",
  });
  return {
    observationId: fact.observationId,
    sourceEventId: fact.sourceEventId,
    correct: fact.correct,
    disposition: "committed",
  };
}
export class PostgresExplanationRepository {
  private readonly pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }
  async observeExplanation(
    input: Parameters<LearningReviewRepository["observeExplanation"]>[0],
  ): Promise<LearningObservationReceipt> {
    return withTransaction(this.pool, async (tx) => {
      await lockStudyOwner(tx, input.learnerId);
      const key = `${input.pseudocodeId}:${input.revision}`;
      const digest = sourceDigest([key, input.confidence]);
      const replay = await replayLearning(
        tx,
        input.learnerId,
        "structured_explanation",
        key,
        digest,
      );
      if (replay !== null) return replay;
      const revisions = await tx.query<{
        attempt_id: string;
        problem_version_id: string;
        language: MasteryEvidence["language"];
        fields: { structuredAnswers?: Record<string, string> };
      }>(
        `SELECT r.* FROM practice.pseudocode_revision r JOIN content.problem_version p USING(problem_version_id) JOIN content.content_version v USING(content_version_id) WHERE r.pseudocode_id=$1 AND r.revision=$2 AND r.learner_id=$3 AND v.status='published' AND v.payload_status='available' AND (v.rights_expires_at IS NULL OR v.rights_expires_at>$4) FOR SHARE OF v`,
        [input.pseudocodeId, input.revision, input.learnerId, input.now],
      );
      const revision = revisions.rows[0];
      if (revision === undefined) throw notFoundError("Saved explanation revision is unavailable.");
      const exercises = await tx.query<{
        exercise_id: string;
        concept_id: string;
        questions: unknown;
        rubric_version: number;
      }>(
        `SELECT e.* FROM content.review_exercise e JOIN learning.problem_concept m ON m.concept_id=e.concept_id AND m.problem_version_id=e.problem_version_id WHERE e.problem_version_id=$1 AND e.kind='recall' AND e.status='published' AND (e.rights_expires_at IS NULL OR e.rights_expires_at>$2) ORDER BY e.exercise_id LIMIT 1 FOR SHARE OF e`,
        [revision.problem_version_id, input.now],
      );
      const exercise = exercises.rows[0];
      if (exercise === undefined)
        throw notFoundError("No reviewed explanation key exists for this problem.");
      let correct: boolean;
      try {
        correct = gradeReviewedQuestions(
          parseReviewedQuestions(exercise.questions),
          revision.fields.structuredAnswers ?? {},
        );
      } catch {
        throw validationError("Save an offered answer for every reviewed reasoning question.");
      }
      const tier = await tx.query<{ tier: number }>(
        "SELECT COALESCE(max(tier),0)::integer AS tier FROM practice.hint_exposure WHERE learner_id=$1 AND problem_version_id=$2",
        [input.learnerId, revision.problem_version_id],
      );
      return persistLearning(
        tx,
        {
          sourceKind: "structured_explanation",
          exerciseId: exercise.exercise_id,
          sourceEventId: input.eventId,
          observationId: input.observationId,
          learnerId: input.learnerId,
          conceptId: parsedId("concept", exercise.concept_id),
          attemptId: parsedId("attempt", revision.attempt_id),
          problemVersionId: parsedId("problemVersion", revision.problem_version_id),
          language: revision.language,
          observedAt: input.now,
          provenance: "structured_check",
          rubricVersion: `${exercise.exercise_id}/v${exercise.rubric_version}`,
          evidencePolicyVersion: 1,
          outcome: correct ? "pass" : "wrong_answer",
          correct,
          assistanceTier: tier.rows[0]!.tier,
          explanationCorrect: correct,
          explanationProvenance: "structured_check",
          confidence: input.confidence,
          confidenceProvenance: input.confidence === null ? null : "learner_reported",
          delayMs: null,
          transfer: null,
          transferProvenance: null,
        },
        key,
        digest,
      );
    });
  }
}
