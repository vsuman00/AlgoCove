import {
  err,
  isId,
  ok,
  parseInstant,
  type Instant,
  type LearnerId,
  type OpaqueId,
  type Result,
} from "./primitives.ts";
import { PROBLEM_LANGUAGES, type ProblemLanguage } from "./language-manifest.ts";
import type { ConceptId } from "./curriculum.ts";

export const EVIDENCE_CLASSES = [
  "server_observed_test",
  "structured_check",
  "human_reviewed",
  "model_advisory",
  "learner_reported",
  "interaction_only",
] as const;
export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number];
export const MASTERY_OUTCOMES = [
  "pass",
  "wrong_answer",
  "compile_error",
  "type_error",
  "runtime_error",
  "limits",
  "cancelled",
  "infrastructure_error",
] as const;
export type MasteryOutcome = (typeof MASTERY_OUTCOMES)[number];

/** Source facts remain unchanged when a projection policy changes. */
export type MasteryEvidence = {
  readonly sourceEventId: OpaqueId<"event">;
  readonly observationId: OpaqueId<"event">;
  readonly learnerId: LearnerId;
  readonly conceptId: ConceptId;
  readonly attemptId: OpaqueId<"attempt">;
  readonly problemVersionId: OpaqueId<"problemVersion">;
  readonly language: ProblemLanguage;
  readonly observedAt: Instant;
  readonly provenance: EvidenceClass;
  readonly rubricVersion: string;
  readonly evidencePolicyVersion: number;
  readonly outcome: MasteryOutcome;
  readonly correct: boolean;
  readonly assistanceTier: number | null;
  readonly explanationCorrect: boolean | null;
  readonly explanationProvenance: EvidenceClass | null;
  readonly confidence: "low" | "medium" | "high" | null;
  readonly confidenceProvenance: EvidenceClass | null;
  readonly delayMs: number | null;
  readonly transfer: boolean | null;
  readonly transferProvenance: EvidenceClass | null;
};

export type MasteryPolicy = {
  readonly version: number;
  readonly requireValidatedExplanation: boolean;
};
export const MASTERY_POLICY_V1: MasteryPolicy = { version: 1, requireValidatedExplanation: false };
export type MasteryBand =
  | "unassessed"
  | "needs_practice"
  | "completion_unclassified"
  | "assisted_completion"
  | "independent_completion"
  | "independent_delayed_transfer";
export type MasteryProjection = {
  readonly learnerId: LearnerId;
  readonly conceptId: ConceptId;
  readonly policyVersion: number;
  readonly band: MasteryBand;
  readonly reasonCodes: readonly string[];
  readonly evidenceWatermark: string;
  readonly evidenceCount: number;
  readonly asOf: Instant | null;
  readonly lastPracticed: Instant | null;
  /** Counts of observed language outcomes, never a language-neutral mastery score. */
  readonly languageProficiency: Partial<
    Record<
      ProblemLanguage,
      {
        readonly observedPasses: number;
        readonly compileErrors: number;
        readonly typeErrors: number;
      }
    >
  >;
};
export type MasteryFailure = {
  readonly code: "invalid_evidence" | "evidence_conflict" | "invalid_policy";
  readonly message: string;
};

