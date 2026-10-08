import { enqueuePublishedContentDerivation } from "./content-index-repository.ts";
import { createHash } from "node:crypto";
import {
  authorizationError,
  conflictError,
  validationError,
  type RequestContext,
} from "@algocove/application";
import { pilotIdentity, PROBLEM_LANGUAGES, languageProfile } from "@algocove/domain";
import { validatePilotCollection } from "@algocove/content/pilot-collection";
import {
  canonicalPilotBundle,
  pilotPublicView,
  validatePilotBundle,
} from "@algocove/content/pilot";
import type { Transaction } from "./transaction.ts";
import { PostgresPlatformRepository } from "./platform-repository.ts";
export const PILOT_REVIEW_KINDS = [
  "technical",
  "pedagogical",
  "accessibility",
  "rights",
  "trace",
  "conformance",
] as const;
export type PilotReviewKind = (typeof PILOT_REVIEW_KINDS)[number];
/** Explicit draft import. Never creates grants, reviews, validation passes or publication. */
export class PostgresPilotRepository {
  private readonly tx: Transaction;
  constructor(tx: Transaction) {
    this.tx = tx;
  }
  async requireRole(ctx: RequestContext, roles: readonly string[]): Promise<void> {
    const grant = await this.tx.query(
      "SELECT 1 FROM platform.role_grant WHERE learner_id=$1 AND role=ANY($2::text[]) AND revoked_at IS NULL FOR SHARE",
      [ctx.actor.userId, roles],
    );
    if (!ctx.actor.roles.some((r) => roles.includes(r)) || grant.rowCount === 0)
      throw authorizationError("An active content role is required.");
  }
  async list(ctx: RequestContext): Promise<readonly Record<string, unknown>[]> {
    await this.requireRole(ctx, [
      "author",
      "technical_reviewer",
      "pedagogical_reviewer",
      "publisher",
      "evaluator",
    ]);
    return (
      await this.tx.query(
        `SELECT p.content_version_id AS "versionId",p.slug,p.pattern,p.checksum,v.status,p.author_payload AS bundle,COALESCE((SELECT jsonb_agg(jsonb_build_object('kind',r.kind,'reviewerId',r.reviewer_id,'decision',r.decision,'checksum',r.checksum,'notes',r.notes)) FROM content.pilot_review r WHERE r.content_version_id=p.content_version_id),'[]'::jsonb) reviews FROM content.pilot_bundle p JOIN content.content_version v USING(content_version_id) ORDER BY p.slug`,
      )
    ).rows;
  }
  async exportPublished(
    ctx: RequestContext,
  ): Promise<readonly { bundle: unknown; checksum: string; publicationRecordId: string }[]> {
    await this.requireRole(ctx, ["publisher", "evaluator"]);
    const rows = (
      await this.tx.query<{ bundle: unknown; checksum: string; publicationRecordId: string }>(
        `SELECT p.author_payload AS bundle,p.checksum,(SELECT a.event_id FROM platform.audit_event a WHERE a.resource_id=p.content_version_id AND a.action='content.publish' ORDER BY a.occurred_at DESC,a.event_id DESC LIMIT 1) AS "publicationRecordId" FROM content.pilot_bundle p JOIN content.content_version v USING(content_version_id) WHERE v.status='published' AND v.payload_status='available' AND (v.rights_expires_at IS NULL OR v.rights_expires_at>now()) ORDER BY p.slug`,
      )
    ).rows;
    if (
      rows.some(
        (r) =>
          typeof r.publicationRecordId !== "string" ||
          `sha256:${createHash("sha256")
            .update(canonicalPilotBundle(validatePilotBundle(r.bundle)))
            .digest("hex")}` !== r.checksum,
      )
    )
      throw conflictError("Only intact auditable publications may be exported.");
    return rows;
  }
  async import(
    ctx: RequestContext,
    raw: unknown,
  ): Promise<{ versionId: string; checksum: string; replay: boolean }> {
    await this.requireRole(ctx, ["author"]);
    let b;
    try {
      b = validatePilotBundle(raw);
    } catch {
      throw validationError("A complete original pilot bundle is required.");
    }
    const ids = pilotIdentity(b.slug);
    if (!ids || ids.pattern !== b.pattern || b.version !== `pilot.${b.pattern}.v1`)
      throw validationError("Only registered immutable v1 identities can be imported.");
    const checksum = `sha256:${createHash("sha256").update(canonicalPilotBundle(b)).digest("hex")}`;
    await this.tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [ids.contentVersionId]);
    const existing = await this.tx.query<{ checksum: string; author_id: string }>(
      "SELECT p.checksum,v.author_id FROM content.pilot_bundle p JOIN content.content_version v USING(content_version_id) WHERE p.content_version_id=$1",
      [ids.contentVersionId],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].checksum !== checksum || existing.rows[0].author_id !== ctx.actor.userId)
        throw conflictError("This immutable identity already has a different bundle or author.");
      return { versionId: ids.contentVersionId, checksum, replay: true };
    }
    await this.tx.query(
      "INSERT INTO content.content_item(content_id,content_kind) VALUES($1,'problem')",
      [ids.contentId],
    );
    await this.tx.query("INSERT INTO content.problem(problem_id,content_id) VALUES($1,$2)", [
      ids.problemId,
      ids.contentId,
    ]);
    await this.tx.query(
      "INSERT INTO content.content_version(content_version_id,content_id,title,checksum,provenance_kind,rights_holder,license,author_id,status,payload_status) VALUES($1,$2,$3,$4,'original','AlgoCove','original-v1',$5,'draft','available')",
      [ids.contentVersionId, ids.contentId, b.title, checksum, ctx.actor.userId],
    );
    await this.tx.query(
      "INSERT INTO content.problem_version(problem_version_id,problem_id,content_version_id,statement) VALUES($1,$2,$3,$4)",
      [ids.problemVersionId, ids.problemId, ids.contentVersionId, b.statement],
    );
    await this.tx.query(
      "INSERT INTO content.pilot_bundle(content_version_id,problem_version_id,slug,pattern,bundle_version,checksum,author_payload,public_payload,reference_trace) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb)",
      [
        ids.contentVersionId,
        ids.problemVersionId,
        b.slug,
        b.pattern,
        b.version,
        checksum,
        JSON.stringify(b),
        JSON.stringify(pilotPublicView(b)),
        JSON.stringify({
          schemaVersion: 2,
          provenance: "authored_reference",
          pattern: b.pattern,
          ...b.trace,
        }),
      ],
    );
    await this.tx.query(
      "INSERT INTO learning.concept(concept_id,slug,title,summary) VALUES($1,$2,$3,$4)",
      [
        ids.conceptId,
        `pilot-${b.pattern}`,
        b.pattern.replaceAll("-", " "),
        b.lesson.summary.slice(0, 500),
      ],
    );
    await this.tx.query(
      "INSERT INTO learning.problem_concept(problem_version_id,concept_id,rationale,mapped_by) VALUES($1,$2,$3,$4)",
      [ids.problemVersionId, ids.conceptId, b.lesson.invariant, ctx.actor.userId],
    );
    for (const f of b.fixtures) {
      const id = `pilot-${ids.key}-${f.id}`;
      await this.tx.query(
        "INSERT INTO content.semantic_fixture(fixture_id,semantic_key) VALUES($1,$2)",
        [id, `${b.pattern}:${f.id}`],
      );
      await this.tx.query(
        "INSERT INTO content.problem_manifest_fixture(problem_version_id,fixture_id) VALUES($1,$2)",
        [ids.problemVersionId, id],
      );
    }
    for (const [i, l] of PROBLEM_LANGUAGES.entries()) {
      const profile = languageProfile(l);
      await this.tx.query(
        "INSERT INTO content.problem_language_manifest(manifest_id,problem_version_id,language,starter_template,entry_signature,adapter_id,limits_profile,status) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,'draft')",
        [
          ids.manifestId(i),
          ids.problemVersionId,
          l,
          b.languages[l].starter,
          profile.entrySignature,
          profile.adapterId,
          JSON.stringify(profile.limitsProfile),
        ],
      );
    }
    const kinds = [
      "clarification",
      "example",
      "invariant",
      "pseudocode_scaffold",
      "partial_structure",
      "solution_review",
    ];
    for (const h of b.hints)
      await this.tx.query(
        "INSERT INTO content.problem_hint(problem_version_id,hint_id,tier,kind,body) VALUES($1,$2,$3,$4,$5)",
        [ids.problemVersionId, `${ids.hintPrefix}-${h.tier}`, h.tier, kinds[h.tier - 1], h.text],
      );
    const questions = [
      {
        id: "pattern",
        prompt: b.review.prompt,
        options: b.review.options.map((o) => ({ value: o.id, label: o.text })),
        answer: b.review.correctOption,
      },
    ];
    await this.tx.query(
      "INSERT INTO content.review_exercise(exercise_id,concept_id,kind,problem_version_id,title,questions,author_id) VALUES($1,$2,'recall',$3,$4,$5::jsonb,$6)",
      [
        `pilot-${b.pattern}-recall-v1`,
        ids.conceptId,
        ids.problemVersionId,
        b.title,
        JSON.stringify(questions),
        ctx.actor.userId,
      ],
    );
    const transfer = b.transfer.checkpoint;
    await this.tx.query(
      "INSERT INTO content.review_exercise(exercise_id,concept_id,kind,title,questions,author_id) VALUES($1,$2,'transfer',$3,$4::jsonb,$5)",
      [
        `pilot-${b.pattern}-transfer-v1`,
        ids.conceptId,
        b.transfer.title,
        JSON.stringify([
          {
            id: "transfer",
            prompt: b.transfer.statement + " " + transfer.prompt,
            options: transfer.options.map((o) => ({ value: o.id, label: o.text })),
            answer: transfer.correctOption,
          },
        ]),
        ctx.actor.userId,
      ],
    );
    await this.tx.query("SELECT pg_advisory_xact_lock(hashtext('pilot-curriculum-v1'))");
    await this.tx.query(
      "INSERT INTO learning.curriculum_graph_version(curriculum_version_id,version_number,status) SELECT 'cur_5555555555555555',COALESCE(max(version_number),0)+1,'draft' FROM learning.curriculum_graph_version ON CONFLICT(curriculum_version_id) DO NOTHING",
    );
    await this.tx.query(
      "INSERT INTO learning.curriculum_node(curriculum_version_id,concept_id,objective,ordinal) VALUES('cur_5555555555555555',$1,$2,$3)",
      [ids.conceptId, b.lesson.invariant.slice(0, 500), Number(ids.key) - 1],
    );
    await this.audit(ctx, ids.contentVersionId, "import", { checksum });
    return { versionId: ids.contentVersionId, checksum, replay: false };
  }
  async review(
    ctx: RequestContext,
    input: {
      versionId: string;
      checksum: string;
      kind: PilotReviewKind;
      decision: "approved" | "rejected";
      notes: string;
    },
  ): Promise<{ versionId: string; kind: PilotReviewKind; decision: "approved" | "rejected" }> {
    const role = ["pedagogical", "accessibility"].includes(input.kind)
      ? "pedagogical_reviewer"
      : "technical_reviewer";
    await this.requireRole(ctx, [role]);
    if (
      !PILOT_REVIEW_KINDS.includes(input.kind) ||
      !["approved", "rejected"].includes(input.decision) ||
      typeof input.notes !== "string" ||
      !input.notes.trim() ||
      input.notes.length > 2000
    )
      throw validationError("A bounded review decision is required.");
    const row = (
      await this.tx.query<{ checksum: string; author_id: string; status: string }>(
        "SELECT p.checksum,v.author_id,v.status FROM content.pilot_bundle p JOIN content.content_version v USING(content_version_id) WHERE p.content_version_id=$1 FOR UPDATE OF v",
        [input.versionId],
      )
    ).rows[0];
    if (!row || row.status !== "draft" || row.checksum !== input.checksum)
      throw conflictError("Reload the exact draft checksum before reviewing.");
    if (row.author_id === ctx.actor.userId)
      throw authorizationError("An author cannot review their own bundle.");
    const existing = (
      await this.tx.query<{ checksum: string; decision: string; notes: string }>(
        "SELECT checksum,decision,notes FROM content.pilot_review WHERE content_version_id=$1 AND kind=$2 AND reviewer_id=$3",
        [input.versionId, input.kind, ctx.actor.userId],
      )
    ).rows[0];
    if (existing) {
      if (
        existing.checksum !== input.checksum ||
        existing.decision !== input.decision ||
        existing.notes !== input.notes
      )
        throw conflictError("This reviewer already recorded a different immutable decision.");
      return { versionId: input.versionId, kind: input.kind, decision: input.decision };
    }
    await this.tx.query(
      "INSERT INTO content.pilot_review(content_version_id,kind,checksum,reviewer_id,decision,notes,reviewed_at) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        input.versionId,
        input.kind,
        input.checksum,
        ctx.actor.userId,
        input.decision,
        input.notes,
        ctx.now,
      ],
    );
    await this.audit(ctx, input.versionId, "review", {
      checksum: input.checksum,
      kind: input.kind,
      decision: input.decision,
    });
    return { versionId: input.versionId, kind: input.kind, decision: input.decision };
  }
  async importCollection(
    ctx: RequestContext,
    raw: unknown,
  ): Promise<{ collectionId: string; status: string }> {
    await this.requireRole(ctx, ["author"]);
    let collection;
    try {
      collection = validatePilotCollection(raw);
    } catch {
      throw validationError("Four original outbound mappings are required.");
    }
    await this.tx.query("SELECT pg_advisory_xact_lock(hashtext('pilot-collection-v1'))");
    if (
      (
        await this.tx.query(
          "SELECT 1 FROM content.external_collection WHERE collection_id='col_5555555555555555'",
        )
      ).rowCount
    )
      throw conflictError("Pilot collection already imported; use the governed review workflow.");
    await this.tx.query(
      "INSERT INTO content.external_collection(collection_id,slug,title) VALUES('col_5555555555555555',$1,$2)",
      [collection.slug, collection.title],
    );
    for (const [i, e] of collection.entries.entries()) {
      const ids = pilotIdentity(e.problemSlug)!;
      const stored = (
        await this.tx.query<{ author_payload: unknown }>(
          "SELECT author_payload FROM content.pilot_bundle WHERE content_version_id=$1",
          [ids.contentVersionId],
        )
      ).rows[0];
      if (!stored) throw conflictError("Import all four original bundles before their collection.");
      const bundle = validatePilotBundle(stored.author_payload);
      const ref = `ref_${ids.key.repeat(16)}`;
      await this.tx.query(
        "INSERT INTO content.external_reference(external_reference_id,provider,external_key,title,canonical_url,attribution,url_status,author_id) VALUES($1,$2,$3,$4,$5,$6,'unreviewed',$7)",
        [ref, e.provider, e.externalKey, e.title, e.canonicalUrl, e.attribution, ctx.actor.userId],
      );
      await this.tx.query(
        "INSERT INTO content.external_collection_membership(collection_id,external_reference_id,ordinal) VALUES('col_5555555555555555',$1,$2)",
        [ref, i],
      );
      const questions = bundle.readinessQuestions;
      const requirements = [
        ...questions.map((q) => ({ category: q.category, checkIds: [q.id] })),
        { category: "execution", checkIds: ["verified_pass"] },
      ];
      await this.tx.query(
        "INSERT INTO content.external_readiness_rubric(rubric_id,version,problem_version_id,mode,requirements,maximum_assistance_tier,author_id,questions,external_reference_id,mapping_kind,mapping_rationale) VALUES($1,1,$2,'learn',$3::jsonb,4,$4,$5::jsonb,$6,$7,$8)",
        [
          `pilot.${e.pattern}.external.v1`,
          ids.problemVersionId,
          JSON.stringify(requirements),
          ctx.actor.userId,
          JSON.stringify(questions),
          ref,
          e.relation,
          e.rationale,
        ],
      );
    }
    await this.audit(ctx, "col_5555555555555555", "collection_import", {
      entries: 4,
      status: "unreviewed",
    });
    return { collectionId: "col_5555555555555555", status: "unreviewed" };
  }
  async publishGraphIfReady(ctx: RequestContext): Promise<void> {
    await this.tx.query("SELECT pg_advisory_xact_lock(hashtext('pilot-curriculum-v1'))");
    const changed = await this.tx.query(
      "UPDATE learning.curriculum_graph_version SET status='published',published_at=now() WHERE curriculum_version_id='cur_5555555555555555' AND status='draft' AND (SELECT count(*) FROM learning.curriculum_node WHERE curriculum_version_id='cur_5555555555555555')=4 AND (SELECT count(*) FROM content.pilot_bundle p JOIN content.content_version v USING(content_version_id) WHERE v.status='published' AND v.payload_status='available')=4",
    );
    if (changed.rowCount) {
      const versions = (
        await this.tx.query<{ content_version_id: string; checksum: string }>(
          "SELECT p.content_version_id,p.checksum FROM content.pilot_bundle p JOIN content.content_version v USING(content_version_id) WHERE v.status='published'",
        )
      ).rows;
      for (const v of versions)
        await enqueuePublishedContentDerivation(this.tx, {
          contentVersionId: v.content_version_id,
          sourceChecksum: v.checksum,
          now: ctx.now,
        });
    }
  }
  async preparePublication(ctx: RequestContext, versionId: string): Promise<void> {
    const pilot = (
      await this.tx.query<{ problem_version_id: string }>(
        "SELECT problem_version_id FROM content.pilot_bundle WHERE content_version_id=$1",
        [versionId],
      )
    ).rows[0];
    if (!pilot) return;
    await this.requireRole(ctx, ["publisher"]);
    const gate = await this.tx.query(
      "SELECT 1 FROM content.pilot_bundle p WHERE p.content_version_id=$1 AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['technical','pedagogical','accessibility','rights','trace','conformance']) k WHERE NOT EXISTS(SELECT 1 FROM content.pilot_review r JOIN platform.role_grant g ON g.learner_id=r.reviewer_id WHERE r.content_version_id=p.content_version_id AND r.checksum=p.checksum AND r.kind=k AND r.decision='approved' AND g.revoked_at IS NULL AND g.role=CASE WHEN k IN ('pedagogical','accessibility') THEN 'pedagogical_reviewer' ELSE 'technical_reviewer' END)) AND NOT EXISTS(SELECT 1 FROM content.pilot_review r WHERE r.content_version_id=p.content_version_id AND r.decision='rejected' AND r.checksum=p.checksum)",
      [versionId],
    );
    if (!gate.rowCount)
      throw conflictError("Six current independent checksum-bound reviews are required.");
    const reviews = (
      await this.tx.query<{ review_kind: string; reviewer_id: string }>(
        "SELECT review_kind,reviewer_id FROM content.content_review WHERE content_version_id=$1 AND decision='approved' ORDER BY reviewed_at DESC",
        [versionId],
      )
    ).rows;
    const technical = reviews.find((r) => r.review_kind === "technical")?.reviewer_id;
    const pedagogical = reviews.find((r) => r.review_kind === "pedagogical")?.reviewer_id;
    if (!technical || !pedagogical)
      throw conflictError("Independent standard content reviews are required.");
    await this.tx.query(
      "UPDATE content.problem_language_manifest SET status='published' WHERE problem_version_id=$1 AND status='draft'",
      [pilot.problem_version_id],
    );
    await this.tx.query(
      "UPDATE content.review_exercise SET technical_reviewer_id=$2,pedagogical_reviewer_id=$3,publisher_id=$4,status='published' WHERE concept_id IN (SELECT concept_id FROM learning.problem_concept WHERE problem_version_id=$1) AND status='draft'",
      [pilot.problem_version_id, technical, pedagogical, ctx.actor.userId],
    );
  }
  private async audit(
    ctx: RequestContext,
    id: string,
    command: string,
    payload: Record<string, unknown>,
  ) {
    const p = new PostgresPlatformRepository(this.tx);
    await p.append({
      eventId: ctx.ids.generate("event"),
      actorId: ctx.actor.userId,
      action: `pilot.${command}`,
      resourceType: "content_version",
      resourceId: id,
      payload,
      occurredAt: ctx.now,
    });
    await p.enqueue({
      eventId: ctx.ids.generate("event"),
      topic: `pilot.${command}`,
      aggregateId: id,
      payload: { contentVersionId: id, ...payload },
      occurredAt: ctx.now,
    });
  }
}
