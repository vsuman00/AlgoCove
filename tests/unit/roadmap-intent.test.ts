import { describe, expect, it } from "vitest";
import {
  addCalendarMonths,
  parseRoadmapPreferences,
  parseInstant,
  ROADMAP_HORIZONS,
} from "@algocove/domain";
const parsed = parseInstant("2026-10-02T10:00:00Z");
if (!parsed.ok) throw Error("fixture");
const now = parsed.value;
const input = {
  goal: " Learn patterns ",
  targetRole: "Engineer",
  horizonMonths: 1,
  startDay: "2026-10-31",
  timezone: "Asia/Kolkata",
  dailyCapacityMinutes: 45,
  studyWeekdays: [5, 1, 3],
  preferredLanguages: ["python", "c"],
  collectionIds: [],
};
describe("Task 34 planning preferences", () => {
  it("uses all declared horizons and clamps calendar-month ends, including leap years", () => {
    expect(ROADMAP_HORIZONS.map((horizon) => addCalendarMonths("2026-10-31", horizon))).toEqual([
      "2026-11-30",
      "2026-12-31",
      "2027-01-31",
      "2027-02-28",
      "2027-04-30",
    ]);
    expect(addCalendarMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addCalendarMonths("2023-01-31", 1)).toBe("2023-02-28");
    expect(addCalendarMonths("2026-12-31", 2)).toBe("2027-02-28");
  });
  it("normalizes preferences and resolves matching explicit target dates", () => {
    expect(parseRoadmapPreferences({ ...input, targetDay: "2026-11-30" }, now)).toMatchObject({
      goal: "Learn patterns",
      endDay: "2026-11-30",
      studyWeekdays: [1, 3, 5],
    });
    expect(() => parseRoadmapPreferences({ ...input, targetDay: "2026-12-01" }, now)).toThrow(
      /conflicts/,
    );
  });
  it("rejects unsupported horizons, invalid dates, missing capacity/languages, duplicate collections and weekdays", () => {
    for (const invalid of [
      { horizonMonths: 5 },
      { horizonMonths: "1" },
      { startDay: "2026-02-30" },
      { startDay: "2026-10-01" },
      { timezone: "invalid" },
      { dailyCapacityMinutes: 14 },
      { dailyCapacityMinutes: 481 },
      { preferredLanguages: ["rust"] },
      { preferredLanguages: ["c", "c"] },
      { studyWeekdays: [] },
      { studyWeekdays: [1, 1] },
      { studyWeekdays: [0] },
      { collectionIds: ["col_aaaaaaaaaaaaaaaa", "col_aaaaaaaaaaaaaaaa"] },
    ])
      expect(() => parseRoadmapPreferences({ ...input, ...invalid }, now)).toThrow();
  });
  it("uses the selected timezone for prospective-date validation at a UTC boundary", () => {
    const p = parseInstant("2026-10-02T00:30:00Z");
    if (!p.ok) throw Error("fixture");
    expect(
      parseRoadmapPreferences(
        { ...input, startDay: "2026-10-01", timezone: "America/New_York" },
        p.value,
      ).startDay,
    ).toBe("2026-10-01");
    expect(() =>
      parseRoadmapPreferences(
        { ...input, startDay: "2026-10-01", timezone: "Asia/Kolkata" },
        p.value,
      ),
    ).toThrow(/prospective/);
  });
});
