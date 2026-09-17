import {
  err,
  isBefore,
  normalizeLearnerText,
  ok,
  parseContentChecksum,
  textLength,
  type ContentChecksum,
  type Instant,
  type LearnerId,
  type OpaqueId,
  type Result,
} from "./primitives.ts";

export type ContentId = OpaqueId<"content">;
export type ContentVersionId = OpaqueId<"contentVersion">;
export type ProblemId = OpaqueId<"problem">;
export type ProblemVersionId = OpaqueId<"problemVersion">;

export const CONTENT_STATUSES = ["draft", "published", "retired"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];
export const REVIEW_KINDS = ["technical", "pedagogical"] as const;
export type ReviewKind = (typeof REVIEW_KINDS)[number];
export const REVIEW_DECISIONS = ["approved", "rejected"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];
export type RetirementReason = "retired" | "rights_withdrawn" | "security_tombstone";

export type ContentProvenance = {
  readonly kind: "original" | "licensed";
  /** Rights holder or original author, never copied source material. */
  readonly rightsHolder: string;
  readonly license: string;
  /** Metadata-only source link; licensed content must point to HTTPS. */
  readonly sourceUrl: string | null;
  readonly rightsExpiresAt: Instant | null;
};

export type ContentReview = {
  readonly kind: ReviewKind;
  readonly reviewerId: LearnerId;
  readonly decision: ReviewDecision;
  readonly reviewedAt: Instant;
  readonly notes: string | null;
};

export type ContentValidation = {
  readonly status: "pending" | "passed" | "failed";
  readonly validatedAt: Instant | null;
  readonly validatorId: LearnerId | null;
  readonly message: string | null;
};

export type ProblemContentVersion = {
  readonly contentId: ContentId;
  readonly contentVersionId: ContentVersionId;
  readonly problemId: ProblemId;
  readonly problemVersionId: ProblemVersionId;
  readonly title: string;
  /** Null for licensed records: AlgoCove stores metadata, never copied third-party text. */
  readonly statement: string | null;
  readonly checksum: ContentChecksum;
  readonly provenance: ContentProvenance;
  readonly authorId: LearnerId;
  readonly status: ContentStatus;
  readonly payloadStatus: "available" | "tombstoned";
  readonly reviews: readonly ContentReview[];
  readonly validation: ContentValidation;
  readonly createdAt: Instant;
  readonly publishedAt: Instant | null;
  readonly retiredAt: Instant | null;
  readonly retirementReason: RetirementReason | null;
};

export type ContentFailureCode =
  | "invalid_title"
  | "invalid_statement"
  | "invalid_provenance"
  | "invalid_checksum"
  | "invalid_state"
  | "duplicate_review"
  | "separation_of_duties_violation"
  | "missing_review"
  | "validation_required"
  | "rights_unavailable";

export type ContentFailure = {
  readonly code: ContentFailureCode;
  readonly message: string;
};

function boundedText(value: string, maximum: number): string | null {
  const normalized = normalizeLearnerText(value);
  return normalized.length > 0 && textLength(normalized) <= maximum ? normalized : null;
}

function validHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.username === "" && parsed.password === "";
  } catch {
    return false;
  }
}

export function validateContentProvenance(
  provenance: ContentProvenance,
): Result<undefined, ContentFailure> {
  if (
    boundedText(provenance.rightsHolder, 200) === null ||
    boundedText(provenance.license, 160) === null
  ) {
    return err({
      code: "invalid_provenance",
      message: "Rights holder and license metadata are required.",
    });
  }
  if (provenance.kind === "original") {
    if (provenance.sourceUrl !== null) {
      return err({
        code: "invalid_provenance",
        message: "Original content cannot claim a third-party source URL.",
      });
    }
  } else if (provenance.sourceUrl === null || !validHttpsUrl(provenance.sourceUrl)) {
    return err({
      code: "invalid_provenance",
      message: "Licensed content requires a reviewed HTTPS source URL.",
    });
  }
  return ok(undefined);
}

