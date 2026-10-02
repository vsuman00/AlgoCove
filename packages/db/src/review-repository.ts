import { createHash } from "node:crypto";
import type { Pool } from "pg";
import {
  createOutboxEvent,
  conflictError,
  notFoundError,
  validationError,
  type LearningReviewRepository,
  type LearningObservationReceipt,
  type ReviewQueueItem,
  type ReviewExercise,
} from "@algocove/application";
import {
  reviewWindow,
  reviewTiming,
  gradeReviewedQuestions,
  parseReviewedQuestions,
  type MasteryEvidence,
  type MasteryProjection,
  type Instant,
  type OpaqueId,
} from "@algocove/domain";
import { withTransaction, type Transaction } from "./transaction.ts";
import {
  lockStudyOwner,
  parsedId,
  sourceInstant,
  replayLearning,
  persistLearning,
  sourceDigest,
  PostgresExplanationRepository,
} from "./learning-source-repository.ts";

type ReviewRow = {
  review_id: string;
  learner_id: string;
  concept_id: string;
  origin_observation_id: string;
  origin_problem_version_id: string;
  origin_attempt_id: string;
  origin_at: Date;
  evidence_watermark: string;
  policy_version: number;
  due_start: Date;
  due_end: Date;
  status: ReviewQueueItem["status"];
  completed_observation_id: string | null;
};
type ExerciseRow = {
  exercise_id: string;
  title: string;
  kind: "recall" | "transfer";
  questions: unknown;
  rubric_version: number;
};
async function selectExercise(
  db: Pick<Transaction, "query">,
  row: ReviewRow,
  now: Instant,
): Promise<ExerciseRow | null> {
  if (row.completed_observation_id !== null) {
    const original = await db.query<ExerciseRow>(
      "SELECT e.* FROM content.review_exercise e JOIN practice.learning_observation o ON o.facts->>'exerciseId'=e.exercise_id WHERE o.observation_id=$1",
      [row.completed_observation_id],
    );
    return original.rows[0] ?? null;
  }
  const result = await db.query<ExerciseRow>(
    `SELECT e.* FROM content.review_exercise e WHERE e.concept_id=$1 AND e.status='published' AND (e.rights_expires_at IS NULL OR e.rights_expires_at>$3) ORDER BY CASE WHEN e.kind='transfer' AND NOT EXISTS(SELECT 1 FROM practice.learning_observation o WHERE o.learner_id=$2 AND o.facts->>'exerciseId'=e.exercise_id) THEN 0 ELSE 1 END,e.exercise_id LIMIT 1`,
    [row.concept_id, row.learner_id, now],
  );
  return result.rows[0] ?? null;
}
function publicExercise(row: ExerciseRow): ReviewExercise {
  return {
    exerciseId: row.exercise_id,
    title: row.title,
    kind: row.kind,
    rubricVersion: row.rubric_version,
    questions: parseReviewedQuestions(row.questions).map(({ id, prompt, options }) => ({
      id,
      prompt,
      options,
    })),
  };
}
export async function reconcileReview(
  tx: Transaction,
  input: {
    evidence: MasteryEvidence;
    projection: MasteryProjection;
    eventId: OpaqueId<"event">;
    now: Instant;
  },
): Promise<void> {
  const e = input.evidence;
  const completed = await tx.query<{ review_id: string }>(
    "UPDATE mastery.review_item SET status='completed' WHERE learner_id=$1 AND completed_observation_id=$2 AND status='awaiting_projection' RETURNING review_id",
    [e.learnerId, e.observationId],
  );
  if (completed.rows[0] !== undefined)
    await tx.query(
      "INSERT INTO mastery.review_event(event_id,review_id,learner_id,kind,occurred_at) VALUES($1,$2,$3,'completed',$4) ON CONFLICT DO NOTHING",
      [
        parsedId(
          "event",
          `evt_${createHash("sha256").update(`${completed.rows[0].review_id}:${e.observationId}:completed`).digest("hex").slice(0, 40)}`,
        ),
        completed.rows[0].review_id,
        e.learnerId,
        input.now,
      ],
    );
  if (
    e.sourceKind === "structured_explanation" ||
    ["compile_error", "type_error", "infrastructure_error", "cancelled"].includes(e.outcome)
  )
    return;
  const latest = await tx.query<{ observation_id: string }>(
    `SELECT observation_id FROM mastery.evidence WHERE learner_id=$1 AND concept_id=$2 AND source_kind<>'structured_explanation' AND facts->>'provenance' IN ('server_observed_test','structured_check','human_reviewed') AND facts->>'outcome' NOT IN ('compile_error','type_error','infrastructure_error','cancelled') ORDER BY observed_at DESC,observation_id DESC LIMIT 1`,
    [e.learnerId, e.conceptId],
  );
  if (latest.rows[0]?.observation_id !== e.observationId) return;
  const key = [e.learnerId, e.conceptId, input.projection.evidenceWatermark, 1].join(":");
  const reviewId = parsedId(
    "event",
    `evt_${createHash("sha256").update(key).digest("hex").slice(0, 40)}`,
  );
  const exists = await tx.query(
    "SELECT 1 FROM mastery.review_item WHERE review_id=$1 OR (learner_id=$2 AND concept_id=$3 AND origin_observation_id=$4 AND policy_version=1)",
    [reviewId, e.learnerId, e.conceptId, e.observationId],
  );
  if (exists.rowCount !== 0) return;
  const superseded = await tx.query<{ review_id: string }>(
    "UPDATE mastery.review_item SET status='superseded' WHERE learner_id=$1 AND concept_id=$2 AND status IN ('due','deferred') RETURNING review_id",
    [e.learnerId, e.conceptId],
  );
  for (const old of superseded.rows) {
    const eventId = parsedId(
      "event",
      `evt_${createHash("sha256").update(`${old.review_id}:${reviewId}:superseded`).digest("hex").slice(0, 40)}`,
    );
    await tx.query(
      "INSERT INTO mastery.review_event(event_id,review_id,learner_id,kind,occurred_at,metadata) VALUES($1,$2,$3,'superseded',$4,$5::jsonb)",
      [
        eventId,
        old.review_id,
        e.learnerId,
        input.now,
        JSON.stringify({ replacementReviewId: reviewId }),
      ],
    );
  }
  const window = reviewWindow(e.observedAt, input.projection.band);
  await tx.query(
    `INSERT INTO mastery.review_item(review_id,learner_id,concept_id,origin_observation_id,origin_problem_version_id,origin_attempt_id,origin_at,evidence_watermark,policy_version,due_start,due_end,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'due')`,
    [
      reviewId,
      e.learnerId,
      e.conceptId,
      e.observationId,
      e.problemVersionId,
      e.attemptId,
      e.observedAt,
      input.projection.evidenceWatermark,
      window.policyVersion,
      window.dueStart,
      window.dueEnd,
    ],
  );
  await tx.query(
    "INSERT INTO mastery.review_event(event_id,review_id,learner_id,kind,occurred_at) VALUES($1,$1,$2,'scheduled',$3)",
    [reviewId, e.learnerId, input.now],
  );
  const event = createOutboxEvent({
    eventId: reviewId,
    topic: "mastery.review.scheduled",
    aggregateId: e.conceptId,
    occurredAt: input.now,
    payload: {
      reviewId,
      learnerId: e.learnerId,
      conceptId: e.conceptId,
      evidenceWatermark: input.projection.evidenceWatermark,
      policyVersion: 1,
      dueStart: window.dueStart,
      dueEnd: window.dueEnd,
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
}
export class PostgresReviewRepository implements LearningReviewRepository {
  private readonly pool: Pool;
  private readonly explanation: PostgresExplanationRepository;
  constructor(pool: Pool) {
    this.pool = pool;
    this.explanation = new PostgresExplanationRepository(pool);
  }
  observeExplanation(
    input: Parameters<LearningReviewRepository["observeExplanation"]>[0],
  ): Promise<LearningObservationReceipt> {
    return this.explanation.observeExplanation(input);
  }
  async listReviews(
    input: Parameters<LearningReviewRepository["listReviews"]>[0],
  ): Promise<readonly ReviewQueueItem[]> {
    return withTransaction(
      this.pool,
      async (tx) => {
        const profile = await tx.query<{ timezone: string }>(
          "SELECT timezone FROM platform.learner_profile WHERE learner_id=$1",
          [input.learnerId],
        );
        const timezone = profile.rows[0]?.timezone ?? "UTC";
        const rows = await tx.query<ReviewRow>(
          "SELECT * FROM mastery.review_item WHERE learner_id=$1 AND status<>'superseded' ORDER BY due_start,review_id",
          [input.learnerId],
        );
        const result: ReviewQueueItem[] = [];
        for (const row of rows.rows) {
          const exercise = await selectExercise(tx, row, input.now);
          const item = {
            reviewId: parsedId("event", row.review_id),
            learnerId: parsedId("learner", row.learner_id),
            conceptId: parsedId("concept", row.concept_id),
            originObservationId: parsedId("event", row.origin_observation_id),
            originProblemVersionId: parsedId("problemVersion", row.origin_problem_version_id),
            evidenceWatermark: row.evidence_watermark,
            policyVersion: row.policy_version,
            dueStart: sourceInstant(row.due_start),
            dueEnd: sourceInstant(row.due_end),
            status: row.status,
            completedObservationId:
              row.completed_observation_id === null
                ? null
                : parsedId("event", row.completed_observation_id),
          };
          result.push({
            ...item,
            timing: reviewTiming(item, input.now),
            exercise: exercise === null ? null : publicExercise(exercise),
            timezone,
          });
        }
        return result;
      },
      { isolationLevel: "repeatable read", readOnly: true },
    );
  }
  async answerReview(
    input: Parameters<LearningReviewRepository["answerReview"]>[0],
  ): Promise<LearningObservationReceipt> {
    return withTransaction(this.pool, async (tx) => {
      await lockStudyOwner(tx, input.learnerId);
      const key = input.reviewId,
        digest = sourceDigest([
          input.exerciseId,
          Object.entries(input.answers).sort(),
          input.confidence,
        ]);
      const replay = await replayLearning(tx, input.learnerId, "review", key, digest);
      if (replay !== null) return replay;
      const rows = await tx.query<ReviewRow>(
        "SELECT * FROM mastery.review_item WHERE review_id=$1 AND learner_id=$2 FOR UPDATE",
        [input.reviewId, input.learnerId],
      );
      const row = rows.rows[0];
      if (row === undefined) throw notFoundError("Review is unavailable.");
      if (!["due", "deferred"].includes(row.status))
        throw conflictError("This review is no longer accepting answers.");
      if (Date.parse(input.now) < row.due_start.getTime())
        throw validationError("This review is not due yet.");
      const exercise = await selectExercise(tx, row, input.now);
      if (exercise === null || exercise.exercise_id !== input.exerciseId)
        throw notFoundError("Reviewed exercise is unavailable. Refresh the review queue.");
      // Protect publication/retirement through the grade and observation commit.
      const eligible = await tx.query(
        "SELECT 1 FROM content.review_exercise WHERE exercise_id=$1 AND status='published' AND (rights_expires_at IS NULL OR rights_expires_at>$2) FOR SHARE",
        [exercise.exercise_id, input.now],
      );
      if (eligible.rowCount === 0) throw notFoundError("Review exercise has been retired.");
      let correct: boolean;
      try {
        correct = gradeReviewedQuestions(parseReviewedQuestions(exercise.questions), input.answers);
      } catch {
        throw validationError("Select one offered answer for every review question.");
      }
      const seen = await tx.query(
        "SELECT 1 FROM practice.learning_observation WHERE learner_id=$1 AND facts->>'exerciseId'=$2 LIMIT 1",
        [input.learnerId, exercise.exercise_id],
      );
      const transfer = exercise.kind === "transfer" && seen.rowCount === 0;
      const attempt = await tx.query<{ language: MasteryEvidence["language"] }>(
        "SELECT language FROM practice.attempt WHERE attempt_id=$1 AND learner_id=$2",
        [row.origin_attempt_id, input.learnerId],
      );
      if (attempt.rows[0] === undefined) throw notFoundError("Review origin is unavailable.");
      const fact: MasteryEvidence = {
        sourceKind: "review",
        exerciseId: exercise.exercise_id,
        sourceEventId: input.eventId,
        observationId: input.observationId,
        learnerId: input.learnerId,
        conceptId: parsedId("concept", row.concept_id),
        attemptId: parsedId("attempt", row.origin_attempt_id),
        problemVersionId: parsedId("problemVersion", row.origin_problem_version_id),
        language: attempt.rows[0].language,
        observedAt: input.now,
        provenance: "structured_check",
        rubricVersion: `${exercise.exercise_id}/v${exercise.rubric_version}`,
        evidencePolicyVersion: 1,
        outcome: correct ? "pass" : "wrong_answer",
        correct,
        assistanceTier: 0,
        explanationCorrect: correct,
        explanationProvenance: "structured_check",
        confidence: input.confidence,
        confidenceProvenance: input.confidence === null ? null : "learner_reported",
        delayMs: Date.parse(input.now) - row.origin_at.getTime(),
        transfer,
        transferProvenance: "structured_check",
      };
      const receipt = await persistLearning(tx, fact, key, digest);
      await tx.query(
        "UPDATE mastery.review_item SET status='awaiting_projection',completed_observation_id=$3 WHERE review_id=$1 AND learner_id=$2",
        [input.reviewId, input.learnerId, receipt.observationId],
      );
      await tx.query(
        "INSERT INTO mastery.review_event(event_id,review_id,learner_id,kind,occurred_at,metadata) VALUES($1,$2,$3,'answered',$4,$5::jsonb)",
        [
          input.eventId,
          input.reviewId,
          input.learnerId,
          input.now,
          JSON.stringify({
            observationId: receipt.observationId,
            exerciseId: exercise.exercise_id,
          }),
        ],
      );
      return receipt;
    });
  }
  async deferReview(input: Parameters<LearningReviewRepository["deferReview"]>[0]): Promise<void> {
    await withTransaction(this.pool, async (tx) => {
      await lockStudyOwner(tx, input.learnerId);
      const rows = await tx.query<ReviewRow>(
        "SELECT * FROM mastery.review_item WHERE review_id=$1 AND learner_id=$2 FOR UPDATE",
        [input.reviewId, input.learnerId],
      );
      const row = rows.rows[0];
      if (row === undefined) throw notFoundError("Review is unavailable.");
      if (!["due", "deferred"].includes(row.status))
        throw conflictError("Only open reviews can be deferred.");
      if (sourceInstant(row.due_start) === input.until && row.status === "deferred") return;
      if (
        Date.parse(input.until) <= Date.parse(input.now) ||
        Date.parse(input.until) > Date.parse(input.now) + 30 * 86400000
      )
        throw validationError("Invalid defer window.");
      const end = new Date(Date.parse(input.until) + 86400000).toISOString();
      await tx.query(
        "UPDATE mastery.review_item SET due_start=$3,due_end=$4,status='deferred' WHERE review_id=$1 AND learner_id=$2",
        [input.reviewId, input.learnerId, input.until, end],
      );
      const metadata = {
        priorStart: sourceInstant(row.due_start),
        priorEnd: sourceInstant(row.due_end),
        until: input.until,
        policyVersion: 1,
      };
      await tx.query(
        "INSERT INTO mastery.review_event(event_id,review_id,learner_id,kind,occurred_at,metadata) VALUES($1,$2,$3,'deferred',$4,$5::jsonb)",
        [input.eventId, input.reviewId, input.learnerId, input.now, JSON.stringify(metadata)],
      );
      await tx.query(
        "INSERT INTO platform.outbox_event(event_id,topic,aggregate_id,payload,occurred_at) VALUES($1,'mastery.review.deferred',$2,$3::jsonb,$4)",
        [input.eventId, input.reviewId, JSON.stringify(metadata), input.now],
      );
    });
  }
}
