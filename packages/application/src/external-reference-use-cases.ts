import {
  createExternalReference,
  reviewExternalReference,
  type ExternalReference,
  type ExternalReferenceId,
} from "@algocove/domain";
import { requirePermission } from "./authorize.ts";
import { validationError } from "./errors.ts";
import { PERMISSIONS } from "@algocove/domain";
import type { RequestContext } from "./request-context.ts";

export type ExternalReferenceRepository = {
  get(referenceId: ExternalReferenceId): Promise<ExternalReference | null>;
  save(reference: ExternalReference): Promise<ExternalReference>;
};

export async function createReviewedExternalReference(
  context: RequestContext,
  repository: ExternalReferenceRepository,
  input: {
    readonly provider: string;
    readonly externalKey: string;
    readonly title: string;
    readonly canonicalUrl: string;
    readonly attribution: string;
  },
): Promise<ExternalReference> {
  requirePermission(context, PERMISSIONS.contentAuthor);
  const result = createExternalReference({
    ...input,
    externalReferenceId: context.ids.generate("externalReference"),
  });
  if (!result.ok) throw validationError(result.error.message, { field: result.error.code });
  return repository.save(result.value);
}

export async function reviewExternalLink(
  context: RequestContext,
  repository: ExternalReferenceRepository,
  input: {
    readonly referenceId: ExternalReferenceId;
    readonly status: "reviewed" | "unavailable" | "blocked";
  },
): Promise<ExternalReference> {
  requirePermission(context, PERMISSIONS.contentTechnicalReview);
  const current = await repository.get(input.referenceId);
  if (current === null) throw new Error("External reference is unavailable.");
  const result = reviewExternalReference(current, {
    reviewerId: context.actor.userId,
    status: input.status,
    reviewedAt: context.now,
  });
  if (!result.ok) throw validationError(result.error.message, { field: result.error.code });
  return repository.save(result.value);
}
