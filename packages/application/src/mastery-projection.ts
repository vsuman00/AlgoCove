import {
  MASTERY_POLICY_V1,
  parseMasteryEvidence,
  type ConceptId,
  type CodeRunId,
  type Instant,
  type LearnerId,
  type MasteryEvidence,
  type MasteryPolicy,
  type MasteryProjection,
  type OpaqueId,
  type ProblemVersionId,
} from "@algocove/domain";
import type { AssessmentObservation, ExecutionResultClassification } from "./code-run-use-cases.ts";
import { dependencyUnavailableError, notFoundError, validationError } from "./errors.ts";
import { requireRole, type IdGenerator, type RequestContext } from "./request-context.ts";

export const ASSESSMENT_TOPIC = "practice.assessment.observed";
export type AssessmentEvidenceSource = {
  /** Read the persisted event and its immutable practice observation, not a caller's payload. */
  loadAssessment(eventId: OpaqueId<"event">): Promise<{
    readonly sourceEventId: OpaqueId<"event">;
    readonly observation: AssessmentObservation;
    readonly classification: ExecutionResultClassification;
  } | null>;
};
export type MasteryConceptSource = {
  getConcepts(problemVersionId: ProblemVersionId): Promise<readonly ConceptId[]>;
};
export type MasteryView = {
  readonly status: "ready" | "projection_pending";
  readonly projection: MasteryProjection;
};
export type MasteryCommit = {
  readonly disposition: "committed" | "replayed";
  readonly projections: readonly MasteryProjection[];
};
export type MasteryRepository = {
  recordAndProject(input: {
    readonly evidence: readonly MasteryEvidence[];
    readonly policy: MasteryPolicy;
    readonly ingestedAt: Instant;
    readonly updateEventIds: readonly OpaqueId<"event">[];
  }): Promise<MasteryCommit>;
  rebuild(input: {
    readonly learnerId: LearnerId;
    readonly conceptId: ConceptId;
    readonly policy: MasteryPolicy;
  }): Promise<MasteryProjection>;
  readView(input: {
    readonly learnerId: LearnerId;
    readonly conceptId: ConceptId;
    readonly policyVersion: number;
    readonly afterObservationId?: OpaqueId<"event">;
  }): Promise<MasteryView | null>;
};
export type MasteryIngestionPorts = {
  readonly practice: AssessmentEvidenceSource;
  readonly curriculum: MasteryConceptSource;
  readonly mastery: MasteryRepository;
};

export async function consumePracticeAssessment(
  context: { readonly now: Instant; readonly ids: IdGenerator },
  ports: MasteryIngestionPorts,
  eventId: OpaqueId<"event">,
): Promise<MasteryCommit> {
  const source = await ports.practice.loadAssessment(eventId);
  if (source === null) throw validationError("Assessment source event is not available.");
  const concepts = [
    ...new Set(await ports.curriculum.getConcepts(source.observation.problemVersionId)),
  ].sort();
  if (concepts.length === 0)
    throw dependencyUnavailableError("Assessment has no published concept mapping.");
  const o = source.observation;
  const expectedClassification =
    o.terminalCategory === "pass"
      ? "success"
      : o.terminalCategory === "infrastructure_error"
        ? "infrastructure_failure"
        : o.terminalCategory === "cancelled"
          ? "control_plane"
          : "learner_failure";
  if (source.classification !== expectedClassification)
    throw validationError("Assessment source classification is inconsistent.");
  const evidence = concepts.map((conceptId) => {
    const parsed = parseMasteryEvidence({
      sourceEventId: source.sourceEventId,
      observationId: o.observationId,
      learnerId: o.learnerId,
      conceptId,
      attemptId: o.attemptId,
      problemVersionId: o.problemVersionId,
      language: o.language,
      observedAt: o.observedAt,
      provenance: "server_observed_test",
      rubricVersion: "practice-assessment/v1",
      evidencePolicyVersion: 1,
      outcome: o.terminalCategory,
      correct: o.passed,
      assistanceTier: o.assistanceTier,
      explanationCorrect: null,
      explanationProvenance: null,
      confidence: null,
      confidenceProvenance: null,
      delayMs: null,
      transfer: null,
      transferProvenance: null,
    });
    if (!parsed.ok) throw validationError(parsed.error.message);
    return parsed.value;
  });
  return ports.mastery.recordAndProject({
    evidence,
    policy: MASTERY_POLICY_V1,
    ingestedAt: context.now,
    updateEventIds: concepts.map(() => context.ids.generate("event")),
  });
}

export async function getOwnedMasteryView(
  context: RequestContext,
  repository: MasteryRepository,
  input: { readonly conceptId: ConceptId; readonly afterObservationId?: OpaqueId<"event"> },
): Promise<MasteryView> {
  const view = await repository.readView({
    learnerId: context.actor.userId,
    conceptId: input.conceptId,
    policyVersion: MASTERY_POLICY_V1.version,
    ...(input.afterObservationId === undefined
      ? {}
      : { afterObservationId: input.afterObservationId }),
  });
  if (view === null) throw notFoundError("Assessment is not available to this learner.");
  return view;
}

/** Saved submission receipt is immediate; its derived concept views may lag. */
export async function getOwnedSubmissionMastery(
  context: RequestContext,
  ports: {
    readonly practice: {
      getSubmissionObservation(
        runId: CodeRunId,
        learnerId: LearnerId,
      ): Promise<{
        observationId: OpaqueId<"event">;
        problemVersionId: ProblemVersionId;
      } | null>;
    };
    readonly curriculum: MasteryConceptSource;
    readonly mastery: MasteryRepository;
  },
  runId: CodeRunId,
): Promise<{
  readonly observationId: OpaqueId<"event">;
  readonly status: "ready" | "projection_pending";
  readonly concepts: readonly MasteryView[];
}> {
  const receipt = await ports.practice.getSubmissionObservation(runId, context.actor.userId);
  if (receipt === null) throw dependencyUnavailableError("Submission observation is unavailable.");
  const concepts = [
    ...new Set(await ports.curriculum.getConcepts(receipt.problemVersionId)),
  ].sort();
  const views = await Promise.all(
    concepts.map((conceptId) =>
      getOwnedMasteryView(context, ports.mastery, {
        conceptId,
        afterObservationId: receipt.observationId,
      }),
    ),
  );
  return {
    observationId: receipt.observationId,
    status:
      concepts.length === 0 || views.some((view) => view.status === "projection_pending")
        ? ("projection_pending" as const)
        : ("ready" as const),
    concepts: views,
  };
}

/** Operator replay can compare another policy without promoting it to learners. */
export async function rebuildMasteryProjection(
  context: RequestContext,
  repository: MasteryRepository,
  input: {
    readonly learnerId: LearnerId;
    readonly conceptId: ConceptId;
    readonly policy?: MasteryPolicy;
  },
): Promise<MasteryProjection> {
  requireRole(context, "operator");
  return repository.rebuild({
    learnerId: input.learnerId,
    conceptId: input.conceptId,
    policy: input.policy ?? MASTERY_POLICY_V1,
  });
}
