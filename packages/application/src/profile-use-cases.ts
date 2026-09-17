import {
  parseLearnerProfileInput,
  type LearnerProfile,
  type LearnerProfileInput,
} from "@algocove/domain";
import { conflictError, validationError } from "./errors.ts";
import { requireOwnership, type RequestContext } from "./request-context.ts";

export type LearnerProfileRepository = {
  get(learnerId: LearnerProfile["learnerId"]): Promise<LearnerProfile | null>;
  create(profile: LearnerProfile): Promise<LearnerProfile>;
  update(input: {
    readonly learnerId: LearnerProfile["learnerId"];
    readonly expectedVersion: number;
    readonly profile: LearnerProfile;
  }): Promise<LearnerProfile | null>;
};

export async function getLearnerProfile(
  context: RequestContext,
  repository: LearnerProfileRepository,
  learnerId: LearnerProfile["learnerId"] = context.actor.userId,
): Promise<LearnerProfile | null> {
  requireOwnership(context, learnerId);
  return repository.get(learnerId);
}

export async function saveLearnerProfile(
  context: RequestContext,
  repository: LearnerProfileRepository,
  input: unknown,
): Promise<LearnerProfile> {
  requireOwnership(context, context.actor.userId);
  const parsed = parseLearnerProfileInput(input);
  if (!parsed.ok) {
    throw validationError(parsed.error.message, { field: parsed.error.code });
  }

  const current = await repository.get(context.actor.userId);
  if (current === null) {
    const profile = createProfile(context, parsed.value);
    return repository.create(profile);
  }

  const version = typeof input === "object" && input !== null ? (input as { version?: unknown }).version : undefined;
  if (!Number.isInteger(version) || version !== current.version) {
    throw conflictError("Profile changed since it was loaded.", { currentVersion: current.version });
  }
  const next = repository.update({
    learnerId: context.actor.userId,
    expectedVersion: current.version,
    profile: {
      ...current,
      ...parsed.value,
      version: current.version + 1,
      updatedAt: context.now,
      updatedBy: context.actor.userId,
    },
  });
  const updated = await next;
  if (updated === null) {
    throw conflictError("Profile changed since it was loaded.", { currentVersion: current.version });
  }
  return updated;
}

function createProfile(context: RequestContext, input: LearnerProfileInput): LearnerProfile {
  return {
    ...input,
    learnerId: context.actor.userId,
    version: 1,
    createdAt: context.now,
    updatedAt: context.now,
    updatedBy: context.actor.userId,
  };
}
