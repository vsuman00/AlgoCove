import {
  buildContentWorkflowReadModel,
  type ContentWorkflowReadModel,
} from "@algocove/application";
import {
  completeProblemManifest,
  createExternalReference,
  createProblemDraft,
  formatId,
  LANGUAGE_PROFILES,
  parseInstant,
  recordContentReview,
  recordContentValidation,
  reviewExternalReference,
  type ContentReview,
  type ProblemContentVersion,
} from "@algocove/domain";

function id<T extends Parameters<typeof formatId>[0]>(kind: T, value: string) {
  const result = formatId(kind, value);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function instant(): ProblemContentVersion["createdAt"] {
  const result = parseInstant(new Date("2026-09-17T10:00:00.000Z"));
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function reviewedContent(): ProblemContentVersion {
  const now = instant();
  const draft = createProblemDraft({
    contentId: id("content", "aaaaaaaaaaaaaaaa"),
    contentVersionId: id("contentVersion", "bbbbbbbbbbbbbbbb"),
    problemId: id("problem", "cccccccccccccccc"),
    problemVersionId: id("problemVersion", "dddddddddddddddd"),
    title: "Pair sum without copying a source problem",
    statement: "Given an array and a target, determine whether two values sum to the target.",
    checksum: `sha256:${"a".repeat(64)}`,
    provenance: {
      kind: "original",
      rightsHolder: "AlgoCove",
      license: "algocove-original-v1",
      sourceUrl: null,
      rightsExpiresAt: null,
    },
    authorId: id("learner", "eeeeeeeeeeeeeeee"),
    createdAt: now,
  });
  if (!draft.ok) throw new Error(draft.error.message);
  const technical = recordContentReview(draft.value, {
    kind: "technical",
    reviewerId: id("learner", "ffffffffffffffff"),
    decision: "approved",
    reviewedAt: now,
    notes: "Boundary and complexity review recorded.",
  } satisfies ContentReview);
  if (!technical.ok) throw new Error(technical.error.message);
  const pedagogical = recordContentReview(technical.value, {
    kind: "pedagogical",
    reviewerId: id("learner", "gggggggggggggggg"),
    decision: "approved",
    reviewedAt: now,
    notes: "Objective and progression review recorded.",
  } satisfies ContentReview);
  if (!pedagogical.ok) throw new Error(pedagogical.error.message);
  const validated = recordContentValidation(pedagogical.value, {
    status: "passed",
    validatedAt: now,
    validatorId: id("learner", "hhhhhhhhhhhhhhhh"),
    message: null,
  });
  if (!validated.ok) throw new Error(validated.error.message);
  return validated.value;
}

function reviewedExternalReference() {
  const now = instant();
  const reference = createExternalReference({
    externalReferenceId: id("externalReference", "jjjjjjjjjjjjjjjj"),
    provider: "blind",
    externalKey: "two-sum",
    title: "Two Sum",
    canonicalUrl: "https://blind75.com/problems/two-sum",
    attribution: "Blind 75",
  });
  if (!reference.ok) throw new Error(reference.error.message);
  const reviewed = reviewExternalReference(reference.value, {
    reviewerId: id("learner", "kkkkkkkkkkkkkkkk"),
    status: "reviewed",
    reviewedAt: now,
  });
  if (!reviewed.ok) throw new Error(reviewed.error.message);
  return reviewed.value;
}

export function phase3ContentFixture(): ContentWorkflowReadModel {
  const candidate = reviewedContent();
  const manifest = completeProblemManifest({
    problemVersionId: candidate.problemVersionId,
    fixtures: [
      { fixtureId: "pair-sum-small", semanticKey: "pair_sum_small" },
      { fixtureId: "pair-sum-empty", semanticKey: "pair_sum_empty" },
    ],
    languages: LANGUAGE_PROFILES.map((profile) => ({
      language: profile.language,
      starterTemplate: `starter for ${profile.language}`,
      entrySignature: profile.entrySignature,
      adapterId: profile.adapterId,
      limitsProfile: { ...profile.limitsProfile },
      fixtureIds: ["pair-sum-small", "pair-sum-empty"],
    })),
  });
  if (!manifest.ok) throw new Error(manifest.error.message);
  return buildContentWorkflowReadModel({
    candidate,
    manifest: manifest.value,
    externalReference: reviewedExternalReference(),
  });
}
