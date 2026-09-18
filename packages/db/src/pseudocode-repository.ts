import type { Pool, QueryResultRow } from "pg";
import type { PseudocodeRepository } from "@algocove/application";
import {
  PSEUDOCODE_FIELDS,
  PROBLEM_LANGUAGES,
  parseId,
  parseInstant,
  type PseudocodeArtifact,
  type PseudocodeFields,
  type PseudocodeId,
  type PseudocodeRevision,
  type LearningAttempt,
} from "@algocove/domain";
import { withTransaction, type Transaction } from "./transaction.ts";
import { PostgresPracticeRepository } from "./practice-repository.ts";

type ArtifactRow = QueryResultRow & {
  pseudocode_id: string;
  attempt_id: string;
  learner_id: string;
  problem_version_id: string;
  manifest_id: string;
  language: string;
  current_fields: unknown;
  current_revision: string | number;
  saved_revision: string | number;
  version: string | number;
  updated_at: Date | string;
};

type RevisionRow = QueryResultRow & {
  pseudocode_id: string;
  learner_id: string;
  attempt_id: string;
  problem_version_id: string;
  manifest_id: string;
  language: string;
  revision: string | number;
  fields: unknown;
  saved_at: Date | string;
};

const ARTIFACT_COLUMNS = `pseudocode_id, attempt_id, learner_id, problem_version_id,
  manifest_id, language, current_fields, current_revision, saved_revision, version, updated_at`;

function positiveInteger(value: string | number, field: string, allowZero = false): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || (allowZero ? parsed < 0 : parsed < 1)) {
    throw new Error(`Database ${field} violates the pseudocode contract.`);
  }
  return parsed;
}

function instant(value: Date | string): PseudocodeArtifact["updatedAt"] {
  const parsed = parseInstant(value instanceof Date ? value : new Date(value));
  if (!parsed.ok) throw new Error("Database pseudocode timestamp violates the instant contract.");
  return parsed.value;
}

function id<TKind extends Parameters<typeof parseId>[0]>(kind: TKind, value: string) {
  const parsed = parseId(kind, value);
  if (!parsed.ok) throw new Error(`Database pseudocode ${kind} violates the identifier contract.`);
  return parsed.value;
}

function oneOf<TValue extends string>(
  values: readonly TValue[],
  value: string,
  field: string,
): TValue {
  if (!values.includes(value as TValue))
    throw new Error(`Database pseudocode ${field} is invalid.`);
  return value as TValue;
}

function fields(value: unknown): PseudocodeFields {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Database pseudocode fields are not an object.");
  }
  const record = value as Record<string, unknown>;
  const result = {} as Record<(typeof PSEUDOCODE_FIELDS)[number], string>;
  for (const field of PSEUDOCODE_FIELDS) {
    if (typeof record[field] !== "string")
      throw new Error(`Database pseudocode ${field} is invalid.`);
    result[field] = record[field];
  }
  return result;
}

function artifactFromRow(row: ArtifactRow): PseudocodeArtifact {
  return {
    pseudocodeId: id("pseudocode", row.pseudocode_id),
    attemptId: id("attempt", row.attempt_id),
    learnerId: id("learner", row.learner_id),
    problemVersionId: id("problemVersion", row.problem_version_id),
    manifestId: id("languageManifest", row.manifest_id),
    language: oneOf(PROBLEM_LANGUAGES, row.language, "language"),
    current: fields(row.current_fields),
    currentRevision: positiveInteger(row.current_revision, "current revision", true),
    savedRevision: positiveInteger(row.saved_revision, "saved revision", true),
    version: positiveInteger(row.version, "version"),
    updatedAt: instant(row.updated_at),
  };
}

function revisionFromRow(row: RevisionRow): PseudocodeRevision {
  return {
    pseudocodeId: id("pseudocode", row.pseudocode_id),
    learnerId: id("learner", row.learner_id),
    attemptId: id("attempt", row.attempt_id),
    problemVersionId: id("problemVersion", row.problem_version_id),
    manifestId: id("languageManifest", row.manifest_id),
    language: oneOf(PROBLEM_LANGUAGES, row.language, "language"),
    revision: positiveInteger(row.revision, "revision"),
    fields: fields(row.fields),
    savedAt: instant(row.saved_at),
  };
}

export class PostgresPseudocodeRepository implements PseudocodeRepository {
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

  async createPseudocode(artifact: PseudocodeArtifact): Promise<PseudocodeArtifact> {
    const result = await this.pool.query<ArtifactRow>(
      `INSERT INTO practice.pseudocode_artifact
        (pseudocode_id, attempt_id, learner_id, problem_version_id, manifest_id, language,
         current_fields, current_revision, saved_revision, version, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11)
       RETURNING ${ARTIFACT_COLUMNS}`,
      [
        artifact.pseudocodeId,
        artifact.attemptId,
        artifact.learnerId,
        artifact.problemVersionId,
        artifact.manifestId,
        artifact.language,
        JSON.stringify(artifact.current),
        artifact.currentRevision,
        artifact.savedRevision,
        artifact.version,
        artifact.updatedAt,
      ],
    );
    const row = result.rows[0];
    if (row === undefined) throw new Error("Database did not return the pseudocode artifact.");
    return artifactFromRow(row);
  }

