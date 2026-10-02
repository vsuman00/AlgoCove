import { createHash } from "node:crypto";
import type { Pool } from "pg";
import {
  createOutboxEvent,
  conflictError,
  type MasteryRepository,
  type MasteryConceptSource,
  type MasteryCommit,
  type MasteryView,
} from "@algocove/application";
import {
  parseId,
  parseMasteryEvidence,
  projectMastery,
  type ConceptId,
  type Instant,
  type LearnerId,
  type MasteryEvidence,
  type MasteryPolicy,
  type MasteryProjection,
  type OpaqueId,
  type ProblemVersionId,
} from "@algocove/domain";
import { withTransaction, type Transaction } from "./transaction.ts";

/** Learning-owned, version-pinned read port. Draft mappings cannot award credit. */
export class PostgresMasteryConceptSource implements MasteryConceptSource {
  private readonly pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }
  async getConcepts(problemVersionId: ProblemVersionId): Promise<readonly ConceptId[]> {
    const rows = await this.pool.query<{ concept_id: string }>(
      `SELECT m.concept_id FROM learning.problem_concept m
      JOIN content.problem_version p USING (problem_version_id)
      JOIN content.content_version v ON v.content_version_id=p.content_version_id
      WHERE m.problem_version_id=$1 AND v.status IN ('published','retired') ORDER BY m.concept_id`,
      [problemVersionId],
    );
    return rows.rows.map((row) => {
      const parsed = parseId("concept", row.concept_id);
      if (!parsed.ok) throw new Error("Invalid persisted concept identifier.");
      return parsed.value;
    });
  }
}

export class PostgresMasteryRepository implements MasteryRepository {
  private readonly pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }

  async recordAndProject(input: {
    readonly evidence: readonly MasteryEvidence[];
    readonly policy: MasteryPolicy;
    readonly ingestedAt: Instant;
    readonly updateEventIds: readonly OpaqueId<"event">[];
  }): Promise<MasteryCommit> {
    const first = input.evidence[0];
    if (first === undefined || input.updateEventIds.length !== input.evidence.length)
      throw new Error("Mastery commit requires source facts and projection event identifiers.");
    const concepts = new Set<ConceptId>();
    for (const fact of input.evidence) {
      const parsed = parseMasteryEvidence(fact);
      if (
        !parsed.ok ||
        fact.learnerId !== first.learnerId ||
        fact.observationId !== first.observationId ||
        fact.sourceEventId !== first.sourceEventId ||
        concepts.has(fact.conceptId)
      )
        throw new Error("Mastery commit has inconsistent source facts.");
      concepts.add(fact.conceptId);
    }
    return withTransaction(this.pool, async (tx) => {
      await lockLearner(tx, first.learnerId);
      await registerPolicy(tx, input.policy);
      let inserted = 0;
      const projections: MasteryProjection[] = [];
      for (let i = 0; i < input.evidence.length; i++) {
        const e = input.evidence[i]!;
        const result = await tx.query(
          `INSERT INTO mastery.evidence
          (observation_id,concept_id,learner_id,problem_version_id,source_event_id,evidence_policy_version,observed_at,ingested_at,facts)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) ON CONFLICT (observation_id,concept_id) DO NOTHING`,
          [
            e.observationId,
            e.conceptId,
            e.learnerId,
            e.problemVersionId,
            e.sourceEventId,
            e.evidencePolicyVersion,
            e.observedAt,
            input.ingestedAt,
            JSON.stringify(e),
          ],
        );
        inserted += result.rowCount ?? 0;
        if (result.rowCount === 0) {
          const existing = await tx.query<{ facts: unknown }>(
            "SELECT facts FROM mastery.evidence WHERE observation_id=$1 AND concept_id=$2",
            [e.observationId, e.conceptId],
          );
          const stored = parseFact(existing.rows[0]?.facts);
          // Another persisted event may reference the same observation. It is
          // still one piece of evidence, and all observation facts must match.
          if (
            JSON.stringify({ ...stored, sourceEventId: e.sourceEventId }) !==
            JSON.stringify(parseFact(e))
          )
            throw conflictError("Assessment evidence was already recorded with different facts.");
        }
        const projection = await rebuildScope(tx, e.learnerId, e.conceptId, input.policy);
        projections.push(projection);
        const changed = await saveProjection(tx, projection);
        if (changed) {
          const event = createOutboxEvent({
            eventId: input.updateEventIds[i]!,
            topic: "mastery.projection.updated",
            aggregateId: e.conceptId,
            occurredAt: input.ingestedAt,
            payload: {
              learnerId: e.learnerId,
              conceptId: e.conceptId,
              band: projection.band,
              policyVersion: projection.policyVersion,
              evidenceWatermark: projection.evidenceWatermark,
            },
          });
          await tx.query(
            "INSERT INTO platform.outbox_event (event_id,topic,aggregate_id,payload,occurred_at) VALUES ($1,$2,$3,$4::jsonb,$5)",
            [
              event.eventId,
              event.topic,
              event.aggregateId,
              JSON.stringify(event.payload),
              event.occurredAt,
            ],
          );
        }
      }
      return { disposition: inserted === 0 ? "replayed" : "committed", projections };
    });
  }

  async rebuild(input: {
    readonly learnerId: LearnerId;
    readonly conceptId: ConceptId;
    readonly policy: MasteryPolicy;
  }): Promise<MasteryProjection> {
    return withTransaction(this.pool, async (tx) => {
      await lockLearner(tx, input.learnerId);
      await registerPolicy(tx, input.policy);
      const projection = await rebuildScope(tx, input.learnerId, input.conceptId, input.policy);
      await saveProjection(tx, projection);
      return projection;
    });
  }

  async readView(input: {
    readonly learnerId: LearnerId;
    readonly conceptId: ConceptId;
    readonly policyVersion: number;
    readonly afterObservationId?: OpaqueId<"event">;
  }): Promise<MasteryView | null> {
    return withTransaction(
      this.pool,
      async (tx) => {
        const concept = await tx.query("SELECT 1 FROM learning.concept WHERE concept_id=$1", [
          input.conceptId,
        ]);
        if (concept.rowCount === 0) return null;
        if (input.afterObservationId !== undefined) {
          const owned = await tx.query(
            `SELECT 1 FROM practice.assessment_observation o JOIN learning.problem_concept m USING(problem_version_id)
          WHERE o.observation_id=$1 AND o.learner_id=$2 AND m.concept_id=$3`,
            [input.afterObservationId, input.learnerId, input.conceptId],
          );
          if (owned.rowCount === 0) return null;
        }
        const result = await tx.query<{ body: MasteryProjection }>(
          "SELECT body FROM mastery.projection WHERE learner_id=$1 AND concept_id=$2 AND policy_version=$3",
          [input.learnerId, input.conceptId, input.policyVersion],
        );
        const evidence = await tx.query<{ count: number; consumed: boolean }>(
          `SELECT count(*)::integer AS count,
        COALESCE(bool_or(observation_id=$3),false) AS consumed FROM mastery.evidence WHERE learner_id=$1 AND concept_id=$2`,
          [input.learnerId, input.conceptId, input.afterObservationId ?? null],
        );
        const policy = await tx.query<{ require_validated_explanation: boolean }>(
          "SELECT require_validated_explanation FROM mastery.policy_version WHERE policy_version=$1",
          [input.policyVersion],
        );
        if (policy.rows[0] === undefined) throw new Error("Mastery policy is unavailable.");
        const empty = projectMastery({
          learnerId: input.learnerId,
          conceptId: input.conceptId,
          evidence: [],
          policy: {
            version: input.policyVersion,
            requireValidatedExplanation: policy.rows[0].require_validated_explanation,
          },
        });
        if (!empty.ok) throw new Error(empty.error.message);
        const projection = result.rows[0]?.body ?? empty.value;
        if (
          projection.learnerId !== input.learnerId ||
          projection.conceptId !== input.conceptId ||
          projection.policyVersion !== input.policyVersion
        )
          throw new Error("Mastery projection scope is invalid.");
        const snapshot = evidence.rows[0]!;
        const pending =
          projection.evidenceCount !== snapshot.count ||
          (input.afterObservationId !== undefined && !snapshot.consumed);
        return { status: pending ? "projection_pending" : "ready", projection };
      },
      { isolationLevel: "repeatable read", readOnly: true },
    );
  }
}

