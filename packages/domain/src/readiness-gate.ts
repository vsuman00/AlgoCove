import type { ContentChecksum, LearnerId, OpaqueId } from "./primitives.ts";
import type { LearningAttempt, LearningMode } from "./practice.ts";
import type { EvidenceClass } from "./mastery.ts";

export const READINESS_CATEGORIES = [
  "concept",
  "pattern",
  "invariant",
  "pseudocode",
  "execution",
  "visualization",
] as const;
export type ReadinessCategory = (typeof READINESS_CATEGORIES)[number];

/** Authored, published policy; never supplied by a learner request. */
export type ExternalReadinessRubric = {
  readonly rubricId: string;
  readonly version: number;
  readonly problemVersionId: LearningAttempt["problemVersionId"];
  readonly mode: LearningMode;
  readonly published: boolean;
  readonly requirements: readonly {
    readonly category: ReadinessCategory;
    readonly checkIds: readonly string[];
  }[];
  readonly maximumAssistanceTier: number;
};

export type ReadinessBinding = {
  readonly learnerId: LearnerId;
  readonly attemptId: LearningAttempt["attemptId"];
  readonly problemVersionId: LearningAttempt["problemVersionId"];
  readonly manifestId: LearningAttempt["manifestId"];
  readonly sourceChecksum: ContentChecksum | null;
  readonly reasoningRevision: number;
};

/** Persisted facts loaded through a trusted application port, never client claims. */
export type ExternalReadinessEvidence = ReadinessBinding & {
  readonly evidenceId: OpaqueId<"event">;
  readonly rubricId: string;
  readonly rubricVersion: number;
  readonly category: ReadinessCategory;
  readonly checkId: string;
  readonly provenance: EvidenceClass;
  readonly correct: boolean;
};

export type ExternalReadinessDecision = {
  readonly status: "ready" | "not_ready";
  readonly rubricId: string | null;
  readonly rubricVersion: number | null;
  readonly reasons: readonly { readonly code: string; readonly message: string }[];
  readonly evidenceIds: readonly OpaqueId<"event">[];
  readonly bypassAvailable: false;
};

export function evaluateExternalReadiness(input: {
  readonly binding: ReadinessBinding;
  readonly mode: LearningMode;
  readonly contentAvailable: boolean;
  readonly rubric: ExternalReadinessRubric | null;
  readonly highestAssistanceTier: number | null;
  readonly evidence: readonly ExternalReadinessEvidence[];
  readonly bypassRequested?: boolean;
}): ExternalReadinessDecision {
  const reasons: { code: string; message: string }[] = [];
  const evidenceIds = new Set<OpaqueId<"event">>();
  const { rubric, binding } = input;
  if (input.bypassRequested)
    reasons.push({
      code: "bypass_disabled",
      message: "Complete internal preparation before external practice.",
    });
  if (!input.contentAvailable)
    reasons.push({
      code: "content_unavailable",
      message: "This internal learning version is unavailable.",
    });
  if (
    rubric === null ||
    !validRubric(rubric) ||
    !rubric.published ||
    rubric.problemVersionId !== binding.problemVersionId ||
    rubric.mode !== input.mode
  ) {
    reasons.push({
      code: "rubric_unavailable",
      message: "A published readiness rubric is required for this problem and mode.",
    });
  } else {
    if (
      binding.sourceChecksum === null ||
      !Number.isSafeInteger(binding.reasoningRevision) ||
      binding.reasoningRevision < 1
    )
      reasons.push({
        code: "artifacts_required",
        message: "Save current source and a reasoning revision before checking readiness.",
      });
    if (
      input.highestAssistanceTier === null ||
      !Number.isInteger(input.highestAssistanceTier) ||
      input.highestAssistanceTier < 0 ||
      input.highestAssistanceTier > rubric.maximumAssistanceTier
    )
      reasons.push({
        code: "assistance_limit",
        message: "Assistance must be known and within this rubric's limit.",
      });
    for (const requirement of rubric.requirements) {
      for (const checkId of requirement.checkIds) {
        const fact = input.evidence.find(
          (item) =>
            item.category === requirement.category &&
            item.checkId === checkId &&
            item.correct &&
            item.rubricId === rubric.rubricId &&
            item.rubricVersion === rubric.version &&
            item.learnerId === binding.learnerId &&
            item.attemptId === binding.attemptId &&
            item.problemVersionId === binding.problemVersionId &&
            item.manifestId === binding.manifestId &&
            item.sourceChecksum === binding.sourceChecksum &&
            item.reasoningRevision === binding.reasoningRevision &&
            (requirement.category === "execution"
              ? item.provenance === "server_observed_test"
              : item.provenance === "structured_check" || item.provenance === "human_reviewed"),
        );
        if (fact === undefined)
          reasons.push({
            code: `missing:${requirement.category}:${checkId}`,
            message: `Complete the current ${requirement.category} check.`,
          });
        else evidenceIds.add(fact.evidenceId);
      }
    }
  }
  return {
    status: reasons.length === 0 ? "ready" : "not_ready",
    rubricId: rubric?.rubricId ?? null,
    rubricVersion: rubric?.version ?? null,
    reasons,
    evidenceIds: [...evidenceIds],
    bypassAvailable: false,
  };
}

function validRubric(rubric: ExternalReadinessRubric): boolean {
  return (
    /^[a-zA-Z0-9._:-]{1,128}$/.test(rubric.rubricId) &&
    Number.isSafeInteger(rubric.version) &&
    rubric.version > 0 &&
    Number.isInteger(rubric.maximumAssistanceTier) &&
    rubric.maximumAssistanceTier >= 0 &&
    rubric.maximumAssistanceTier <= 6 &&
    rubric.requirements.length === READINESS_CATEGORIES.length &&
    READINESS_CATEGORIES.every(
      (category) => rubric.requirements.filter((r) => r.category === category).length === 1,
    ) &&
    rubric.requirements.every(
      (r) =>
        r.checkIds.length > 0 &&
        r.checkIds.length <= 16 &&
        new Set(r.checkIds).size === r.checkIds.length &&
        r.checkIds.every((id) => /^[a-zA-Z0-9._:-]{1,128}$/.test(id)),
    )
  );
}
