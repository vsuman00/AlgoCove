import type { Pool, QueryResultRow } from "pg";
import type { HintRepository } from "@algocove/application";
import {
  HINT_LADDER,
  parseId,
  parseInstant,
  type AuthoredHint,
  type HintExposure,
  type HintTier,
  type LearningAttempt,
  type ProblemVersionId,
} from "@algocove/domain";
import { PostgresPracticeRepository } from "./practice-repository.ts";

type HintRow = QueryResultRow & {
  problem_version_id: string;
  hint_id: string;
  tier: string | number;
  kind: string;
  body: string;
};

type ExposureRow = QueryResultRow & {
  exposure_id: string;
  learner_id: string;
  attempt_id: string;
  problem_version_id: string;
  hint_id: string;
  tier: string | number;
  idempotency_key: string;
  exposed_at: Date | string;
};

function tier(value: string | number): HintTier {
  const parsed = typeof value === "number" ? value : Number(value);
  const entry = HINT_LADDER.find((candidate) => candidate.tier === parsed);
  if (entry === undefined) throw new Error("Database hint tier violates the hint contract.");
  return entry.tier;
}

function instant(value: Date | string): HintExposure["exposedAt"] {
  const parsed = parseInstant(value instanceof Date ? value : new Date(value));
  if (!parsed.ok) throw new Error("Database hint timestamp violates the instant contract.");
  return parsed.value;
}

function id<TKind extends Parameters<typeof parseId>[0]>(kind: TKind, value: string) {
  const parsed = parseId(kind, value);
  if (!parsed.ok) throw new Error(`Database hint ${kind} violates the identifier contract.`);
  return parsed.value;
}

function authoredHint(row: HintRow): AuthoredHint {
  const ladder = HINT_LADDER.find((entry) => entry.tier === tier(row.tier));
  if (ladder === undefined || ladder.name !== row.kind) {
    throw new Error("Database authored hint kind violates the hint contract.");
  }
  return {
    problemVersionId: id("problemVersion", row.problem_version_id),
    hintId: row.hint_id,
    tier: ladder.tier,
    kind: ladder.name,
    body: row.body,
  };
}

function exposure(row: ExposureRow): HintExposure {
  return {
    exposureId: id("event", row.exposure_id),
    learnerId: id("learner", row.learner_id),
    attemptId: id("attempt", row.attempt_id),
    problemVersionId: id("problemVersion", row.problem_version_id),
    hintId: row.hint_id,
    tier: tier(row.tier),
    idempotencyKey: row.idempotency_key,
    exposedAt: instant(row.exposed_at),
  };
}

export class PostgresHintRepository implements HintRepository {
  private readonly pool: Pool;
  private readonly practice: PostgresPracticeRepository;

  constructor(pool: Pool) {
    this.pool = pool;
    this.practice = new PostgresPracticeRepository(pool);
  }

  getAttempt(
    attemptId: LearningAttempt["attemptId"],
    learnerId: LearningAttempt["learnerId"],
  ): Promise<LearningAttempt | null> {
    return this.practice.getAttempt(attemptId, learnerId);
  }

  async getAuthoredHint(input: {
    readonly problemVersionId: ProblemVersionId;
    readonly hintId: string;
  }): Promise<AuthoredHint | null> {
    const result = await this.pool.query<HintRow>(
      `SELECT problem_version_id, hint_id, tier, kind, body
         FROM content.problem_hint
        WHERE problem_version_id = $1 AND hint_id = $2`,
      [input.problemVersionId, input.hintId],
    );
    const row = result.rows[0];
    return row === undefined ? null : authoredHint(row);
  }

  async getExposureByIdempotency(input: {
    readonly learnerId: LearningAttempt["learnerId"];
    readonly idempotencyKey: string;
  }): Promise<HintExposure | null> {
    const result = await this.pool.query<ExposureRow>(
      `SELECT exposure_id, learner_id, attempt_id, problem_version_id, hint_id, tier,
              idempotency_key, exposed_at
         FROM practice.hint_exposure
        WHERE learner_id = $1 AND idempotency_key = $2`,
      [input.learnerId, input.idempotencyKey],
    );
    const row = result.rows[0];
    return row === undefined ? null : exposure(row);
  }

  async getHighestExposedTier(input: {
    readonly learnerId: LearningAttempt["learnerId"];
    readonly problemVersionId: ProblemVersionId;
  }): Promise<number> {
    const result = await this.pool.query<{ max_tier: string | number | null }>(
      `SELECT MAX(tier) AS max_tier
         FROM practice.hint_exposure
        WHERE learner_id = $1 AND problem_version_id = $2`,
      [input.learnerId, input.problemVersionId],
    );
    const value = result.rows[0]?.max_tier;
    return value === null || value === undefined ? 0 : tier(value);
  }

  async saveExposure(value: HintExposure): Promise<HintExposure | null> {
    const result = await this.pool.query<ExposureRow>(
      `INSERT INTO practice.hint_exposure
        (exposure_id, learner_id, attempt_id, problem_version_id, hint_id, tier,
         idempotency_key, exposed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (learner_id, idempotency_key) DO NOTHING
       RETURNING exposure_id, learner_id, attempt_id, problem_version_id, hint_id, tier,
                 idempotency_key, exposed_at`,
      [
        value.exposureId,
        value.learnerId,
        value.attemptId,
        value.problemVersionId,
        value.hintId,
        value.tier,
        value.idempotencyKey,
        value.exposedAt,
      ],
    );
    const row = result.rows[0];
    return row === undefined ? null : exposure(row);
  }
}
