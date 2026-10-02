import { describe, it, expect } from "vitest";
import {
  addCalendarMonths,
  buildBaselinePlan,
  validateRoadmap,
  previewReplan,
  studyDays,
  type RoadmapPreferences,
  type PlanningCatalog,
  type RoadmapHorizon,
} from "@algocove/domain";
const preferences = (months: RoadmapHorizon = 1, minutes = 90): RoadmapPreferences => ({
  goal: "Study the reviewed pilot",
  targetRole: "Engineer",
  horizonMonths: months,
  startDay: "2026-10-02",
  endDay: addCalendarMonths("2026-10-02", months),
  timezone: "Asia/Kolkata",
  dailyCapacityMinutes: minutes,
  studyWeekdays: [1, 2, 3, 4, 5],
  preferredLanguages: ["python"],
  collectionIds: [],
});
const unit = {
  key: "problem:one",
  kind: "internal_problem" as const,
  targetId: "prb_dddddddddddddddd",
  title: "One reviewed exercise",
  href: "/learn/arrays-two-pointer",
  minutes: 60,
  required: true,
  prerequisites: [],
  languages: ["python" as const],
  available: true,
  rightsValid: true,
  linkHealthy: true,
  reasonCodes: ["reviewed_core"],
};
const catalog: PlanningCatalog = {
  curriculumVersionId: null,
  units: [unit],
  masteredKeys: [],
  coverage: "One reviewed pilot",
  fullCoverage: false,
  collections: [],
};
const build = (p = preferences(), c = catalog) =>
  buildBaselinePlan({ preferences: p, catalog: c, scope: "reviewed_pilot", today: p.startDay });
