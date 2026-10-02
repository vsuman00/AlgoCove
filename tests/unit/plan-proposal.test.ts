import { describe, it, expect, vi } from "vitest";
import {
  proposeValidatedPlan,
  fixturePlanProposal,
  buildOwnedRoadmap,
  createActor,
  createFixedClock,
  createRequestContext,
  type RoadmapRepository,
} from "@algocove/application";
import {
  buildBaselinePlan,
  parseRoadmapPreferences,
  parseInstant,
  formatId,
  type PlanningCatalog,
} from "@algocove/domain";
const now = "2026-10-02T10:00:00Z" as const;
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
  (() => {
    const value = parseInstant(now);
    if (!value.ok) throw Error("fixture");
    return value.value;
  })(),
);
const catalog: PlanningCatalog = {
  curriculumVersionId: null,
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
      reasonCodes: ["reviewed"],
    },
  ],
  masteredKeys: [],
  coverage: "Pilot only",
  fullCoverage: false,
  collections: [],
};
const result = buildBaselinePlan({
  preferences: p,
  catalog,
  scope: "reviewed_pilot",
  today: p.startDay,
});
if (!result.ok) throw Error("fixture");
const baseline = result.schedule;
describe("bounded fixture proposals", () => {
  it.each(["malformed", "injected", "over_capacity", "failure", "timeout"] as const)(
    "falls back on %s without losing the baseline",
    async (mode) => {
      const value = await proposeValidatedPlan({
        baseline,
        catalog,
        fixed: [],
        today: p.startDay,
        provider: fixturePlanProposal(mode),
        timeoutMs: 5,
      });
      expect(value).toEqual({
        schedule: baseline,
        lineage: "baseline_provider_fallback",
        success: false,
      });
    },
  );
  it("validates fixture output without activation rights", async () => {
    expect(
      await proposeValidatedPlan({
        baseline,
        catalog,
        fixed: [],
        today: p.startDay,
        provider: fixturePlanProposal("valid"),
      }),
    ).toMatchObject({ success: true, lineage: "fixture_validated" });
  });
  it("budget denial yields a baseline and does not call a provider", async () => {
    const owner = formatId("learner", "eeeeeeeeeeeeeeee"),
      session = formatId("session", "eeeeeeeeeeeeeeee"),
      instant = parseInstant(now);
    if (!owner.ok || !session.ok || !instant.ok) throw Error("fixture");
    const context = createRequestContext({
      actor: createActor({ userId: owner.value, sessionId: session.value, roles: ["learner"] }),
      clock: createFixedClock(instant.value),
      ids: {
        generate(kind) {
          const id = formatId(kind, "aaaaaaaaaaaaaaaa");
          if (!id.ok) throw Error("fixture");
          return id.value;
        },
      },
      serviceName: "proposal-test",
    });
    const source = {
      intent: {
        planId: context.ids.generate("roadmapPlan"),
        learnerId: owner.value,
        version: 1,
        preferences: p,
        savedAt: instant.value,
      },
      catalog,
      state: null,
      fixed: [],
      missedDays: [],
    };
    const repository: RoadmapRepository = {
      source: vi.fn().mockResolvedValue(source),
      receipt: vi.fn().mockResolvedValue(null),
      saveCandidate: vi.fn().mockImplementation((i) => i.candidate),
      view: vi.fn(),
      command: vi.fn(),
    };
    const provider = { propose: vi.fn() },
      budget = {
        reserve: vi
          .fn()
          .mockResolvedValue({ allowed: false, reason: "daily_cap", retryAfterSeconds: 60 }),
        finish: vi.fn(),
      };
    expect(
      await buildOwnedRoadmap(
        context,
        repository,
        {
          scope: "reviewed_pilot",
          expectedToken: null,
          idempotencyKey: "budget-denial-fixture",
          useProposal: true,
        },
        { provider, budget },
      ),
    ).toMatchObject({ status: "valid", lineage: "baseline_budget_daily_cap" });
    expect(provider.propose).not.toHaveBeenCalled();
    expect(budget.finish).not.toHaveBeenCalled();
  });
});
