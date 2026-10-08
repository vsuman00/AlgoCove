import { pilotWalkthrough, validateWalkthrough } from "@algocove/visualizer";
import { createHash } from "node:crypto";
import {
  conflictError,
  authorizationError,
  notFoundError,
  validationError,
  type RequestContext,
} from "@algocove/application";
import {
  pilotLearningView,
  pilotReleasePacket,
  releasePublicView,
  validateReleasePacket,
  validateReleaseManifest,
  type LearningPublicView,
  type ReleaseManifest,
} from "@algocove/content/learning-release";
import { validatePilotBundle, type PilotPublicView } from "@algocove/content/pilot";
import type { Transaction } from "./transaction.ts";
import { PostgresPilotRepository } from "./pilot-repository.ts";
const canonical = (v: unknown): string =>
  v !== null && typeof v === "object"
    ? Array.isArray(v)
      ? `[${v.map(canonical).join(",")}]`
      : `{${Object.entries(v)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`)
          .join(",")}}`
    : (JSON.stringify(v) ?? "null");
const digest = (v: unknown) => `sha256:${createHash("sha256").update(canonical(v)).digest("hex")}`;
export class PostgresLearningReleaseRepository {
  private readonly tx: Transaction;
  constructor(tx: Transaction) {
    this.tx = tx;
  }
  async set(
    ctx: RequestContext,
    input: {
      versionId: string;
      expectedChecksum: string | null;
      packet: unknown;
      walkthrough?: unknown;
    },
  ): Promise<{ checksum: string }> {
    await new PostgresPilotRepository(this.tx).requireRole(ctx, ["author"]);
    const row = (
      await this.tx.query(
        "SELECT v.*,p.problem_version_id,p.problem_id FROM content.content_version v JOIN content.problem_version p USING(content_version_id) WHERE v.content_version_id=$1 FOR UPDATE OF v",
        [input.versionId],
      )
    ).rows[0];
    if (!row || row.status !== "draft")
      throw conflictError("Only an owned draft release can change.");
    if (row.author_id !== ctx.actor.userId)
      throw authorizationError("Only the author can edit this release.");
    if (
      (
        await this.tx.query("SELECT 1 FROM content.pilot_bundle WHERE content_version_id=$1", [
          input.versionId,
        ])
      ).rowCount
    )
      throw conflictError(
        "Versioned pilot bundles use their immutable import and review workflow.",
      );
    let packet;
    try {
      packet = validateReleasePacket(input.packet);
    } catch {
      throw validationError("A safe complete learning release packet is required.");
    }
    if (input.walkthrough !== undefined && input.walkthrough !== null) {
      try {
        validateWalkthrough(input.walkthrough);
      } catch {
        throw validationError("A compatible synchronized walkthrough is required.");
      }
    }
    const checksum = digest({ packet, walkthrough: input.walkthrough ?? null });
    const existing = (
      await this.tx.query(
        "SELECT packet_checksum FROM content.learning_release WHERE content_version_id=$1",
        [input.versionId],
      )
    ).rows[0];
    if (existing?.packet_checksum === checksum) return { checksum };
    if ((existing?.packet_checksum ?? null) !== input.expectedChecksum)
      throw conflictError("Reload the current release checksum before editing.");
    const route = (
      await this.tx.query(
        "SELECT problem_id,is_canonical,slug FROM content.problem_route WHERE slug=$1 OR (problem_id=$2 AND is_canonical)",
        [packet.slug, row.problem_id],
      )
    ).rows;
    if (
      route.some(
        (r) => r.problem_id !== row.problem_id || (r.is_canonical && r.slug !== packet.slug),
      )
    )
      throw conflictError("A stable canonical slug cannot be reassigned.");
    await this.tx.query(
      "INSERT INTO content.problem_route(slug,problem_id,is_canonical) VALUES($1,$2,true) ON CONFLICT(slug) DO NOTHING",
      [packet.slug, row.problem_id],
    );
    await this.tx.query(
      `INSERT INTO content.learning_release(content_version_id,problem_version_id,packet_checksum,packet,public_payload,walkthrough) VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)
      ON CONFLICT(content_version_id) DO UPDATE SET packet_checksum=EXCLUDED.packet_checksum,packet=EXCLUDED.packet,public_payload=EXCLUDED.public_payload,walkthrough=EXCLUDED.walkthrough,manifest=NULL`,
      [
        input.versionId,
        row.problem_version_id,
        checksum,
        JSON.stringify(packet),
        JSON.stringify(releasePublicView(packet, input.walkthrough ? "pilot" : "unavailable")),
        JSON.stringify(input.walkthrough ?? null),
      ],
    );
    const kinds = [
      "clarification",
      "example",
      "invariant",
      "pseudocode_scaffold",
      "partial_structure",
      "solution_review",
    ];
    await this.tx.query("DELETE FROM content.problem_hint WHERE problem_version_id=$1", [
      row.problem_version_id,
    ]);
    for (const hint of packet.hints)
      await this.tx.query(
        "INSERT INTO content.problem_hint(problem_version_id,hint_id,tier,kind,body) VALUES($1,$2,$3,$4,$5)",
        [
          row.problem_version_id,
          `${input.versionId}:hint:${hint.tier}`,
          hint.tier,
          kinds[hint.tier - 1],
          hint.text,
        ],
      );
    const concept = (
      await this.tx.query(
        "SELECT concept_id FROM learning.problem_concept WHERE problem_version_id=$1 ORDER BY concept_id LIMIT 1",
        [row.problem_version_id],
      )
    ).rows[0];
    if (concept) {
      await this.tx.query(
        "DELETE FROM content.review_exercise WHERE exercise_id=ANY($1::text[]) AND status='draft'",
        [[`${input.versionId}.recall`, `${input.versionId}.transfer`]],
      );
      for (const kind of ["recall", "transfer"] as const) {
        const questions = kind === "recall" ? packet.questions : [packet.transfer.question];
        await this.tx.query(
          "INSERT INTO content.review_exercise(exercise_id,concept_id,kind,problem_version_id,title,questions,author_id) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)",
          [
            `${input.versionId}.${kind}`,
            concept.concept_id,
            kind,
            row.problem_version_id,
            kind === "recall" ? `${packet.slug} recall` : packet.transfer.title,
            JSON.stringify(
              questions.map((q) => ({
                id: q.id,
                prompt: kind === "transfer" ? `${packet.transfer.statement} ${q.prompt}` : q.prompt,
                options: q.options.map((o) => ({ value: o.id, label: o.text })),
                answer: q.answer,
              })),
            ),
            ctx.actor.userId,
          ],
        );
      }
    }
    await this.tx.query("DELETE FROM content.content_review WHERE content_version_id=$1", [
      input.versionId,
    ]);
    await this.tx.query(
      "UPDATE content.content_validation SET status='pending',validated_at=NULL,validator_id=NULL,message=NULL WHERE content_version_id=$1",
      [input.versionId],
    );
    await this.tx.query(
      "INSERT INTO platform.audit_event(event_id,actor_id,action,resource_type,resource_id,payload,occurred_at) VALUES($1,$2,'release.edit','content_version',$3,$4::jsonb,$5)",
      [
        ctx.ids.generate("event"),
        ctx.actor.userId,
        input.versionId,
        JSON.stringify({ checksum }),
        ctx.now,
      ],
    );
    return { checksum };
  }
  async publicView(problemVersionId: string): Promise<LearningPublicView | null> {
    const row = (
      await this.tx.query(
        `SELECT r.public_payload,p.public_payload AS pilot FROM content.problem_version problem JOIN content.content_version v USING(content_version_id)
      LEFT JOIN content.learning_release r ON r.content_version_id=problem.content_version_id LEFT JOIN content.pilot_bundle p ON p.problem_version_id=problem.problem_version_id
      WHERE problem.problem_version_id=$1 AND v.status='published' AND v.payload_status='available' AND (v.rights_expires_at IS NULL OR v.rights_expires_at>now())`,
        [problemVersionId],
      )
    ).rows[0];
    if (!row) return null;
    if (row.public_payload) return row.public_payload as LearningPublicView;
    return row.pilot ? pilotLearningView(row.pilot as PilotPublicView) : null;
  }
  async preflight(
    ctx: RequestContext,
    versionId: string,
  ): Promise<{
    checksum: string | null;
    issues: string[];
    manifest: ReleaseManifest | null;
    packet: unknown;
    walkthrough: unknown;
  }> {
    await new PostgresPilotRepository(this.tx).requireRole(ctx, [
      "author",
      "technical_reviewer",
      "pedagogical_reviewer",
      "publisher",
      "evaluator",
    ]);
    const row = (
      await this.tx.query(
        `SELECT v.*,p.problem_version_id,r.packet,r.walkthrough,r.packet_checksum,pilot.author_payload AS pilot FROM content.content_version v JOIN content.problem_version p USING(content_version_id)
      LEFT JOIN content.learning_release r USING(content_version_id) LEFT JOIN content.pilot_bundle pilot USING(content_version_id) WHERE v.content_version_id=$1`,
        [versionId],
      )
    ).rows[0];
    if (!row) throw notFoundError("Learning release is unavailable.");
    const packet =
      row.packet ?? (row.pilot ? pilotReleasePacket(validatePilotBundle(row.pilot)) : null);
    const issues: string[] = [];
    if (row.packet && !row.walkthrough) issues.push("missing_walkthrough");
    if (row.walkthrough) {
      try {
        const w = validateWalkthrough(row.walkthrough);
        if (row.packet?.pattern !== w.trace.pattern)
          issues.push("incompatible_walkthrough_pattern");
      } catch {
        issues.push("invalid_walkthrough_line_references");
      }
    }
    if (!packet) issues.push("missing_typed_assets");
    else {
      try {
        validateReleasePacket(packet);
      } catch {
        issues.push("unsafe_or_incomplete_assets");
      }
    }
    if (
      !(
        await this.tx.query("SELECT 1 FROM learning.problem_concept WHERE problem_version_id=$1", [
          row.problem_version_id,
        ])
      ).rowCount
    )
      issues.push("missing_reviewed_concept_mapping");
    if (packet?.lesson?.prerequisites?.length) {
      const available = (
        await this.tx.query(
          "SELECT DISTINCT pattern FROM content.eligible_learning_problem WHERE pattern=ANY($1::text[])",
          [packet.lesson.prerequisites],
        )
      ).rows.map((r) => r.pattern);
      for (const prerequisite of packet.lesson.prerequisites)
        if (!available.includes(prerequisite)) issues.push(`missing_prerequisite:${prerequisite}`);
    }
    const hints = (
      await this.tx.query(
        "SELECT tier,body FROM content.problem_hint WHERE problem_version_id=$1 ORDER BY tier",
        [row.problem_version_id],
      )
    ).rows;
    if (hints.length !== 6 || hints.some((h, i) => h.tier !== i + 1))
      issues.push("missing_six_tier_hints");
    const walkthrough =
      row.walkthrough ??
      (row.pilot
        ? pilotWalkthrough({
            schemaVersion: 2,
            provenance: "authored_reference",
            pattern: validatePilotBundle(row.pilot).pattern,
            ...validatePilotBundle(row.pilot).trace,
          })
        : null);
    const languages = (
      await this.tx.query(
        "SELECT language,manifest_id FROM content.problem_language_manifest WHERE problem_version_id=$1 ORDER BY language",
        [row.problem_version_id],
      )
    ).rows;
    let manifest: ReleaseManifest | null = packet
      ? {
          schemaVersion: 1,
          releaseId: versionId,
          contentVersionId: versionId,
          problemVersionId: row.problem_version_id,
          sourceChecksum: row.checksum,
          assets: [
            "lesson",
            "rubric",
            "walkthrough",
            "hints",
            "review",
            "transfer",
            "approach",
            "pseudocode",
            "scenario",
          ].map((role) => ({
            role,
            versionId: `${versionId}:${role}`,
            checksum: digest(
              role === "lesson"
                ? packet.lesson
                : role === "rubric"
                  ? packet.questions
                  : role === "walkthrough"
                    ? walkthrough
                    : role === "pseudocode"
                      ? walkthrough?.lines
                      : role === "scenario"
                        ? walkthrough?.scenarioId
                        : role === "approach"
                          ? walkthrough?.approachId
                          : packet[role as "hints" | "review" | "transfer"],
            ),
          })),
          languages: languages.map((m) => ({ language: m.language, manifestId: m.manifest_id })),
        }
      : null;
    if (manifest) {
      try {
        validateReleaseManifest(manifest);
      } catch {
        issues.push("incompatible_language_or_asset_pins");
        manifest = null;
      }
    }
    return { checksum: row.packet_checksum ?? null, issues, manifest, packet, walkthrough };
  }
  async prepare(ctx: RequestContext, versionId: string): Promise<void> {
    const exists = await this.tx.query(
      "SELECT 1 FROM content.learning_release WHERE content_version_id=$1",
      [versionId],
    );
    if (!exists.rowCount) return;
    const result = await this.preflight(ctx, versionId);
    if (result.issues.length || !result.manifest)
      throw conflictError("Learning release preflight failed.");
    const exerciseCount = (
      await this.tx.query(
        "SELECT count(*)::integer AS n FROM content.review_exercise WHERE exercise_id=ANY($1::text[]) AND status='draft'",
        [[`${versionId}.recall`, `${versionId}.transfer`]],
      )
    ).rows[0]?.n;
    if (exerciseCount !== 2)
      throw conflictError("The release requires its recall and transfer assets.");
    await this.tx.query(
      "UPDATE content.learning_release SET manifest=$2::jsonb WHERE content_version_id=$1",
      [versionId, JSON.stringify(result.manifest)],
    );
    const reviews = (
      await this.tx.query(
        "SELECT review_kind,reviewer_id FROM content.content_review WHERE content_version_id=$1 AND decision='approved' ORDER BY reviewed_at DESC",
        [versionId],
      )
    ).rows;
    const technical = reviews.find((r) => r.review_kind === "technical")?.reviewer_id;
    const pedagogical = reviews.find((r) => r.review_kind === "pedagogical")?.reviewer_id;
    if (!technical || !pedagogical)
      throw conflictError("Independent content reviews are required.");
    await this.tx.query(
      "UPDATE content.review_exercise SET technical_reviewer_id=$2,pedagogical_reviewer_id=$3,publisher_id=$4,status='published' WHERE exercise_id=ANY($1::text[]) AND status='draft'",
      [[`${versionId}.recall`, `${versionId}.transfer`], technical, pedagogical, ctx.actor.userId],
    );
    await this.tx.query(
      "UPDATE content.problem_language_manifest SET status='published' WHERE problem_version_id=$1 AND status='draft'",
      [result.manifest.problemVersionId],
    );
  }
}