function parseFact(value: unknown): MasteryEvidence {
  const result = parseMasteryEvidence(value);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
async function lockLearner(tx: Transaction, learnerId: LearnerId) {
  const row = await tx.query(
    "SELECT learner_id FROM platform.learner WHERE learner_id=$1 FOR NO KEY UPDATE",
    [learnerId],
  );
  if (row.rowCount !== 1) throw new Error("Mastery learner is unavailable.");
}
async function registerPolicy(tx: Transaction, policy: MasteryPolicy) {
  if (
    !Number.isSafeInteger(policy.version) ||
    policy.version < 1 ||
    typeof policy.requireValidatedExplanation !== "boolean"
  )
    throw new Error("Invalid mastery policy definition.");
  await tx.query(
    "INSERT INTO mastery.policy_version (policy_version,require_validated_explanation) VALUES ($1,$2) ON CONFLICT DO NOTHING",
    [policy.version, policy.requireValidatedExplanation],
  );
  const row = await tx.query<{ require_validated_explanation: boolean }>(
    "SELECT require_validated_explanation FROM mastery.policy_version WHERE policy_version=$1",
    [policy.version],
  );
  if (row.rows[0]?.require_validated_explanation !== policy.requireValidatedExplanation)
    throw conflictError("Mastery policy version already has a different definition.");
}
async function rebuildScope(
  tx: Transaction,
  learnerId: LearnerId,
  conceptId: ConceptId,
  policy: MasteryPolicy,
): Promise<MasteryProjection> {
  const rows = await tx.query<{ facts: unknown }>(
    "SELECT facts FROM mastery.evidence WHERE learner_id=$1 AND concept_id=$2 ORDER BY observed_at,observation_id",
    [learnerId, conceptId],
  );
  const projected = projectMastery({
    learnerId,
    conceptId,
    policy,
    evidence: rows.rows.map((row) => parseFact(row.facts)),
  });
  if (!projected.ok) throw new Error(projected.error.message);
  return {
    ...projected.value,
    evidenceWatermark:
      projected.value.evidenceWatermark === "0"
        ? "0"
        : `sha256:${createHash("sha256").update(projected.value.evidenceWatermark).digest("hex")}`,
  };
}
async function saveProjection(tx: Transaction, projection: MasteryProjection): Promise<boolean> {
  const result = await tx.query(
    `INSERT INTO mastery.projection (learner_id,concept_id,policy_version,body) VALUES ($1,$2,$3,$4::jsonb)
    ON CONFLICT (learner_id,concept_id,policy_version) DO UPDATE SET body=EXCLUDED.body WHERE mastery.projection.body<>EXCLUDED.body RETURNING learner_id`,
    [
      projection.learnerId,
      projection.conceptId,
      projection.policyVersion,
      JSON.stringify(projection),
    ],
  );
  return result.rowCount === 1;
}
