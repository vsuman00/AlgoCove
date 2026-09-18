import type { Pool, QueryResultRow } from "pg";
import type { DraftRepository } from "@algocove/application";
import {
  DRAFT_KINDS,
  PROBLEM_LANGUAGES,
  parseId,
  parseInstant,
  type DraftId,
  type LearningAttempt,
  type PracticeDraft,
  type SavedDraftRevision,
} from "@algocove/domain";
import { withTransaction, type Transaction } from "./transaction.ts";
import { PostgresPracticeRepository } from "./practice-repository.ts";

type DraftRow = QueryResultRow & {
  draft_id: string;
  attempt_id: string;
  learner_id: string;
  problem_version_id: string;
  manifest_id: string;
  language: string;
  kind: string;
  current_text: string;
  current_revision: string | number;
  saved_revision: string | number;
  version: string | number;
  updated_at: Date | string;
  expires_at: Date | string;
  local_recovery_enabled: boolean;
};

type RevisionRow = QueryResultRow & {
  draft_id: string;
  attempt_id: string;
  learner_id: string;
  revision: string | number;
  kind: string;
  text: string;
  saved_at: Date | string;
  expires_at: Date | string;
};

const DRAFT_COLUMNS = `draft_id, attempt_id, learner_id, problem_version_id, manifest_id,
  language, kind, current_text, current_revision, saved_revision, version,
  updated_at, expires_at, local_recovery_enabled`;

function positiveInteger(value: string | number, field: string, allowZero = false): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || (allowZero ? parsed < 0 : parsed < 1)) {
    throw new Error(`Database ${field} violates the draft contract.`);
  }
  return parsed;
}

function instant(value: Date | string): PracticeDraft["updatedAt"] {
  const parsed = parseInstant(value instanceof Date ? value : new Date(value));
  if (!parsed.ok) throw new Error("Database draft timestamp violates the instant contract.");
  return parsed.value;
}

function id<TKind extends Parameters<typeof parseId>[0]>(kind: TKind, value: string) {
  const parsed = parseId(kind, value);
  if (!parsed.ok) throw new Error(`Database draft ${kind} violates the identifier contract.`);
  return parsed.value;
}

function oneOf<TValue extends string>(
  values: readonly TValue[],
  value: string,
  field: string,
): TValue {
  if (!values.includes(value as TValue)) throw new Error(`Database draft ${field} is invalid.`);
  return value as TValue;
}

function draftFromRow(row: DraftRow): PracticeDraft {
  return {
    draftId: id("draft", row.draft_id),
    attemptId: id("attempt", row.attempt_id),
    learnerId: id("learner", row.learner_id),
    problemVersionId: id("problemVersion", row.problem_version_id),
    manifestId: id("languageManifest", row.manifest_id),
    language: oneOf(PROBLEM_LANGUAGES, row.language, "language"),
    kind: oneOf(DRAFT_KINDS, row.kind, "kind"),
    currentText: row.current_text,
    currentRevision: positiveInteger(row.current_revision, "current revision", true),
    savedRevision: positiveInteger(row.saved_revision, "saved revision", true),
    version: positiveInteger(row.version, "version"),
    updatedAt: instant(row.updated_at),
    expiresAt: instant(row.expires_at),
    localRecoveryEnabled: row.local_recovery_enabled,
  };
}

function revisionFromRow(row: RevisionRow): SavedDraftRevision {
  return {
    draftId: id("draft", row.draft_id),
    attemptId: id("attempt", row.attempt_id),
    learnerId: id("learner", row.learner_id),
    kind: oneOf(DRAFT_KINDS, row.kind, "kind"),
    revision: positiveInteger(row.revision, "revision"),
    text: row.text,
    savedAt: instant(row.saved_at),
    expiresAt: instant(row.expires_at),
  };
}

export class PostgresDraftRepository implements DraftRepository {
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

  async createDraft(draft: PracticeDraft): Promise<PracticeDraft> {
    const result = await this.pool.query<DraftRow>(
      `INSERT INTO practice.draft
        (draft_id, attempt_id, learner_id, problem_version_id, manifest_id, language, kind,
         current_text, current_revision, saved_revision, version, updated_at, expires_at,
         local_recovery_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING ${DRAFT_COLUMNS}`,
      [
        draft.draftId,
        draft.attemptId,
        draft.learnerId,
        draft.problemVersionId,
        draft.manifestId,
        draft.language,
        draft.kind,
        draft.currentText,
        draft.currentRevision,
        draft.savedRevision,
        draft.version,
        draft.updatedAt,
        draft.expiresAt,
        draft.localRecoveryEnabled,
      ],
    );
    const row = result.rows[0];
    if (row === undefined) throw new Error("Database did not return the created draft.");
    return draftFromRow(row);
  }