export function createProblemDraft(input: {
  readonly contentId: ContentId;
  readonly contentVersionId: ContentVersionId;
  readonly problemId: ProblemId;
  readonly problemVersionId: ProblemVersionId;
  readonly title: string;
  readonly statement: string | null;
  readonly checksum: string;
  readonly provenance: ContentProvenance;
  readonly authorId: LearnerId;
  readonly createdAt: Instant;
}): Result<ProblemContentVersion, ContentFailure> {
  const title = boundedText(input.title, 200);
  if (title === null) return err({ code: "invalid_title", message: "Content title is required." });
  const statement = input.statement === null ? null : boundedText(input.statement, 20_000);
  if (input.provenance.kind === "original" && statement === null) {
    return err({
      code: "invalid_statement",
      message: "Original problem candidates require an authored statement.",
    });
  }
  if (input.provenance.kind === "licensed" && input.statement !== null) {
    return err({
      code: "invalid_statement",
      message: "Licensed candidates cannot store a copied third-party statement.",
    });
  }
  const checksum = parseContentChecksum(input.checksum);
  if (!checksum.ok) return err({ code: "invalid_checksum", message: checksum.error.message });
  const provenance = validateContentProvenance(input.provenance);
  if (!provenance.ok) return provenance;
  return ok({
    contentId: input.contentId,
    contentVersionId: input.contentVersionId,
    problemId: input.problemId,
    problemVersionId: input.problemVersionId,
    title,
    statement,
    checksum: checksum.value,
    provenance: { ...input.provenance },
    authorId: input.authorId,
    status: "draft",
    payloadStatus: "available",
    reviews: [],
    validation: { status: "pending", validatedAt: null, validatorId: null, message: null },
    createdAt: input.createdAt,
    publishedAt: null,
    retiredAt: null,
    retirementReason: null,
  });
}

function latestReview(content: ProblemContentVersion, kind: ReviewKind): ContentReview | undefined {
  return [...content.reviews].reverse().find((review) => review.kind === kind);
}

export function recordContentReview(
  content: ProblemContentVersion,
  review: ContentReview,
): Result<ProblemContentVersion, ContentFailure> {
  if (content.status !== "draft") {
    return err({ code: "invalid_state", message: "Only draft content can receive a review." });
  }
  if (review.reviewerId === content.authorId) {
    return err({
      code: "separation_of_duties_violation",
      message: "The author cannot review or publish the same content version.",
    });
  }
  if (
    content.reviews.some(
      (candidate) => candidate.kind === review.kind && candidate.reviewerId === review.reviewerId,
    )
  ) {
    return err({
      code: "duplicate_review",
      message: "A reviewer may record one decision per review kind for a content version.",
    });
  }
  const notes = review.notes === null ? null : boundedText(review.notes, 2_000);
  if (review.notes !== null && notes === null) {
    return err({ code: "invalid_provenance", message: "Review notes exceed the bounded limit." });
  }
  return ok({ ...content, reviews: [...content.reviews, { ...review, notes }] });
}

export function recordContentValidation(
  content: ProblemContentVersion,
  validation: ContentValidation,
): Result<ProblemContentVersion, ContentFailure> {
  if (content.status !== "draft") {
    return err({ code: "invalid_state", message: "Only draft content can be validated." });
  }
  return ok({ ...content, validation: { ...validation } });
}

function rightsAreAvailable(content: ProblemContentVersion, now: Instant): boolean {
  return (
    content.provenance.rightsExpiresAt === null ||
    !isBefore(content.provenance.rightsExpiresAt, now)
  );
}

export function publishProblemContent(
  content: ProblemContentVersion,
  now: Instant,
): Result<ProblemContentVersion, ContentFailure> {
  if (content.status !== "draft") {
    return err({ code: "invalid_state", message: "Only draft content can be published." });
  }
  if (!rightsAreAvailable(content, now)) {
    return err({
      code: "rights_unavailable",
      message: "Content rights are expired or unavailable.",
    });
  }
  if (latestReview(content, "technical")?.decision !== "approved") {
    return err({ code: "missing_review", message: "Technical review approval is required." });
  }
  if (latestReview(content, "pedagogical")?.decision !== "approved") {
    return err({ code: "missing_review", message: "Pedagogical review approval is required." });
  }
  if (content.validation.status !== "passed") {
    return err({
      code: "validation_required",
      message: "Content validation must pass before publication.",
    });
  }
  return ok({ ...content, status: "published", publishedAt: now });
}

export function retireProblemContent(
  content: ProblemContentVersion,
  reason: RetirementReason,
  now: Instant,
): Result<ProblemContentVersion, ContentFailure> {
  if (content.status !== "published") {
    return err({ code: "invalid_state", message: "Only published content can be retired." });
  }
  return ok({
    ...content,
    status: "retired",
    payloadStatus: reason === "retired" ? "available" : "tombstoned",
    retiredAt: now,
    retirementReason: reason,
  });
}

export function canUseForNewWork(content: ProblemContentVersion, now: Instant): boolean {
  return (
    content.status === "published" &&
    content.payloadStatus === "available" &&
    rightsAreAvailable(content, now)
  );
}

/** Safe rendering projection: tombstoned payloads retain metadata but never expose the statement. */
export function renderableContentPayload(
  content: ProblemContentVersion,
): { readonly title: string; readonly statement: string } | null {
  if (content.payloadStatus !== "available" || content.statement === null) return null;
  return { title: content.title, statement: content.statement };
}

/** Checksum is intentionally part of the immutable version identity. */
export function contentVersionChecksum(content: ProblemContentVersion): ContentChecksum {
  return content.checksum;
}
