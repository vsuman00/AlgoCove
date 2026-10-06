import type { Pool } from "pg";
import {
  requirePermission,
  validationError,
  notFoundError,
  conflictError,
  authorizationError,
  type RequestContext,
} from "@algocove/application";
import {
  CONTAINER_EXTERNAL_QUESTIONS,
  PERMISSIONS,
  READINESS_CATEGORIES,
  parseId,
  parseReadinessQuestions,
  createExternalReference,
  validateExternalUrl,
} from "@algocove/domain";
import { withTransaction } from "./transaction.ts";

export class PostgresReadinessContentRepository {
  private readonly pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }
  async list(context: RequestContext): Promise<{
    rubrics: Record<string, unknown>[];
    references: Record<string, unknown>[];
    draftTemplate: Record<string, unknown>;
  }> {
    if (
      !context.actor.roles.some((r) =>
        ["author", "technical_reviewer", "pedagogical_reviewer", "publisher"].includes(r),
      )
    )
      throw authorizationError("Content staff access is required.");
    const rubrics = await this.pool.query(
      "SELECT * FROM content.external_readiness_rubric ORDER BY rubric_id,version DESC LIMIT 100",
    );
    const references = await this.pool.query(
      "SELECT external_reference_id,title,canonical_url,url_status FROM content.external_reference ORDER BY title LIMIT 100",
    );
    return {
      rubrics: rubrics.rows,
      references: references.rows,
      draftTemplate: {
        action: "create",
        rubricId: "container.external.v1",
        version: 1,
        problemVersionId: "prb_dddddddddddddddd",
        mode: "learn",
        maximumAssistanceTier: 4,
        referenceId: "",
        relation: "same_pattern",
        rationale:
          "This original AlgoCove exercise prepares the two-pointer pattern; the external problem is an independent solve.",
        questions: CONTAINER_EXTERNAL_QUESTIONS,
      },
    };
  }
  async command(context: RequestContext, input: Record<string, unknown>): Promise<void> {
    const action = input.action;
    const permission =
      action === "create" || action === "create_reference"
        ? PERMISSIONS.contentAuthor
        : action === "technical_review" || action === "review_reference"
          ? PERMISSIONS.contentTechnicalReview
          : action === "pedagogical_review"
            ? PERMISSIONS.contentPedagogicalReview
            : action === "publish" || action === "retire"
              ? PERMISSIONS.contentPublish
              : null;
    if (!permission) throw validationError("Unknown preparation content command.");
    requirePermission(context, permission);
    await withTransaction(this.pool, async (tx) => {
      if (action === "create_reference") {
        if (
          ["provider", "externalKey", "title", "canonicalUrl", "attribution"].some(
            (key) => typeof input[key] !== "string",
          )
        )
          throw validationError("Reference metadata must be text.");
        const id = context.ids.generate("externalReference");
        const reference = createExternalReference({
          externalReferenceId: id,
          provider: String(input.provider ?? ""),
          externalKey: String(input.externalKey ?? ""),
          title: String(input.title ?? ""),
          canonicalUrl: String(input.canonicalUrl ?? ""),
          attribution: String(input.attribution ?? ""),
        });
        if (!reference.ok || new URL(reference.value.canonicalUrl).search)
          throw validationError("Provide a canonical provider URL without query data.");
        const r = reference.value;
        await tx.query(
          "INSERT INTO content.external_reference(external_reference_id,provider,external_key,title,canonical_url,attribution,url_status,author_id) VALUES($1,$2,$3,$4,$5,$6,'unreviewed',$7)",
          [
            id,
            r.provider,
            r.externalKey,
            r.title,
            r.canonicalUrl,
            r.attribution,
            context.actor.userId,
          ],
        );
        await tx.query(
          "INSERT INTO platform.audit_event(event_id,actor_id,action,resource_type,resource_id,occurred_at) VALUES($1,$2,'external_reference.created','external_reference',$3,$4)",
          [context.ids.generate("event"), context.actor.userId, id, context.now],
        );
        return;
      }
      if (action === "review_reference") {
        const id = parseId("externalReference", input.referenceId);
        if (!id.ok || !["reviewed", "unavailable", "blocked"].includes(String(input.status)))
          throw validationError("Choose a reference and its reviewed availability.");
        const record = (
          await tx.query<{
            author_id: string | null;
            provider: Parameters<typeof validateExternalUrl>[0];
            canonical_url: string;
          }>(
            "SELECT author_id,provider,canonical_url FROM content.external_reference WHERE external_reference_id=$1 FOR UPDATE",
            [id.value],
          )
        ).rows[0];
        if (!record) throw notFoundError("Reference unavailable.");
        if (record.author_id === context.actor.userId)
          throw authorizationError("An independent reference reviewer is required.");
        const safe = validateExternalUrl(record.provider, record.canonical_url);
        if (input.status === "reviewed" && (!safe.ok || new URL(record.canonical_url).search))
          throw validationError("Canonical reviewed destination required.");
        await tx.query(
          "UPDATE content.external_reference SET url_status=$2,reviewed_by=$3,reviewed_at=$4,version=version+1 WHERE external_reference_id=$1",
          [id.value, input.status, context.actor.userId, context.now],
        );
        await tx.query(
          "INSERT INTO platform.audit_event(event_id,actor_id,action,resource_type,resource_id,payload,occurred_at) VALUES($1,$2,'external_reference.reviewed','external_reference',$3,$4::jsonb,$5)",
          [
            context.ids.generate("event"),
            context.actor.userId,
            id.value,
            JSON.stringify({ status: input.status }),
            context.now,
          ],
        );
        return;
      }
      if (
        typeof input.rubricId !== "string" ||
        !/^[A-Za-z0-9._:-]{1,128}$/.test(input.rubricId) ||
        typeof input.version !== "number" ||
        !Number.isSafeInteger(input.version) ||
        input.version < 1
      )
        throw validationError("Rubric identity and positive version are required.");
      if (action === "create") {
        const problem = parseId("problemVersion", input.problemVersionId),
          reference = parseId("externalReference", input.referenceId);
        let questions;
        try {
          questions = parseReadinessQuestions(input.questions);
        } catch {
          throw validationError("Provide authored preparation questions covering every category.");
        }
        if (
          !problem.ok ||
          !reference.ok ||
          !["learn", "practice", "rescue"].includes(String(input.mode)) ||
          typeof input.maximumAssistanceTier !== "number" ||
          !Number.isInteger(input.maximumAssistanceTier) ||
          input.maximumAssistanceTier < 0 ||
          input.maximumAssistanceTier > 6 ||
          typeof input.rationale !== "string" ||
          !input.rationale.trim() ||
          input.rationale.length > 1600 ||
          !["same_pattern", "equivalent_problem", "prerequisite", "transfer"].includes(
            String(input.relation),
          )
        )
          throw validationError(
            "Problem, reviewed mapping, mode and assistance limit are required.",
          );
        const requirements = READINESS_CATEGORIES.map((category) => ({
          category,
          checkIds:
            category === "execution"
              ? ["verified_pass"]
              : questions.filter((q) => q.category === category).map((q) => q.id),
        }));
        await tx.query(
          `INSERT INTO content.external_readiness_rubric(rubric_id,version,problem_version_id,mode,requirements,maximum_assistance_tier,author_id,questions,external_reference_id,mapping_kind,mapping_rationale) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8::jsonb,$9,$10,$11)`,
          [
            input.rubricId,
            input.version,
            problem.value,
            input.mode,
            JSON.stringify(requirements),
            input.maximumAssistanceTier,
            context.actor.userId,
            JSON.stringify(questions),
            reference.value,
            input.relation,
            input.rationale,
          ],
        );
      } else {
        const row = (
          await tx.query<{
            status: string;
            author_id: string;
            technical_reviewer_id: string | null;
            pedagogical_reviewer_id: string | null;
            questions: unknown;
            external_reference_id: string | null;
          }>(
            "SELECT * FROM content.external_readiness_rubric WHERE rubric_id=$1 AND version=$2 FOR UPDATE",
            [input.rubricId, input.version],
          )
        ).rows[0];
        if (!row) throw notFoundError("Preparation rubric unavailable.");
        if (action === "retire") {
          if (row.status !== "published")
            throw conflictError("Only a published rubric can retire.");
          await tx.query(
            "UPDATE content.external_readiness_rubric SET status='retired' WHERE rubric_id=$1 AND version=$2",
            [input.rubricId, input.version],
          );
        } else {
          if (row.status !== "draft")
            throw conflictError("Only a draft rubric can receive review or publication.");
          if (
            [row.author_id, row.technical_reviewer_id, row.pedagogical_reviewer_id].includes(
              context.actor.userId,
            )
          )
            throw authorizationError("Independent review and publication identities are required.");
          if (action === "publish") {
            try {
              parseReadinessQuestions(row.questions);
            } catch {
              throw validationError("Complete preparation questions required.");
            }
            const ref = (
              await tx.query<{
                provider: Parameters<typeof validateExternalUrl>[0];
                canonical_url: string;
              }>(
                "SELECT provider,canonical_url FROM content.external_reference WHERE external_reference_id=$1 AND url_status='reviewed' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL FOR SHARE",
                [row.external_reference_id],
              )
            ).rows[0];
            if (
              !ref ||
              !validateExternalUrl(ref.provider, ref.canonical_url).ok ||
              new URL(ref.canonical_url).search
            )
              throw validationError("An independently reviewed canonical reference is required.");
            await tx.query(
              "UPDATE content.external_readiness_rubric SET status='published',publisher_id=$3 WHERE rubric_id=$1 AND version=$2",
              [input.rubricId, input.version, context.actor.userId],
            );
          } else {
            const column =
              action === "technical_review" ? "technical_reviewer_id" : "pedagogical_reviewer_id";
            if (row[column] !== null) throw conflictError("This review is already recorded.");
            await tx.query(
              `UPDATE content.external_readiness_rubric SET ${column}=$3 WHERE rubric_id=$1 AND version=$2`,
              [input.rubricId, input.version, context.actor.userId],
            );
          }
        }
      }
      const auditAction =
        action === "create"
          ? "created"
          : action === "publish"
            ? "published"
            : action === "retire"
              ? "retired"
              : action;
      await tx.query(
        "INSERT INTO content.external_readiness_audit(event_id,rubric_id,rubric_version,actor_id,action,occurred_at) VALUES($1,$2,$3,$4,$5,$6)",
        [
          context.ids.generate("event"),
          input.rubricId,
          input.version,
          context.actor.userId,
          auditAction,
          context.now,
        ],
      );
    });
  }
}