  async getDraft(
    draftId: DraftId,
    learnerId: LearningAttempt["learnerId"],
  ): Promise<PracticeDraft | null> {
    const result = await this.pool.query<DraftRow>(
      `SELECT ${DRAFT_COLUMNS} FROM practice.draft WHERE draft_id = $1 AND learner_id = $2`,
      [draftId, learnerId],
    );
    const row = result.rows[0];
    return row === undefined ? null : draftFromRow(row);
  }

  async findDraftByAttempt(input: {
    readonly attemptId: LearningAttempt["attemptId"];
    readonly learnerId: LearningAttempt["learnerId"];
    readonly kind: PracticeDraft["kind"];
  }): Promise<PracticeDraft | null> {
    const result = await this.pool.query<DraftRow>(
      `SELECT ${DRAFT_COLUMNS} FROM practice.draft
        WHERE attempt_id = $1 AND learner_id = $2 AND kind = $3
        ORDER BY updated_at DESC, draft_id DESC
        LIMIT 1`,
      [input.attemptId, input.learnerId, input.kind],
    );
    const row = result.rows[0];
    return row === undefined ? null : draftFromRow(row);
  }

  async replaceCurrentDraft(input: {
    readonly draft: PracticeDraft;
    readonly expectedVersion: number;
  }): Promise<PracticeDraft | null> {
    const result = await this.pool.query<DraftRow>(
      `UPDATE practice.draft
          SET current_text = $3, current_revision = $4, version = $5, updated_at = $6
        WHERE draft_id = $1 AND learner_id = $2 AND version = $7 AND expires_at > $6
       RETURNING ${DRAFT_COLUMNS}`,
      [
        input.draft.draftId,
        input.draft.learnerId,
        input.draft.currentText,
        input.draft.currentRevision,
        input.draft.version,
        input.draft.updatedAt,
        input.expectedVersion,
      ],
    );
    const row = result.rows[0];
    return row === undefined ? null : draftFromRow(row);
  }

  async saveDraftRevision(input: {
    readonly draft: PracticeDraft;
    readonly revision: SavedDraftRevision;
    readonly expectedVersion: number;
  }): Promise<PracticeDraft | null> {
    return withTransaction(this.pool, async (transaction) => {
      const current = await oneDraft(transaction, input.draft.draftId, input.draft.learnerId, true);
      if (current === null || current.version !== input.expectedVersion) return null;
      await insertRevision(transaction, input.revision);
      const result = await transaction.query<DraftRow>(
        `UPDATE practice.draft
            SET saved_revision = $3, version = $4, updated_at = $5
          WHERE draft_id = $1 AND learner_id = $2 AND version = $6 AND expires_at > $5
         RETURNING ${DRAFT_COLUMNS}`,
        [
          input.draft.draftId,
          input.draft.learnerId,
          input.draft.savedRevision,
          input.draft.version,
          input.draft.updatedAt,
          input.expectedVersion,
        ],
      );
      const row = result.rows[0];
      return row === undefined ? null : draftFromRow(row);
    });
  }

  async listDraftRevisions(
    draftId: DraftId,
    learnerId: LearningAttempt["learnerId"],
  ): Promise<readonly SavedDraftRevision[]> {
    const result = await this.pool.query<RevisionRow>(
      `SELECT revision.draft_id, revision.learner_id, revision.revision,
              revision.kind, revision.text, revision.saved_at, revision.expires_at,
              draft.attempt_id
         FROM practice.draft_revision AS revision
         JOIN practice.draft AS draft
           ON draft.draft_id = revision.draft_id AND draft.learner_id = revision.learner_id
        WHERE revision.draft_id = $1 AND revision.learner_id = $2
        ORDER BY revision.revision DESC`,
      [draftId, learnerId],
    );
    return result.rows.map(revisionFromRow);
  }

  async deleteLearnerDrafts(learnerId: LearningAttempt["learnerId"]): Promise<void> {
    await this.pool.query("DELETE FROM practice.draft WHERE learner_id = $1", [learnerId]);
  }
}

async function oneDraft(
  database: {
    query<TRow extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: readonly unknown[],
    ): Promise<{ rows: TRow[] }>;
  },
  draftId: DraftId,
  learnerId: LearningAttempt["learnerId"],
  lock = false,
): Promise<PracticeDraft | null> {
  const result = await database.query<DraftRow>(
    `SELECT ${DRAFT_COLUMNS} FROM practice.draft
      WHERE draft_id = $1 AND learner_id = $2${lock ? " FOR UPDATE" : ""}`,
    [draftId, learnerId],
  );
  const row = result.rows[0];
  return row === undefined ? null : draftFromRow(row);
}

async function insertRevision(
  transaction: Transaction,
  revision: SavedDraftRevision,
): Promise<void> {
  await transaction.query(
    `INSERT INTO practice.draft_revision
      (draft_id, learner_id, revision, kind, text, saved_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      revision.draftId,
      revision.learnerId,
      revision.revision,
      revision.kind,
      revision.text,
      revision.savedAt,
      revision.expiresAt,
    ],
  );
}
