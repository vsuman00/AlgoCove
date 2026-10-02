import type { ContentRepository } from "@algocove/application";
import { conflictError } from "@algocove/application";
import type {
  ContentVersionId,
  ProblemContentVersion,
  ProblemManifest,
  ProblemVersionId,
} from "@algocove/domain";
import type { Transaction } from "./transaction.ts";

/** Construct only inside withTransaction: reads lock the version until the command commits. */
export class PostgresContentRepository implements ContentRepository {
  private readonly loaded = new Map<string, ProblemContentVersion | null>();
  private readonly tx: Transaction;
  constructor(tx: Transaction) {
    this.tx = tx;
  }

  async list(): Promise<readonly ProblemContentVersion[]> {
    const ids = await this.tx.query<{ content_version_id: ContentVersionId }>(
      "SELECT content_version_id FROM content.content_version ORDER BY created_at DESC, content_version_id LIMIT 200",
    );
    const records: ProblemContentVersion[] = [];
    for (const row of ids.rows) {
      const record = await this.get(row.content_version_id);
      if (record !== null) records.push(record);
    }
    return records;
  }

  async externalReferences(): Promise<
    readonly { title: string; provider: string; url: string; attribution: string }[]
  > {
    return (
      await this.tx.query<{ title: string; provider: string; url: string; attribution: string }>(
        "SELECT title,provider,canonical_url AS url,attribution FROM content.external_reference WHERE url_status='reviewed' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL ORDER BY title,external_reference_id LIMIT 50",
      )
    ).rows;
  }

  async get(id: ContentVersionId): Promise<ProblemContentVersion | null> {
    await this.tx.query(
      "SELECT content_version_id FROM content.content_version WHERE content_version_id=$1 FOR UPDATE",
      [id],
    );
    const result = await this.tx.query<{ value: ProblemContentVersion }>(
      `SELECT jsonb_build_object(
      'contentId',v.content_id,'contentVersionId',v.content_version_id,'problemId',p.problem_id,'problemVersionId',p.problem_version_id,
      'title',v.title,'statement',CASE WHEN v.payload_status='available' THEN p.statement ELSE NULL END,'checksum',v.checksum,
      'provenance',jsonb_build_object('kind',v.provenance_kind,'rightsHolder',v.rights_holder,'license',v.license,'sourceUrl',v.source_url,'rightsExpiresAt',v.rights_expires_at),
      'authorId',v.author_id,'status',v.status,'payloadStatus',v.payload_status,'createdAt',v.created_at,'publishedAt',v.published_at,'retiredAt',v.retired_at,'retirementReason',v.retirement_reason,
      'reviews',COALESCE((SELECT jsonb_agg(jsonb_build_object('kind',r.review_kind,'reviewerId',r.reviewer_id,'decision',r.decision,'notes',r.notes,'reviewedAt',r.reviewed_at) ORDER BY r.reviewed_at,r.reviewer_id) FROM content.content_review r WHERE r.content_version_id=v.content_version_id),'[]'::jsonb),
      'validation',COALESCE((SELECT jsonb_build_object('status',x.status,'validatorId',x.validator_id,'validatedAt',x.validated_at,'message',x.message) FROM content.content_validation x WHERE x.content_version_id=v.content_version_id),'{"status":"pending","validatorId":null,"validatedAt":null,"message":null}'::jsonb)
    ) value FROM content.content_version v JOIN content.problem_version p USING(content_version_id) WHERE v.content_version_id=$1`,
      [id],
    );
    const value = result.rows[0]?.value ?? null;
    this.loaded.set(id, value);
    return value;
  }

  async manifest(id: ProblemVersionId): Promise<ProblemManifest> {
    const fixtures = await this.tx.query<ProblemManifest["fixtures"][number]>(
      `SELECT f.fixture_id AS "fixtureId",f.semantic_key AS "semanticKey" FROM content.semantic_fixture f JOIN content.problem_manifest_fixture m USING(fixture_id) WHERE m.problem_version_id=$1 ORDER BY f.fixture_id`,
      [id],
    );
    const languages = await this.tx.query<Omit<ProblemManifest["languages"][number], "fixtureIds">>(
      `SELECT language,starter_template AS "starterTemplate",entry_signature AS "entrySignature",adapter_id AS "adapterId",limits_profile AS "limitsProfile" FROM content.problem_language_manifest WHERE problem_version_id=$1 ORDER BY language`,
      [id],
    );
    return {
      problemVersionId: id,
      fixtures: fixtures.rows,
      languages: languages.rows.map((row) => ({
        ...row,
        fixtureIds: fixtures.rows.map((fixture) => fixture.fixtureId),
      })),
    };
  }

