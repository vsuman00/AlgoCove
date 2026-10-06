import type {
  ExternalReadinessDecision,
  LearningAttempt,
  ReviewQuestion,
  ExternalReferenceId,
  Instant,
  LearnerId,
  OpaqueId,
} from "@algocove/domain";
import { validationError } from "./errors.ts";
import type { RequestContext } from "./request-context.ts";

export type ExternalPreparationView = {
  decision: ExternalReadinessDecision;
  questions: readonly ReviewQuestion[];
  reference: {
    referenceId: ExternalReferenceId;
    title: string;
    attribution: string;
    relation: string;
    rationale: string;
    url: string | null;
  } | null;
  journal: "none" | "handoff_requested" | "completed" | "corrected";
};
export type ExternalCompanionRepository = {
  view(
    attemptId: LearningAttempt["attemptId"],
    learnerId: LearnerId,
  ): Promise<ExternalPreparationView>;
  grade(input: {
    attemptId: LearningAttempt["attemptId"];
    learnerId: LearnerId;
    answers: Readonly<Record<string, string>>;
    now: Instant;
    nextId: () => OpaqueId<"event">;
  }): Promise<ExternalPreparationView>;
  command(input: {
    attemptId: LearningAttempt["attemptId"];
    learnerId: LearnerId;
    action: "open" | "completed" | "corrected";
    idempotencyKey: string;
    now: Instant;
    eventId: OpaqueId<"event">;
  }): Promise<{ status: "recorded"; provenance: "learner_reported"; url: string | null }>;
};
export function getOwnedExternalPreparation(
  context: RequestContext,
  repository: ExternalCompanionRepository,
  attemptId: LearningAttempt["attemptId"],
): Promise<ExternalPreparationView> {
  return repository.view(attemptId, context.actor.userId);
}
export function gradeOwnedExternalPreparation(
  context: RequestContext,
  repository: ExternalCompanionRepository,
  input: { attemptId: LearningAttempt["attemptId"]; answers: Readonly<Record<string, string>> },
): Promise<ExternalPreparationView> {
  if (
    Object.keys(input.answers).length > 80 ||
    Object.values(input.answers).some((v) => typeof v !== "string" || v.length > 128)
  )
    throw validationError("Select the offered preparation answers.");
  return repository.grade({
    ...input,
    learnerId: context.actor.userId,
    now: context.now,
    nextId: () => context.ids.generate("event"),
  });
}
export function requestOwnedExternalPractice(
  context: RequestContext,
  repository: ExternalCompanionRepository,
  input: {
    attemptId: LearningAttempt["attemptId"];
    action: "open" | "completed" | "corrected";
    idempotencyKey: string;
  },
): Promise<{ status: "recorded"; provenance: "learner_reported"; url: string | null }> {
  if (
    !/^[A-Za-z0-9._:-]{8,128}$/.test(input.idempotencyKey) ||
    !["open", "completed", "corrected"].includes(input.action)
  )
    throw validationError("Invalid external practice action.");
  return repository.command({
    ...input,
    learnerId: context.actor.userId,
    now: context.now,
    eventId: context.ids.generate("event"),
  });
}