  async getPseudocode(
    pseudocodeId: PseudocodeId,
    learnerId: LearningAttempt["learnerId"],
  ): Promise<PseudocodeArtifact | null> {
    const result = await this.pool.query<ArtifactRow>(
      `SELECT ${ARTIFACT_COLUMNS} FROM practice.pseudocode_artifact
       WHERE pseudocode_id = $1 AND learner_id = $2`,
      [pseudocodeId, learnerId],
    );
    const row = result.rows[0];
    return row === undefined ? null : artifactFromRow(row);
  }

  async findPseudocodeByAttempt(input: {
    readonly attemptId: LearningAttempt["attemptId"];
    readonly learnerId: LearningAttempt["learnerId"];
  }): Promise<PseudocodeArtifact | null> {
    const result = await this.pool.query<ArtifactRow>(
      `SELECT ${ARTIFACT_COLUMNS} FROM practice.pseudocode_artifact
        WHERE attempt_id = $1 AND learner_id = $2
        ORDER BY updated_at DESC, pseudocode_id DESC
        LIMIT 1`,
      [input.attemptId, input.learnerId],
    );
    const row = result.rows[0];
    return row === undefined ? null : artifactFromRow(row);
  }

  async replaceCurrentPseudocode(input: {
    readonly artifact: PseudocodeArtifact;
    readonly expectedVersion: number;
  }): Promise<PseudocodeArtifact | null> {
    const result = await this.pool.query<ArtifactRow>(
      `UPDATE practice.pseudocode_artifact
          SET current_fields = $3::jsonb, current_revision = $4, version = $5, updated_at = $6
        WHERE pseudocode_id = $1 AND learner_id = $2 AND version = $7
       RETURNING ${ARTIFACT_COLUMNS}`,
      [
        input.artifact.pseudocodeId,
        input.artifact.learnerId,
        JSON.stringify(input.artifact.current),
        input.artifact.currentRevision,
        input.artifact.version,
        input.artifact.updatedAt,
        input.expectedVersion,
      ],
    );
    const row = result.rows[0];
    return row === undefined ? null : artifactFromRow(row);
  }

  async savePseudocodeRevision(input: {
    readonly artifact: PseudocodeArtifact;
    readonly revision: PseudocodeRevision;
    readonly expectedVersion: number;
  }): Promise<PseudocodeArtifact | null> {
    return withTransaction(this.pool, async (transaction) => {
      const current = await oneArtifact(
        transaction,
        input.artifact.pseudocodeId,
        input.artifact.learnerId,
        true,
      );
      if (current === null || current.version !== input.expectedVersion) return null;
      await transaction.query(
        `INSERT INTO practice.pseudocode_revision
          (pseudocode_id, learner_id, attempt_id, problem_version_id, manifest_id, language,
           revision, fields, saved_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
        [
          input.revision.pseudocodeId,
          input.revision.learnerId,
          input.revision.attemptId,
          input.revision.problemVersionId,
          input.revision.manifestId,
          input.revision.language,
          input.revision.revision,
          JSON.stringify(input.revision.fields),
          input.revision.savedAt,
        ],
      );
      const result = await transaction.query<ArtifactRow>(
        `UPDATE practice.pseudocode_artifact
            SET saved_revision = $3, version = $4, updated_at = $5
          WHERE pseudocode_id = $1 AND learner_id = $2 AND version = $6
         RETURNING ${ARTIFACT_COLUMNS}`,
        [
          input.artifact.pseudocodeId,
          input.artifact.learnerId,
          input.artifact.savedRevision,
          input.artifact.version,
          input.artifact.updatedAt,
          input.expectedVersion,
        ],
      );
      const row = result.rows[0];
      return row === undefined ? null : artifactFromRow(row);
    });
  }

  async listPseudocodeRevisions(
    pseudocodeId: PseudocodeId,
    learnerId: LearningAttempt["learnerId"],
  ): Promise<readonly PseudocodeRevision[]> {
    const result = await this.pool.query<RevisionRow>(
      `SELECT pseudocode_id, learner_id, attempt_id, problem_version_id, manifest_id,
              language, revision, fields, saved_at
         FROM practice.pseudocode_revision
        WHERE pseudocode_id = $1 AND learner_id = $2
        ORDER BY revision DESC`,
      [pseudocodeId, learnerId],
    );
    return result.rows.map(revisionFromRow);
  }

  async deleteLearnerPseudocode(learnerId: LearningAttempt["learnerId"]): Promise<void> {
    await this.pool.query("DELETE FROM practice.pseudocode_artifact WHERE learner_id = $1", [
      learnerId,
    ]);
  }
}

async function oneArtifact(
  database: Transaction,
  pseudocodeId: PseudocodeId,
  learnerId: LearningAttempt["learnerId"],
  lock: boolean,
): Promise<PseudocodeArtifact | null> {
  const result = await database.query<ArtifactRow>(
    `SELECT ${ARTIFACT_COLUMNS} FROM practice.pseudocode_artifact
      WHERE pseudocode_id = $1 AND learner_id = $2${lock ? " FOR UPDATE" : ""}`,
    [pseudocodeId, learnerId],
  );
  const row = result.rows[0];
  return row === undefined ? null : artifactFromRow(row);
}
