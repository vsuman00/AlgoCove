import {
  createProblemDraft,
  publishProblemContent,
  recordContentReview,
  recordContentValidation,
  retireProblemContent,
  type ContentReview,
  type ContentValidation,
  type ProblemContentVersion,
  type RetirementReason,
} from "@algocove/domain";
import { requirePermission } from "./authorize.ts";
import { validationError } from "./errors.ts";
import { PERMISSIONS } from "@algocove/domain";
import type { RequestContext } from "./request-context.ts";

export type ContentRepository = {
  get(versionId: ProblemContentVersion["contentVersionId"]): Promise<ProblemContentVersion | null>;
  save(content: ProblemContentVersion): Promise<ProblemContentVersion>;
};

export async function createProblemContentDraft(
  context: RequestContext,
  repository: ContentRepository,
  input: {
    readonly title: string;
    readonly statement: string | null;
    readonly checksum: string;
    readonly provenance: Parameters<typeof createProblemDraft>[0]["provenance"];
  },
): Promise<ProblemContentVersion> {
  requirePermission(context, PERMISSIONS.contentAuthor);
  const draft = createProblemDraft({
    ...input,
    contentId: context.ids.generate("content"),
    contentVersionId: context.ids.generate("contentVersion"),
    problemId: context.ids.generate("problem"),
    problemVersionId: context.ids.generate("problemVersion"),
    authorId: context.actor.userId,
    createdAt: context.now,
  });
  if (!draft.ok) throw validationError(draft.error.message, { field: draft.error.code });
  return repository.save(draft.value);
}

export async function reviewProblemContent(
  context: RequestContext,
  repository: ContentRepository,
  input: {
    readonly versionId: ProblemContentVersion["contentVersionId"];
    readonly review: ContentReview;
  },
): Promise<ProblemContentVersion> {
  const permission =
    input.review.kind === "technical"
      ? PERMISSIONS.contentTechnicalReview
      : PERMISSIONS.contentPedagogicalReview;
  requirePermission(context, permission);
  if (input.review.reviewerId !== context.actor.userId) {
    throw validationError("A review must be recorded for the authenticated reviewer.");
  }
  const content = await requireContent(repository, input.versionId);
  const result = recordContentReview(content, input.review);
  if (!result.ok) throw validationError(result.error.message, { field: result.error.code });
  return repository.save(result.value);
}

export async function validateProblemContent(
  context: RequestContext,
  repository: ContentRepository,
  input: {
    readonly versionId: ProblemContentVersion["contentVersionId"];
    readonly validation: ContentValidation;
  },
): Promise<ProblemContentVersion> {
  requirePermission(context, PERMISSIONS.contentEvaluate);
  const content = await requireContent(repository, input.versionId);
  const result = recordContentValidation(content, input.validation);
  if (!result.ok) throw validationError(result.error.message, { field: result.error.code });
  return repository.save(result.value);
}

export async function publishProblemVersion(
  context: RequestContext,
  repository: ContentRepository,
  versionId: ProblemContentVersion["contentVersionId"],
): Promise<ProblemContentVersion> {
  requirePermission(context, PERMISSIONS.contentPublish);
  const content = await requireContent(repository, versionId);
  if (content.authorId === context.actor.userId) {
    throw validationError("The author cannot publish the same content version.");
  }
  const result = publishProblemContent(content, context.now);
  if (!result.ok) throw validationError(result.error.message, { field: result.error.code });
  return repository.save(result.value);
}

export async function retireProblemVersion(
  context: RequestContext,
  repository: ContentRepository,
  input: {
    readonly versionId: ProblemContentVersion["contentVersionId"];
    readonly reason: RetirementReason;
  },
): Promise<ProblemContentVersion> {
  requirePermission(context, PERMISSIONS.contentPublish);
  const content = await requireContent(repository, input.versionId);
  const result = retireProblemContent(content, input.reason, context.now);
  if (!result.ok) throw validationError(result.error.message, { field: result.error.code });
  return repository.save(result.value);
}

async function requireContent(
  repository: ContentRepository,
  versionId: ProblemContentVersion["contentVersionId"],
): Promise<ProblemContentVersion> {
  const content = await repository.get(versionId);
  if (content === null) throw new Error("Content version is unavailable.");
  return content;
}
