import { describe, it, expect } from "vitest";
import {
  projectPlanAdherence,
  buildBaselinePlan,
  parseRoadmapPreferences,
  parseInstant,
  type Instant,
  type PlanningCatalog,
} from "@algocove/domain";
const parsed = parseInstant("2026-10-02T10:00:00Z");
if (!parsed.ok) throw Error("fixture");
const now = parsed.value;
const p = parseRoadmapPreferences(
  {
    goal: "Pilot",
    targetRole: "Engineer",
    horizonMonths: 1,
    startDay: "2026-10-02",
    timezone: "UTC",
    dailyCapacityMinutes: 90,
    studyWeekdays: [1, 2, 3, 4, 5],
    preferredLanguages: ["python"],
    collectionIds: [],
  },
  now,
);
const c: PlanningCatalog = {
  curriculumVersionId: null,
  fullCoverage: false,
  coverage: "Pilot",
  collections: [],
  masteredKeys: [],
  units: [
    {
      key: "one",
      kind: "internal_problem",
      targetId: "prb_dddddddddddddddd",
      title: "Pilot",
      href: "/learn/arrays-two-pointer",
      minutes: 50,
      required: true,
      prerequisites: [],
      languages: ["python"],
      available: true,
      rightsValid: true,
      linkHealthy: true,
      reasonCodes: [],
    },
  ],
};
const result = buildBaselinePlan({
  preferences: p,
  catalog: c,
  scope: "reviewed_pilot",
  today: p.startDay,
});
if (!result.ok) throw Error("fixture");
const schedule = result.schedule;
const event = (
  kind: string,
  id: string,
  occurrenceId: string | null = null,
  day = "2026-10-02",
  reversesId: string | null = null,
) => ({
  eventId: id,
  versionId: "v1",
  kind,
  occurrenceId,
  reversesId,
  localDay: day,
  occurredAt: `${day}T10:00:00Z` as Instant,
});
describe("accepted plan adherence projection", () => {
  it("separates no plan, paused obligations and reported check-ins", () => {
    expect(projectPlanAdherence({ state: null, history: [], journal: [] }, now)).toMatchObject({
      status: "no_accepted_plan",
      totalDue: null,
    });
    const history = [{ versionId: "v1", schedule }];
    expect(
      projectPlanAdherence({ state: { status: "active" }, history, journal: [] }, now),
    ).toMatchObject({ totalDue: 1, completedOnTime: 0 });
    expect(
      projectPlanAdherence(
        { state: { status: "paused" }, history, journal: [event("paused", "p")] },
        now,
      ),
    ).toMatchObject({ totalDue: 0, completedOnTime: 0 });
    expect(
      projectPlanAdherence(
        { state: { status: "active" }, history, journal: [event("done", "d", "one")] },
        now,
      ),
    ).toMatchObject({ totalDue: 1, completedOnTime: 1 });
  });
  it("counts retained occurrences once across versions and reverses via appended events", () => {
    const history = [
      { versionId: "v1", schedule },
      {
        versionId: "v2",
        schedule: { ...schedule, items: schedule.items.map((i) => ({ ...i, frozen: true })) },
      },
    ];
    const journal = [event("done", "d", "one"), event("superseded", "s")];
    expect(
      projectPlanAdherence({ state: { status: "active" }, history, journal }, now),
    ).toMatchObject({ totalDue: 1, completedOnTime: 1 });
    expect(
      projectPlanAdherence(
        {
          state: { status: "active" },
          history,
          journal: [...journal, event("reversed", "r", "one", "2026-10-02", "d")],
        },
        now,
      ),
    ).toMatchObject({ totalDue: 1, completedOnTime: 0 });
  });
});