describe("roadmap scheduler and publication validator", () => {
  it("all horizons and capacities produce valid bounded schedules or explicit indivisible rejection", () => {
    for (const h of [1, 2, 3, 4, 6] as const)
      for (const capacity of [15, 30, 60, 90, 480]) {
        const p = preferences(h, capacity),
          result = build(p);
        if (!result.ok) {
          expect(capacity).toBeLessThan(60);
          expect(result.failures[0]?.code).toBe("indivisible_session");
          continue;
        }
        expect(validateRoadmap(result.schedule, catalog, { today: p.startDay })).toEqual([]);
        expect(result.schedule.items.filter((i) => i.kind !== "buffer")).toHaveLength(1);
        for (const day of studyDays(p))
          expect(
            result.schedule.items.filter((i) => i.day === day).reduce((n, i) => n + i.minutes, 0),
          ).toBeLessThanOrEqual(capacity);
      }
  });
  it("clamps leap years and month ends and never pads sparse or full-course goals", () => {
    expect(addCalendarMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addCalendarMonths("2026-10-31", 4)).toBe("2027-02-28");
    expect(
      buildBaselinePlan({
        preferences: preferences(6),
        catalog,
        scope: "full_dsa",
        today: "2026-10-02",
      }),
    ).toMatchObject({ ok: false, failures: [{ code: "insufficient_coverage" }] });
    expect(build(preferences(), { ...catalog, units: [] })).toMatchObject({ ok: false });
  });
  it("deduplicates collection overlap, reserves reviews first and carries beyond-end reviews", () => {
    const review = {
      ...unit,
      key: "review:one",
      kind: "review" as const,
      targetId: "evt_aaaaaaaaaaaaaaaa",
      minutes: 20,
      dueStart: "2026-10-02",
      dueEnd: "2026-10-02",
    };
    const c = {
      ...catalog,
      units: [
        unit,
        unit,
        review,
        { ...review, key: "review:later", dueStart: "2026-12-01", dueEnd: "2026-12-02" },
      ],
    };
    const r = build(preferences(), c);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.schedule.items.filter((i) => i.kind === "internal_problem")).toHaveLength(1);
    expect(r.schedule.beyondEndReviews).toHaveLength(1);
    expect(validateRoadmap(r.schedule, c, { today: "2026-10-02" })).toEqual([]);
  });
  it("preserves history and previews moved/removed/added work without catch-up overload", () => {
    const old = build();
    if (!old.ok) throw Error("fixture");
    const completed = old.schedule.items.filter((i) => i.kind !== "buffer");
    const next = buildBaselinePlan({
      preferences: preferences(),
      catalog,
      scope: "reviewed_pilot",
      today: "2026-10-05",
      fixed: completed,
    });
    if (!next.ok) throw Error("fixture");
    expect(next.schedule.items.filter((i) => i.frozen)).toEqual(
      completed.map((i) => ({ ...i, frozen: true })),
    );
    expect(
      validateRoadmap(next.schedule, catalog, { today: "2026-10-05", fixed: completed }),
    ).toEqual([]);
    expect(previewReplan(old.schedule, next.schedule).retained).toContain(unit.key);
  });
  it("rejects each invalid publication boundary", () => {
    const r = build();
    if (!r.ok) throw Error("fixture");
    for (const [code, mutate] of [
      [
        "capacity_exceeded",
        (s: typeof r.schedule) => {
          s.items.push({
            ...s.items.find((i) => i.kind !== "buffer")!,
            occurrenceId: "second",
            key: "second",
          });
          s.items.push({ ...s.items[0]!, occurrenceId: "third", minutes: 90 });
        },
      ],
      ["duplicate_occurrence", (s: typeof r.schedule) => s.items.push({ ...s.items[0]! })],
      [
        "invalid_date",
        (s: typeof r.schedule) => {
          s.items[0]!.day = "2025-01-01";
        },
      ],
      [
        "unapproved_target",
        (s: typeof r.schedule) => {
          s.items.find((i) => i.kind !== "buffer")!.targetId = "unapproved";
        },
      ],
      [
        "buffer_missing",
        (s: typeof r.schedule) => {
          s.items = s.items.filter((i) => i.kind !== "buffer");
        },
      ],
      [
        "required_missing",
        (s: typeof r.schedule) => {
          s.items = s.items.filter((i) => i.kind === "buffer");
        },
      ],
      [
        "unit_changed",
        (s: typeof r.schedule) => {
          s.items.find((i) => i.kind !== "buffer")!.prerequisites = ["unknown"];
        },
      ],
    ] as const) {
      const schedule = structuredClone(r.schedule);
      mutate(schedule);
      expect(
        validateRoadmap(schedule, catalog, { today: "2026-10-02" }).map((e) => e.code),
      ).toContain(code);
    }
    for (const [field, code] of [
      ["rightsValid", "rights_unavailable"],
      ["linkHealthy", "link_unavailable"],
      ["available", "content_unavailable"],
    ] as const) {
      expect(
        validateRoadmap(
          r.schedule,
          { ...catalog, units: [{ ...unit, [field]: false }] },
          { today: "2026-10-02" },
        ).map((e) => e.code),
      ).toContain(code);
    }
    expect(
      validateRoadmap(
        r.schedule,
        { ...catalog, units: [{ ...unit, languages: ["java"] }] },
        { today: "2026-10-02" },
      ).map((e) => e.code),
    ).toContain("language_unavailable");
  });
  it("blocks prerequisites, infeasible review spacing and missing content", () => {
    expect(
      build(preferences(), { ...catalog, units: [{ ...unit, prerequisites: ["missing"] }] }),
    ).toMatchObject({ ok: false, failures: [{ code: "prerequisite_missing" }] });
    expect(
      build(preferences(), {
        ...catalog,
        units: [{ ...unit, kind: "review", dueStart: "2026-10-03", dueEnd: "2026-10-03" }],
      }),
    ).toMatchObject({ ok: false, failures: [{ code: "review_window" }] });
  });
});
describe("calendar properties and configurable recovery", () => {
  it("respects buffers, missed sessions and optional extensions across capacities and all horizons", () => {
    for (const horizon of [1, 2, 3, 4, 6] as const)
      for (const bufferPercent of [5, 15, 40]) {
        const p = { ...preferences(horizon, 90), bufferPercent },
          c = {
            ...catalog,
            units: [
              unit,
              {
                ...unit,
                key: "optional",
                required: false,
                prerequisites: [unit.key],
                minutes: 30,
                reasonCodes: ["optional_extension"],
              },
            ],
          };
        const r = buildBaselinePlan({
          preferences: p,
          catalog: c,
          scope: "reviewed_pilot",
          today: p.startDay,
          missedDays: ["2026-10-02"],
        });
        if (!r.ok) throw Error("fixture");
        expect(r.schedule.items.some((i) => i.kind !== "buffer" && i.day === "2026-10-02")).toBe(
          false,
        );
        expect(validateRoadmap(r.schedule, c, { today: p.startDay })).toEqual([]);
        expect(
          r.schedule.items.filter((i) => i.kind === "buffer").reduce((n, i) => n + i.minutes, 0),
        ).toBe(Math.ceil(((studyDays(p).length - 1) * 90 * bufferPercent) / 100));
      }
  });
  it("pins representative supported-horizon summaries", () => {
    const snapshots = [1, 2, 3, 4, 6].map((h) => {
      const r = build(preferences(h as RoadmapHorizon));
      if (!r.ok) throw Error("fixture");
      return {
        horizon: h,
        end: r.schedule.preferences.endDay,
        work: r.schedule.items
          .filter((i) => i.kind !== "buffer")
          .map((i) => [i.day, i.key, i.minutes]),
        buffer: r.schedule.items
          .filter((i) => i.kind === "buffer")
          .reduce((n, i) => n + i.minutes, 0),
      };
    });
    expect(snapshots).toMatchSnapshot();
  });
});