  async replaceManifest(manifest: ProblemManifest, ids: readonly string[]): Promise<void> {
    const content = [...this.loaded.values()].find(
      (value) => value?.problemVersionId === manifest.problemVersionId,
    );
    if (content?.status !== "draft")
      throw conflictError("Only a locked draft can change language contracts.");
    for (const fixture of manifest.fixtures) {
      await this.tx.query(
        "INSERT INTO content.semantic_fixture(fixture_id,semantic_key) VALUES($1,$2) ON CONFLICT(fixture_id) DO NOTHING",
        [fixture.fixtureId, fixture.semanticKey],
      );
      const stored = await this.tx.query<{ semantic_key: string }>(
        "SELECT semantic_key FROM content.semantic_fixture WHERE fixture_id=$1",
        [fixture.fixtureId],
      );
      if (stored.rows[0]?.semantic_key !== fixture.semanticKey)
        throw conflictError(
          "A semantic fixture identity cannot be reused with a different meaning.",
        );
    }
    await this.tx.query(
      "DELETE FROM content.problem_language_manifest WHERE problem_version_id=$1",
      [manifest.problemVersionId],
    );
    await this.tx.query(
      "DELETE FROM content.problem_manifest_fixture WHERE problem_version_id=$1",
      [manifest.problemVersionId],
    );
    for (const fixture of manifest.fixtures)
      await this.tx.query(
        "INSERT INTO content.problem_manifest_fixture(problem_version_id,fixture_id) VALUES($1,$2)",
        [manifest.problemVersionId, fixture.fixtureId],
      );
    for (const [index, language] of manifest.languages.entries())
      await this.tx.query(
        "INSERT INTO content.problem_language_manifest(manifest_id,problem_version_id,language,starter_template,entry_signature,adapter_id,limits_profile,status) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,'draft')",
        [
          ids[index],
          manifest.problemVersionId,
          language.language,
          language.starterTemplate,
          language.entrySignature,
          language.adapterId,
          JSON.stringify(language.limitsProfile),
        ],
      );
    await this.tx.query("DELETE FROM content.content_review WHERE content_version_id=$1", [
      content.contentVersionId,
    ]);
    await this.tx.query("DELETE FROM content.content_validation WHERE content_version_id=$1", [
      content.contentVersionId,
    ]);
  }

  async save(content: ProblemContentVersion): Promise<ProblemContentVersion> {
    if (!this.loaded.has(content.contentVersionId)) await this.get(content.contentVersionId);
    const previous = this.loaded.get(content.contentVersionId);
    if (previous === null) {
      if (content.status !== "draft" || content.reviews.length > 0)
        throw conflictError("Create a draft before recording lifecycle decisions.");
      await this.tx.query(
        "INSERT INTO content.content_item(content_id,content_kind,created_at) VALUES($1,'problem',$2)",
        [content.contentId, content.createdAt],
      );
      await this.tx.query(
        "INSERT INTO content.problem(problem_id,content_id,created_at) VALUES($1,$2,$3)",
        [content.problemId, content.contentId, content.createdAt],
      );
      await this.tx.query(
        `INSERT INTO content.content_version(content_version_id,content_id,title,checksum,provenance_kind,rights_holder,license,source_url,rights_expires_at,author_id,status,payload_status,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft','available',$11)`,
        [
          content.contentVersionId,
          content.contentId,
          content.title,
          content.checksum,
          content.provenance.kind,
          content.provenance.rightsHolder,
          content.provenance.license,
          content.provenance.sourceUrl,
          content.provenance.rightsExpiresAt,
          content.authorId,
          content.createdAt,
        ],
      );
      await this.tx.query(
        "INSERT INTO content.problem_version(problem_version_id,problem_id,content_version_id,statement,created_at) VALUES($1,$2,$3,$4,$5)",
        [
          content.problemVersionId,
          content.problemId,
          content.contentVersionId,
          content.statement,
          content.createdAt,
        ],
      );
    } else {
      if (previous === undefined)
        throw conflictError("Content must be read inside the command transaction.");
      const immutable = (value: ProblemContentVersion) =>
        JSON.stringify([
          value.contentId,
          value.problemId,
          value.problemVersionId,
          value.title,
          value.statement,
          value.checksum,
          value.provenance,
          value.authorId,
          value.createdAt,
        ]);
      if (immutable(previous) !== immutable(content))
        throw conflictError("Content payloads are immutable. Create a successor version.");
      for (const review of content.reviews.slice(previous.reviews.length)) {
        await this.tx.query(
          "INSERT INTO content.content_review(content_version_id,review_kind,reviewer_id,decision,notes,reviewed_at) VALUES($1,$2,$3,$4,$5,$6)",
          [
            content.contentVersionId,
            review.kind,
            review.reviewerId,
            review.decision,
            review.notes,
            review.reviewedAt,
          ],
        );
      }
      if (JSON.stringify(previous.validation) !== JSON.stringify(content.validation)) {
        const validation = content.validation;
        await this.tx.query(
          `INSERT INTO content.content_validation(content_version_id,status,validator_id,message,validated_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(content_version_id) DO UPDATE SET status=EXCLUDED.status,validator_id=EXCLUDED.validator_id,message=EXCLUDED.message,validated_at=EXCLUDED.validated_at`,
          [
            content.contentVersionId,
            validation.status,
            validation.validatorId,
            validation.message,
            validation.validatedAt,
          ],
        );
      }
      if (previous.status !== content.status)
        await this.tx.query(
          "UPDATE content.content_version SET status=$2,payload_status=$3,published_at=$4,retired_at=$5,retirement_reason=$6 WHERE content_version_id=$1",
          [
            content.contentVersionId,
            content.status,
            content.payloadStatus,
            content.publishedAt,
            content.retiredAt,
            content.retirementReason,
          ],
        );
    }
    this.loaded.set(content.contentVersionId, content);
    return content;
  }
}