export function parseMasteryEvidence(value: unknown): Result<MasteryEvidence, MasteryFailure> {
  const invalid = () =>
    err<MasteryFailure>({
      code: "invalid_evidence",
      message: "Mastery evidence does not satisfy the source-fact contract.",
    });
  if (typeof value !== "object" || value === null || Array.isArray(value)) return invalid();
  const v = value as Record<string, unknown>;
  if (
    !isId("event", v.sourceEventId) ||
    !isId("event", v.observationId) ||
    !isId("learner", v.learnerId) ||
    !isId("concept", v.conceptId) ||
    !isId("attempt", v.attemptId) ||
    !isId("problemVersion", v.problemVersionId)
  )
    return invalid();
  const observed = parseInstant(v.observedAt);
  if (
    !observed.ok ||
    !PROBLEM_LANGUAGES.includes(v.language as ProblemLanguage) ||
    !EVIDENCE_CLASSES.includes(v.provenance as EvidenceClass) ||
    !MASTERY_OUTCOMES.includes(v.outcome as MasteryOutcome) ||
    typeof v.correct !== "boolean" ||
    v.correct !== (v.outcome === "pass") ||
    typeof v.rubricVersion !== "string" ||
    !/^[A-Za-z0-9._:/-]{1,128}$/.test(v.rubricVersion) ||
    !Number.isSafeInteger(v.evidencePolicyVersion) ||
    Number(v.evidencePolicyVersion) < 1
  )
    return invalid();
  if (
    v.assistanceTier !== null &&
    (!Number.isInteger(v.assistanceTier) ||
      Number(v.assistanceTier) < 0 ||
      Number(v.assistanceTier) > 6)
  )
    return invalid();
  if (v.explanationCorrect !== null && typeof v.explanationCorrect !== "boolean") return invalid();
  if (
    v.explanationProvenance !== null &&
    !EVIDENCE_CLASSES.includes(v.explanationProvenance as EvidenceClass)
  )
    return invalid();
  if ((v.explanationCorrect === null) !== (v.explanationProvenance === null)) return invalid();
  if (
    v.confidence !== null &&
    (typeof v.confidence !== "string" || !["low", "medium", "high"].includes(v.confidence))
  )
    return invalid();
  if (
    v.confidenceProvenance !== null &&
    !EVIDENCE_CLASSES.includes(v.confidenceProvenance as EvidenceClass)
  )
    return invalid();
  if ((v.confidence === null) !== (v.confidenceProvenance === null)) return invalid();
  if (v.delayMs !== null && (!Number.isSafeInteger(v.delayMs) || Number(v.delayMs) <= 0))
    return invalid();
  if (v.transfer !== null && typeof v.transfer !== "boolean") return invalid();
  if (
    v.transferProvenance !== null &&
    !EVIDENCE_CLASSES.includes(v.transferProvenance as EvidenceClass)
  )
    return invalid();
  if (
    (v.transfer === null) !== (v.transferProvenance === null) ||
    (v.transfer === true && v.delayMs === null)
  )
    return invalid();
  return ok({
    sourceEventId: v.sourceEventId as OpaqueId<"event">,
    observationId: v.observationId as OpaqueId<"event">,
    learnerId: v.learnerId as LearnerId,
    conceptId: v.conceptId as ConceptId,
    attemptId: v.attemptId as OpaqueId<"attempt">,
    problemVersionId: v.problemVersionId as OpaqueId<"problemVersion">,
    language: v.language as ProblemLanguage,
    observedAt: observed.value,
    provenance: v.provenance as EvidenceClass,
    rubricVersion: v.rubricVersion,
    evidencePolicyVersion: Number(v.evidencePolicyVersion),
    outcome: v.outcome as MasteryOutcome,
    correct: v.correct,
    assistanceTier: v.assistanceTier as number | null,
    explanationCorrect: v.explanationCorrect as boolean | null,
    explanationProvenance: v.explanationProvenance as EvidenceClass | null,
    confidence: v.confidence as MasteryEvidence["confidence"],
    confidenceProvenance: v.confidenceProvenance as EvidenceClass | null,
    delayMs: v.delayMs as number | null,
    transfer: v.transfer as boolean | null,
    transferProvenance: v.transferProvenance as EvidenceClass | null,
  });
}

const VERIFIED = new Set<EvidenceClass>([
  "server_observed_test",
  "structured_check",
  "human_reviewed",
]);

