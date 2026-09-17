import { describe, expect, it } from "vitest";
import {
  createProblemDraft,
  formatId,
  parseInstant,
  publishProblemContent,
  recordContentReview,
  recordContentValidation,
  renderableContentPayload,
  retireProblemContent,
  type Result,
  type ContentReview,
  type ProblemContentVersion,
} from "@algocove/domain";

const instant = parseInstant(new Date("2026-09-17T10:00:00.000Z"));
const expired = parseInstant(new Date("2026-09-16T10:00:00.000Z"));
const author = formatId("learner", "aaaaaaaaaaaaaaaa");
const technicalReviewer = formatId("learner", "bbbbbbbbbbbbbbbb");
const pedagogicalReviewer = formatId("learner", "cccccccccccccccc");
const contentId = formatId("content", "dddddddddddddddd");
const contentVersionId = formatId("contentVersion", "eeeeeeeeeeeeeeee");
const problemId = formatId("problem", "ffffffffffffffff");
const problemVersionId = formatId("problemVersion", "gggggggggggggggg");

if (
  !instant.ok ||
  !expired.ok ||
  !author.ok ||
  !technicalReviewer.ok ||
  !pedagogicalReviewer.ok ||
  !contentId.ok ||
  !contentVersionId.ok ||
  !problemId.ok ||
  !problemVersionId.ok
) {
  throw new Error("content lifecycle fixtures are invalid");
}

function unwrap<T, F>(result: Result<T, F>): T {
  if (!result.ok) throw new Error("content lifecycle fixtures are invalid");
  return result.value;
}

const instantValue = unwrap(instant);
const expiredValue = unwrap(expired);
const authorValue = unwrap(author);
const technicalReviewerValue = unwrap(technicalReviewer);
const pedagogicalReviewerValue = unwrap(pedagogicalReviewer);
const contentIdValue = unwrap(contentId);
const contentVersionIdValue = unwrap(contentVersionId);
const problemIdValue = unwrap(problemId);
const problemVersionIdValue = unwrap(problemVersionId);

function draft(
  overrides: Partial<Parameters<typeof createProblemDraft>[0]> = {},
): ProblemContentVersion {
  const result = createProblemDraft({
    contentId: contentIdValue,
    contentVersionId: contentVersionIdValue,
    problemId: problemIdValue,
    problemVersionId: problemVersionIdValue,
    title: "Pair sum without copying a source problem",
    statement: "Given an array, return whether two values sum to the target.",
    checksum: `sha256:${"a".repeat(64)}`,
    provenance: {
      kind: "original",
      rightsHolder: "AlgoCove",
      license: "algocove-original-v1",
      sourceUrl: null,
      rightsExpiresAt: null,
    },
    authorId: authorValue,
    createdAt: instantValue,
    ...overrides,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function review(
  kind: ContentReview["kind"],
  reviewerId: ContentReview["reviewerId"],
): ContentReview {
  return {
    kind,
    reviewerId,
    decision: "approved",
    reviewedAt: instantValue,
    notes: null,
  };
}

function readyContent(): ProblemContentVersion {
  const technical = recordContentReview(draft(), review("technical", technicalReviewerValue));
  if (!technical.ok) throw new Error(technical.error.message);
  const pedagogical = recordContentReview(
    technical.value,
    review("pedagogical", pedagogicalReviewerValue),
  );
  if (!pedagogical.ok) throw new Error(pedagogical.error.message);
  const validated = recordContentValidation(pedagogical.value, {
    status: "passed",
    validatedAt: instantValue,
    validatorId: technicalReviewerValue,
    message: null,
  });
  if (!validated.ok) throw new Error(validated.error.message);
  return validated.value;
}

describe("governed content lifecycle", () => {
  it("blocks publication until both reviews and validation pass", () => {
    expect(publishProblemContent(draft(), instantValue)).toMatchObject({
      ok: false,
      error: { code: "missing_review" },
    });
    const technical = recordContentReview(draft(), review("technical", technicalReviewerValue));
    if (!technical.ok) throw new Error(technical.error.message);
    expect(publishProblemContent(technical.value, instantValue)).toMatchObject({
      ok: false,
      error: { code: "missing_review" },
    });
  });

  it("publishes an original version only after separated approvals and validation", () => {
    const result = publishProblemContent(readyContent(), instantValue);
    expect(result).toMatchObject({
      ok: true,
      value: { status: "published", payloadStatus: "available" },
    });
  });

  it("rejects copied licensed statements at draft creation", () => {
    expect(
      createProblemDraft({
        ...draft(),
        statement: "copied source text",
        provenance: {
          kind: "licensed",
          rightsHolder: "External publisher",
          license: "reviewed-license",
          sourceUrl: "https://example.com/problems/1",
          rightsExpiresAt: null,
        },
      }),
    ).toMatchObject({ ok: false, error: { code: "invalid_statement" } });
  });

  it("tombstones withdrawn rights while retaining safe historical metadata", () => {
    const published = publishProblemContent(readyContent(), instantValue);
    if (!published.ok) throw new Error(published.error.message);
    const retired = retireProblemContent(published.value, "rights_withdrawn", instantValue);
    if (!retired.ok) throw new Error(retired.error.message);
    expect(retired.value.status).toBe("retired");
    expect(renderableContentPayload(retired.value)).toBeNull();
  });

  it("blocks publication when rights have expired", () => {
    const content = draft({
      provenance: {
        kind: "original",
        rightsHolder: "AlgoCove",
        license: "algocove-original-v1",
        sourceUrl: null,
        rightsExpiresAt: expiredValue,
      },
    });
    expect(publishProblemContent(content, instantValue)).toMatchObject({
      ok: false,
      error: { code: "rights_unavailable" },
    });
  });
});
