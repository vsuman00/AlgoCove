import { describe, expect, it } from "vitest";
import { reviewWindow, reviewTiming } from "../../packages/domain/src/review-schedule.ts";
import { projectConsistency, localStudyDay } from "../../packages/domain/src/consistency.ts";
import { recommendNext } from "../../packages/domain/src/recommendation.ts";
import { parseInstant, formatId, type ConceptId, type ProblemVersionId } from "@algocove/domain";
const time = (s: string) => {
  const p = parseInstant(s);
  if (!p.ok) throw Error("fixture");
  return p.value;
};
describe("Phase 6 policy contracts", () => {
  it("stores elapsed UTC review windows through spring and autumn DST", () => {
    for (const start of ["2026-03-07T18:00:00Z", "2026-10-31T18:00:00Z"]) {
      const w = reviewWindow(time(start), "independent_completion");
      expect(Date.parse(w.dueStart) - Date.parse(start)).toBe(3 * 86400000);
      expect(reviewTiming({ ...w, status: "due" }, time("2030-01-01T00:00:00Z"))).toBe("overdue");
    }
  });
  it("deduplicates activity and credits paused days without fabricating activity", () => {
    const now = time("2026-03-10T12:00:00Z");
    const a = {
      observationId: "a",
      occurredAt: now,
      localDay: "2026-03-10",
      timezone: "America/New_York",
      kind: "review" as const,
    };
    const b = { ...a, observationId: "b", localDay: "2026-03-08" };
    const p = projectConsistency({
      now,
      timezone: a.timezone,
      activities: [a, a, b],
      pauses: [{ startDay: "2026-03-09", endDay: "2026-03-09", timezone: a.timezone }],
    });
    expect(p).toMatchObject({ activeDays: 2, currentStreak: 2, longestStreak: 2, graceDays: 0 });
    expect(
      projectConsistency({ now, timezone: a.timezone, activities: [a, b], pauses: [] })
        .currentStreak,
    ).toBe(1);
    expect(localStudyDay(time("2026-03-08T04:30:00Z"), a.timezone)).toBe("2026-03-07");
  });
  it("uses cold-start intro, due reviews, and excludes retired/unavailable languages", () => {
    const p = formatId("problemVersion", "aaaaaaaaaaaaaaaa"),
      c = formatId("concept", "aaaaaaaaaaaaaaaa");
    if (!p.ok || !c.ok) throw Error("fixture");
    const candidate = {
      problemVersionId: p.value,
      conceptId: c.value,
      title: "two pointers",
      href: "/learn/arrays-two-pointer",
      languages: ["python" as const],
      available: true,
      prerequisites: [],
      band: "unassessed",
      lastPracticed: null,
    };
    const input = {
      goal: "practice",
      preferredLanguages: ["python" as const],
      candidates: [candidate],
      dueReview: false,
    };
    expect(recommendNext(input).action.kind).toBe("intro");
    expect(recommendNext({ ...input, dueReview: true }).action.kind).toBe("review");
    expect(
      recommendNext({ ...input, candidates: [{ ...candidate, available: false }] }).action.kind,
    ).toBe("unavailable");
    expect(recommendNext({ ...input, preferredLanguages: ["c" as const] }).action.kind).toBe(
      "unavailable",
    );
  });
});

describe("calendar and recommendation scenario properties", () => {
  it("keeps calendar days stable across DST, leap day and international date boundaries", () => {
    for (const timezone of [
      "UTC",
      "America/New_York",
      "Europe/Berlin",
      "Asia/Kolkata",
      "Pacific/Auckland",
    ])
      for (const date of ["2024-02-29", "2026-03-08", "2026-11-01"]) {
        const now = time(`${date}T12:00:00Z`);
        const localDay = localStudyDay(now, timezone);
        const activity = {
          observationId: "one",
          occurredAt: now,
          localDay,
          timezone,
          kind: "review" as const,
        };
        for (let repeats = 1; repeats < 8; repeats++)
          expect(
            projectConsistency({
              now,
              timezone,
              activities: Array.from({ length: repeats }, () => activity),
              pauses: [],
            }),
          ).toMatchObject({ activeDays: 1, currentStreak: 1, longestStreak: 1 });
        expect(
          projectConsistency({
            now,
            timezone,
            activities: [],
            pauses: [{ startDay: localDay, endDay: localDay, timezone }],
          }).currentStreak,
        ).toBe(0);
      }
  });
  it("uses prerequisites, uncertainty, diversity and stable reasons regardless of candidate order", () => {
    const id = (kind: "concept" | "problemVersion", n: number) => {
      const result = formatId(kind, String(n).padStart(16, "0"));
      if (!result.ok) throw Error("fixture");
      return result.value;
    };
    const prerequisite = id("concept", 9) as ConceptId;
    const candidates = [1, 2, 3, 4].map((n) => ({
      problemVersionId: id("problemVersion", n) as ProblemVersionId,
      conceptId: id("concept", n) as ConceptId,
      title: `Pattern ${n}`,
      href: `/learn/${n}`,
      languages: ["python" as const, "c" as const],
      available: n !== 4,
      prerequisites: n === 1 ? [prerequisite] : [],
      band: n === 1 ? "needs_practice" : "independent_completion",
      lastPracticed: time(`2026-10-0${n}T10:00:00Z`),
    }));
    const input = {
      goal: "Review algorithm patterns",
      preferredLanguages: ["c" as const],
      verifiedConcepts: [prerequisite],
      candidates,
      dueReview: false,
    };
    const expected = recommendNext(input);
    expect(expected.action.href).toBe("/learn/1?language=c");
    expect(expected.action.reasonCodes).toContain("concept_needs_practice");
    expect(expected.alternatives.map((a) => a.href)).toEqual([
      "/learn/2?language=c",
      "/learn/3?language=c",
    ]);
    for (let rotation = 0; rotation < 4; rotation++)
      expect(
        recommendNext({
          ...input,
          candidates: [...candidates.slice(rotation), ...candidates.slice(0, rotation)],
        }),
      ).toEqual(expected);
    expect(recommendNext({ ...input, verifiedConcepts: [] }).action.href).toBe(
      "/learn/2?language=c",
    );
    expect(recommendNext({ ...input, goal: null }).action.kind).toBe("profile");
  });
});