/** A descriptive rule set: immediate completion never certifies retained mastery. */
export function projectMastery(input: {
  readonly learnerId: LearnerId;
  readonly conceptId: ConceptId;
  readonly evidence: readonly MasteryEvidence[];
  readonly policy?: MasteryPolicy;
}): Result<MasteryProjection, MasteryFailure> {
  const policy = input.policy ?? MASTERY_POLICY_V1;
  if (
    !Number.isSafeInteger(policy.version) ||
    policy.version < 1 ||
    typeof policy.requireValidatedExplanation !== "boolean"
  )
    return err({
      code: "invalid_policy",
      message: "Mastery policy must have an explicit positive version and explanation rule.",
    });
  const deduped = new Map<string, MasteryEvidence>();
  for (const value of input.evidence) {
    const parsed = parseMasteryEvidence(value);
    if (!parsed.ok) return parsed;
    const e = parsed.value;
    if (e.learnerId !== input.learnerId || e.conceptId !== input.conceptId)
      return err({
        code: "invalid_evidence",
        message: "Evidence belongs to another learner or concept.",
      });
    const previous = deduped.get(e.observationId);
    if (previous !== undefined && JSON.stringify(previous) !== JSON.stringify(e))
      return err({
        code: "evidence_conflict",
        message: "One source observation has conflicting facts.",
      });
    deduped.set(e.observationId, e);
  }
  const ordered = [...deduped.values()].sort((a, b) =>
    a.observedAt < b.observedAt
      ? -1
      : a.observedAt > b.observedAt
        ? 1
        : a.observationId < b.observationId
          ? -1
          : a.observationId > b.observationId
            ? 1
            : 0,
  );
  const reasons = new Set<string>();
  let band: MasteryBand = "unassessed";
  let lastPracticed: Instant | null = null;
  let delayedTransferObserved = false;
  const languageProficiency: MasteryProjection["languageProficiency"] = {};
  for (const e of ordered) {
    if (!VERIFIED.has(e.provenance)) {
      reasons.add("unverified_evidence_excluded");
      continue;
    }
    if (e.outcome === "infrastructure_error" || e.outcome === "cancelled") {
      reasons.add(
        e.outcome === "cancelled" ? "cancelled_outcome_excluded" : "infrastructure_fault_excluded",
      );
      continue;
    }
    lastPracticed = e.observedAt;
    if (e.provenance === "server_observed_test") {
      const overlay = languageProficiency[e.language] ?? {
        observedPasses: 0,
        compileErrors: 0,
        typeErrors: 0,
      };
      languageProficiency[e.language] = {
        observedPasses: overlay.observedPasses + Number(e.outcome === "pass"),
        compileErrors: overlay.compileErrors + Number(e.outcome === "compile_error"),
        typeErrors: overlay.typeErrors + Number(e.outcome === "type_error"),
      };
    }
    if (e.outcome === "compile_error" || e.outcome === "type_error") {
      reasons.add("language_failure_only");
      continue;
    }
    if (!e.correct) {
      band = "needs_practice";
      reasons.add("verified_concept_failure");
      continue;
    }
    const explanation =
      e.explanationCorrect === true &&
      e.explanationProvenance !== null &&
      VERIFIED.has(e.explanationProvenance);
    if (e.assistanceTier === null) {
      band = "completion_unclassified";
      reasons.add("assistance_unknown");
    } else if (e.assistanceTier > 0) {
      band = "assisted_completion";
      reasons.add(
        e.assistanceTier === 6
          ? "solution_disclosed"
          : e.assistanceTier >= 4
            ? "strategy_disclosed"
            : "shallow_assistance",
      );
    } else if (policy.requireValidatedExplanation && !explanation) {
      band = "completion_unclassified";
      reasons.add("validated_explanation_required");
    } else if (
      e.transfer === true &&
      e.delayMs !== null &&
      e.transferProvenance !== null &&
      VERIFIED.has(e.transferProvenance)
    ) {
      band = "independent_delayed_transfer";
      delayedTransferObserved = true;
      reasons.add("verified_independent_delayed_transfer");
    } else {
      band = "independent_completion";
      reasons.add("independent_immediate_completion");
    }
    if (explanation) reasons.add("validated_explanation_observed");
  }
  if (band === "unassessed") reasons.add("no_verified_concept_outcome");
  if (!delayedTransferObserved) reasons.add("delayed_transfer_unobserved");
  const latest = ordered.at(-1);
  return ok({
    learnerId: input.learnerId,
    conceptId: input.conceptId,
    policyVersion: policy.version,
    band,
    reasonCodes: [...reasons].sort(),
    evidenceWatermark:
      // Identify the complete immutable source set, including backfills and
      // privacy removals. An adapter may compact this token with a checksum.
      latest === undefined
        ? "0"
        : `observations/v1:${ordered.map((e) => e.observationId).join(",")}`,
    evidenceCount: ordered.length,
    asOf: latest?.observedAt ?? null,
    lastPracticed,
    languageProficiency,
  });
}
