import type { Pool } from "pg";
import {
  conflictError,
  notFoundError,
  validationError,
  type ExternalCompanionRepository,
  type ExternalPreparationView,
} from "@algocove/application";
import {
  evaluateExternalReadiness,
  parseReadinessQuestions,
  validateExternalUrl,
  type ExternalReference,
  type ReadinessQuestion,
  type LearningAttempt,
  type LearnerId,
} from "@algocove/domain";
import { withTransaction, type Transaction } from "./transaction.ts";
import { loadReadinessSnapshot } from "./external-readiness-repository.ts";
import { lockStudyOwner } from "./learning-source-repository.ts";

async function preparationPolicy(
  tx: Transaction,
  attemptId: LearningAttempt["attemptId"],
  learnerId: LearnerId,
) {
  const loaded = await loadReadinessSnapshot(tx, attemptId, learnerId);
  const snapshot = loaded === null ? null : { ...loaded };
  if (!snapshot) throw notFoundError("Learning attempt is not available.");
  const policy = await tx.query<{
    questions: unknown;
    external_reference_id: string | null;
    mapping_kind: string;
    mapping_rationale: string;
  }>(
    "SELECT questions,external_reference_id,mapping_kind,mapping_rationale FROM content.external_readiness_rubric WHERE rubric_id=$1 AND version=$2 AND status='published'",
    [snapshot.rubric?.rubricId ?? null, snapshot.rubric?.version ?? null],
  );
  const row = policy.rows[0];
  let questions: readonly ReadinessQuestion[] = [];
  try {
    questions = parseReadinessQuestions(row?.questions);
  } catch {
    snapshot.rubric = null;
  }
  if (
    snapshot.rubric &&
    (snapshot.rubric.requirements.some((r) =>
      r.category === "execution"
        ? r.checkIds.length !== 1 || r.checkIds[0] !== "verified_pass"
        : r.checkIds.length !== questions.filter((q) => q.category === r.category).length ||
          r.checkIds.some((id) => !questions.some((q) => q.id === id && q.category === r.category)),
    ) ||
      !row?.external_reference_id ||
      !row.mapping_rationale.trim())
  )
    snapshot.rubric = null;
  const history = await tx.query<{ reference_id: string }>(
    "SELECT reference_id FROM practice.external_practice_event WHERE learner_id=$1 AND attempt_id=$2 ORDER BY occurred_at DESC,event_id DESC LIMIT 1",
    [learnerId, attemptId],
  );
  const referenceId = row?.external_reference_id ?? history.rows[0]?.reference_id;
  const reference = referenceId
    ? ((
        await tx.query<{ value: ExternalReference }>(
          `SELECT jsonb_build_object('externalReferenceId',r.external_reference_id,'provider',COALESCE(d.platform,r.provider),'externalKey',COALESCE(d.canonical_key,r.external_key),'title',r.title,
      'canonicalUrl',COALESCE(d.canonical_url,r.canonical_url),'attribution',r.attribution,'urlStatus',CASE WHEN d.destination_id IS NOT NULL THEN 'reviewed' ELSE 'unavailable' END,'reviewedBy',r.reviewed_by,'reviewedAt',r.reviewed_at,'version',r.version) value
      FROM content.external_reference r LEFT JOIN content.reviewed_practice_destination d USING(external_reference_id) WHERE r.external_reference_id=$1`,
          [referenceId],
        )
      ).rows[0]?.value ?? null)
    : null;
  return {
    snapshot,
    questions: snapshot.rubric ? questions : [],
    reference,
    relation: row?.mapping_kind ?? "",
    rationale: row?.mapping_rationale ?? "",
  };
}
async function view(
  tx: Transaction,
  attemptId: LearningAttempt["attemptId"],
  learnerId: LearnerId,
): Promise<ExternalPreparationView> {
  const policy = await preparationPolicy(tx, attemptId, learnerId);
  const decision = evaluateExternalReadiness(policy.snapshot);
  const reference = policy.reference;
  const journal = await tx.query<{ kind: ExternalPreparationView["journal"] }>(
    "SELECT kind FROM practice.external_practice_event WHERE learner_id=$1 AND attempt_id=$2 AND reference_id=$3 ORDER BY CASE kind WHEN 'handoff_requested' THEN 1 ELSE 0 END,occurred_at DESC,event_id DESC LIMIT 1",
    [learnerId, attemptId, reference?.externalReferenceId ?? null],
  );
  if (
    !reference ||
    reference.urlStatus !== "reviewed" ||
    !reference.reviewedBy ||
    !reference.reviewedAt ||
    !validateExternalUrl(reference.provider, reference.canonicalUrl).ok
  ) {
    return {
      decision: {
        ...decision,
        status: "not_ready",
        reasons: [
          ...decision.reasons,
          {
            code: "link_unavailable",
            message: "The reviewed external destination is unavailable.",
          },
        ],
      },
      questions: policy.questions.map(
        ({ answer: _answer, category: _category, ...question }) => question,
      ),
      reference: null,
      journal: journal.rows[0]?.kind ?? "none",
    };
  }
  return {
    decision,
    questions: policy.questions.map(
      ({ answer: _answer, category: _category, ...question }) => question,
    ),
    reference: {
      referenceId: reference.externalReferenceId,
      title: reference.title,
      attribution: reference.attribution,
      relation: policy.relation,
      rationale: policy.rationale,
      url:
        decision.status === "ready" && new URL(reference.canonicalUrl).search === ""
          ? reference.canonicalUrl
          : null,
    },
    journal: journal.rows[0]?.kind ?? "none",
  };
}
async function lockPreparation(
  tx: Transaction,
  attemptId: LearningAttempt["attemptId"],
  learnerId: LearnerId,
): Promise<void> {
  await lockStudyOwner(tx, learnerId);
  const attempt = await tx.query(
    "SELECT 1 FROM practice.attempt WHERE attempt_id=$1 AND learner_id=$2 FOR UPDATE",
    [attemptId, learnerId],
  );
  if (!attempt.rowCount) throw notFoundError("Learning attempt is not available.");
  await tx.query("SELECT 1 FROM practice.draft WHERE attempt_id=$1 AND learner_id=$2 FOR SHARE", [
    attemptId,
    learnerId,
  ]);
  await tx.query(
    "SELECT 1 FROM practice.pseudocode_artifact WHERE attempt_id=$1 AND learner_id=$2 FOR SHARE",
    [attemptId, learnerId],
  );
  await tx.query(
    `SELECT 1 FROM content.content_version c JOIN content.problem_version p USING(content_version_id) JOIN practice.attempt a ON a.problem_version_id=p.problem_version_id WHERE a.attempt_id=$1 FOR SHARE OF c`,
    [attemptId],
  );
  await tx.query(
    `SELECT 1 FROM content.problem_language_manifest m JOIN practice.attempt a ON a.manifest_id=m.manifest_id WHERE a.attempt_id=$1 FOR SHARE OF m`,
    [attemptId],
  );
  await tx.query(
    `SELECT 1 FROM content.external_readiness_rubric r JOIN practice.attempt a ON a.problem_version_id=r.problem_version_id AND a.mode=r.mode WHERE a.attempt_id=$1 AND r.status='published' FOR SHARE OF r`,
    [attemptId],
  );
}
export class PostgresExternalCompanionRepository implements ExternalCompanionRepository {
  private readonly pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }
  view(
    attemptId: LearningAttempt["attemptId"],
    learnerId: LearnerId,
  ): Promise<ExternalPreparationView> {
    return withTransaction(this.pool, (tx) => view(tx, attemptId, learnerId), {
      isolationLevel: "repeatable read",
      readOnly: true,
    });
  }
  grade(
    input: Parameters<ExternalCompanionRepository["grade"]>[0],
  ): Promise<ExternalPreparationView> {
    return withTransaction(this.pool, async (tx) => {
      await lockPreparation(tx, input.attemptId, input.learnerId);
      const { snapshot, questions } = await preparationPolicy(tx, input.attemptId, input.learnerId);
      const rubric = snapshot.rubric,
        b = snapshot.binding;
      if (!rubric || !snapshot.contentAvailable || !b.sourceChecksum || b.reasoningRevision < 1)
        throw validationError(
          "Save current source and reasoning under an available published rubric.",
        );
      if (
        Object.keys(input.answers).some((id) => !questions.some((q) => q.id === id)) ||
        questions.some((q) => !q.options.some((o) => o.value === input.answers[q.id]))
      )
        throw validationError("Select one offered answer for each preparation question.");
      const fields = await tx.query<{ fields: Record<string, unknown> }>(
        `SELECT r.fields FROM practice.pseudocode_revision r JOIN practice.pseudocode_artifact p USING(pseudocode_id,learner_id) WHERE p.attempt_id=$1 AND p.learner_id=$2 AND r.revision=$3`,
        [input.attemptId, input.learnerId, b.reasoningRevision],
      );
      const saved = fields.rows[0]?.fields;
      const completeReasoning =
        saved &&
        [
          "inputs",
          "state",
          "initialization",
          "invariant",
          "loop",
          "termination",
          "output",
          "complexity",
        ].every((f) => typeof saved[f] === "string" && (saved[f] as string).trim().length > 0);
      const pass = await tx.query<{ observation_id: string }>(
        `SELECT o.observation_id FROM practice.assessment_observation o JOIN practice.code_run r USING(run_id) WHERE o.attempt_id=$1 AND o.learner_id=$2 AND o.problem_version_id=$3 AND o.manifest_id=$4 AND o.source_checksum=$5 AND o.passed=true AND o.terminal_category='pass' AND r.mode='submit' AND r.classification='success' ORDER BY o.observed_at DESC LIMIT 1`,
        [input.attemptId, input.learnerId, b.problemVersionId, b.manifestId, b.sourceChecksum],
      );
      const facts = [
        ...questions.map((q) => ({
          category: q.category,
          checkId: q.id,
          correct:
            input.answers[q.id] === q.answer &&
            (q.category !== "pseudocode" || Boolean(completeReasoning)),
          provenance: "structured_check",
          source: null,
        })),
        {
          category: "execution",
          checkId: "verified_pass",
          correct: pass.rowCount === 1,
          provenance: "server_observed_test",
          source: pass.rows[0]?.observation_id ?? null,
        },
      ];
      for (const fact of facts)
        await tx.query(
          `INSERT INTO practice.external_readiness_evidence(evidence_id,learner_id,attempt_id,problem_version_id,manifest_id,mode,source_checksum,reasoning_revision,rubric_id,rubric_version,category,check_id,provenance,correct,observed_at,source_observation_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
          [
            input.nextId(),
            input.learnerId,
            input.attemptId,
            b.problemVersionId,
            b.manifestId,
            snapshot.mode,
            b.sourceChecksum,
            b.reasoningRevision,
            rubric.rubricId,
            rubric.version,
            fact.category,
            fact.checkId,
            fact.provenance,
            fact.correct,
            input.now,
            fact.source,
          ],
        );
      return view(tx, input.attemptId, input.learnerId);
    });
  }
  command(
    input: Parameters<ExternalCompanionRepository["command"]>[0],
  ): ReturnType<ExternalCompanionRepository["command"]> {
    return withTransaction(this.pool, async (tx) => {
      await lockPreparation(tx, input.attemptId, input.learnerId);
      const policy = await preparationPolicy(tx, input.attemptId, input.learnerId);
      const reference = policy.reference;
      if (!reference) throw notFoundError("External destination is unavailable.");
      await tx.query(
        "SELECT 1 FROM content.external_reference WHERE external_reference_id=$1 FOR SHARE",
        [reference.externalReferenceId],
      );
      // Reload after the lock: withdrawal may have committed while waiting.
      const current = await preparationPolicy(tx, input.attemptId, input.learnerId);
      const ref = current.reference!;
      let url: string | null = null;
      if (input.action === "open") {
        const readiness = await view(tx, input.attemptId, input.learnerId);
        const safe = validateExternalUrl(ref.provider, ref.canonicalUrl);
        if (
          readiness.decision.status !== "ready" ||
          !safe.ok ||
          new URL(ref.canonicalUrl).search !== "" ||
          (ref.provider === "top_interview_150" &&
            !/^\/problems\/[a-z0-9-]+\/?$/.test(new URL(ref.canonicalUrl).pathname))
        )
          throw validationError("Complete preparation and use an available reviewed destination.");
        url = safe.value;
      }
      const kind = input.action === "open" ? "handoff_requested" : input.action;
      const prior = await tx.query<{ reference_id: string; kind: string; attempt_id: string }>(
        "SELECT reference_id,kind,attempt_id FROM practice.external_practice_event WHERE learner_id=$1 AND idempotency_key=$2",
        [input.learnerId, input.idempotencyKey],
      );
      if (prior.rows[0]) {
        if (
          prior.rows[0].reference_id !== ref.externalReferenceId ||
          prior.rows[0].kind !== kind ||
          prior.rows[0].attempt_id !== input.attemptId
        )
          throw conflictError("External journal key has a different intent.");
        return { status: "recorded", provenance: "learner_reported", url };
      }
      if (input.action !== "open") {
        const events = await tx.query<{ kind: string }>(
          "SELECT kind FROM practice.external_practice_event WHERE learner_id=$1 AND attempt_id=$2 AND reference_id=$3 ORDER BY CASE kind WHEN 'handoff_requested' THEN 1 ELSE 0 END,occurred_at DESC,event_id DESC",
          [input.learnerId, input.attemptId, ref.externalReferenceId],
        );
        if (
          !events.rows.some((e) => e.kind === "handoff_requested") ||
          (input.action === "corrected" && events.rows[0]?.kind !== "completed")
        )
          throw validationError(
            "Record a handoff before confirming; corrections require a completion.",
          );
      }
      await tx.query(
        `INSERT INTO practice.external_practice_event(event_id,learner_id,reference_id,kind,idempotency_key,occurred_at,attempt_id,reference_version,readiness_rubric_id,readiness_rubric_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          input.eventId,
          input.learnerId,
          ref.externalReferenceId,
          kind,
          input.idempotencyKey,
          input.now,
          input.attemptId,
          ref.version,
          current.snapshot.rubric?.rubricId ?? null,
          current.snapshot.rubric?.version ?? null,
        ],
      );
      return { status: "recorded", provenance: "learner_reported", url };
    });
  }
}
