import { describe, it, expect, vi } from "vitest";
import {
  buildBaselinePlan,
  parseRoadmapPreferences,
  parseInstant,
  validateRoadmap,
  ROADMAP_HORIZONS,
  type PlanningCatalog,
} from "@algocove/domain";
import { proposeValidatedPlan } from "@algocove/application";
import {
  createRoadmapProposalAdapter,
  approvedRoadmapGenerationAdapter,
  roadmapModelManifest,
  type RoadmapGenerationPort,
  type RoadmapProposalEvidence,
} from "@algocove/tutor";
const now = parseInstant("2026-10-06T00:00:00Z");
if (!now.ok) throw Error();
const instant = now.value;
const catalog: PlanningCatalog = {
  curriculumVersionId: null,
  units: [
    {
      key: "one",
      kind: "internal_problem",
      targetId: "prb_dddddddddddddddd",
      title: "Original reviewed fixture",
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
  coverage: "Pilot",
  fullCoverage: false,
  collections: [],
};
function baseline(horizon: (typeof ROADMAP_HORIZONS)[number] = 1) {
  const preferences = parseRoadmapPreferences(
    {
      goal: "PRIVATE_GOAL_CANARY",
      targetRole: "PRIVATE_ROLE_CANARY",
      horizonMonths: horizon,
      startDay: "2026-10-06",
      timezone: "UTC",
      dailyCapacityMinutes: 90,
      studyWeekdays: [1, 2, 3, 4, 5],
      preferredLanguages: ["python"],
      collectionIds: [],
    },
    instant,
  );
  const result = buildBaselinePlan({
    preferences,
    catalog,
    scope: "reviewed_pilot",
    today: preferences.startDay,
  });
  if (!result.ok) throw Error();
  return result.schedule;
}
function port(generate: RoadmapGenerationPort["generate"]): RoadmapGenerationPort {
  return {
    configuration: {
      version: "roadmap.fixture.primary.v1",
      provider: "fixture",
      model: "synthetic.v1",
      kind: "fixture",
      approvalReference: null,
      region: "local",
      dataPolicy: "synthetic-only",
      allowPrivateCode: false,
    },
    generate,
  };
}
const valid: RoadmapGenerationPort["generate"] = async (r) => ({
  items: r.items.map((i) => ({ index: i.index, day: i.day })),
});
function adapter(
  primary = port(valid),
  fallback: RoadmapGenerationPort | null = null,
  overrides: Partial<Parameters<typeof createRoadmapProposalAdapter>[0]> = {},
) {
  return createRoadmapProposalAdapter({
    bundleVersion: "synthetic.bundle.v1",
    primary,
    fallback,
    authorize: async () => true,
    validate: (candidate, schedule) =>
      !validateRoadmap({ ...schedule, items: candidate.items }, catalog, {
        today: schedule.preferences.startDay,
        fixed: [],
      }).length,
    record: async () => {},
    attemptTimeoutMs: 5,
    ...overrides,
  });
}
const propose = (provider: ReturnType<typeof adapter>, schedule = baseline()) =>
  proposeValidatedPlan({
    baseline: schedule,
    catalog,
    fixed: [],
    today: schedule.preferences.startDay,
    provider,
  });
describe("Task45a synthetic roadmap gateway", () => {
  it.each(ROADMAP_HORIZONS)(
    "validates horizon %s without sending learner free text",
    async (horizon) => {
      const generate = vi.fn(valid),
        record = vi.fn(async (_evidence: RoadmapProposalEvidence) => {}),
        value = await propose(adapter(port(generate), null, { record }), baseline(horizon));
      expect(value.success).toBe(true);
      expect(value.lineage).toBe("gateway_validated:synthetic.bundle.v1");
      const encoded = JSON.stringify(generate.mock.calls[0]![0]);
      for (const forbidden of [
        "PRIVATE_GOAL_CANARY",
        "PRIVATE_ROLE_CANARY",
        "Original reviewed fixture",
        "/learn/",
        "learnerId",
        "collectionIds",
        "timezone",
      ])
        expect(encoded).not.toContain(forbidden);
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: "validated",
          modelVersion: "roadmap.fixture.primary.v1",
          promptVersion: "roadmap.prompt.v1",
          policyVersion: "roadmap.policy.v1",
        }),
      );
    },
  );
  it.each([
    "failure",
    "timeout",
    "malformed",
    "injected",
    "foreign",
    "duplicate",
    "missing",
    "over_capacity",
  ])("validates fallback after rejected primary %s", async (mode) => {
    const primary = port(async (r) => {
        if (mode === "failure") throw Error("PRIVATE_TRANSPORT_CANARY");
        if (mode === "timeout") return new Promise(() => {});
        if (mode === "malformed") return "not-json";
        if (mode === "injected")
          return { items: r.items.map((i) => ({ index: i.index, day: i.day })), command: "accept" };
        if (mode === "foreign")
          return { items: r.items.map((i) => ({ index: i.index + 1000, day: i.day })) };
        if (mode === "duplicate") return { items: r.items.map((i) => ({ index: 0, day: i.day })) };
        if (mode === "missing") return { items: [] };
        return { items: r.items.map((i) => ({ index: i.index, day: r.startDay })) };
      }),
      fallback = port(vi.fn(valid)),
      record = vi.fn(async (_evidence: RoadmapProposalEvidence) => {});
    expect((await propose(adapter(primary, fallback, { record }))).success).toBe(true);
    expect(fallback.generate).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0]![0]).toMatchObject({ outcome: "rejected" });
    expect(JSON.stringify(record.mock.calls)).not.toContain("PRIVATE_TRANSPORT_CANARY");
  });

  it("accepts a genuine date change while retaining every canonical content field", async () => {
    const original = baseline();
    const changed = port(async (r) => ({
      items: r.items.map((i) => ({
        index: i.index,
        day: i.kind === "internal_problem" ? "2026-10-07" : i.day,
      })),
    }));
    const value = await propose(adapter(changed), original);
    expect(value.success).toBe(true);
    const unit = value.schedule.items.find((i) => i.kind === "internal_problem")!;
    expect(unit.day).toBe("2026-10-07");
    const source = original.items.find((i) => i.kind === "internal_problem")!;
    expect({ ...unit, day: source.day, dueEnd: source.dueEnd }).toEqual(source);
  });
  it("retains the baseline when both providers fail or promotion is absent", async () => {
    const fail = port(async () => {
      throw Error();
    });
    expect((await propose(adapter(fail, fail))).success).toBe(false);
    const generate = vi.fn(valid);
    expect(
      (await propose(adapter(port(generate), null, { authorize: async () => false }))).success,
    ).toBe(false);
    expect(generate).not.toHaveBeenCalled();
  });
  it("fences authorization withdrawal while provider output is buffered", async () => {
    const authorize = vi.fn().mockResolvedValueOnce(true).mockResolvedValue(false);
    expect((await propose(adapter(port(valid), null, { authorize }))).success).toBe(false);
  });
  it("rejects changed capacity/current catalog and does not invent full coverage", async () => {
    const schedule = baseline();
    schedule.preferences = { ...schedule.preferences, dailyCapacityMinutes: 15 };
    expect((await propose(adapter(), schedule)).success).toBe(false);
    const full = buildBaselinePlan({
      preferences: baseline().preferences,
      catalog,
      scope: "full_dsa",
      today: "2026-10-06",
    });
    expect(full.ok).toBe(false);
    const generate = vi.fn(valid);
    expect(
      (
        await propose(
          adapter(port(generate), null, {
            validate: (c) =>
              !validateRoadmap(
                { ...baseline(), items: c.items },
                { ...catalog, units: catalog.units.map((u) => ({ ...u, available: false })) },
                { today: "2026-10-06" },
              ).length,
          }),
        )
      ).success,
    ).toBe(false);
  });
  it("requires no private code and approved provider metadata; strips extraneous config fields", () => {
    const config = {
      ...port(valid).configuration,
      kind: "approved" as const,
      approvalReference: "owner.decision.v1",
    };
    expect(() =>
      approvedRoadmapGenerationAdapter({ ...config, allowPrivateCode: true }, valid),
    ).toThrow();
    expect(() =>
      approvedRoadmapGenerationAdapter({ ...config, approvalReference: null }, valid),
    ).toThrow();
    const approved = approvedRoadmapGenerationAdapter(
      { ...config, apiKey: "SECRET_CANARY" } as typeof config,
      valid,
    );
    expect(roadmapModelManifest(approved, null)).not.toContain("SECRET_CANARY");
  });
  it("fails closed if evidence cannot persist", async () =>
    expect(
      (
        await propose(
          adapter(port(valid), null, {
            record: async () => {
              throw Error();
            },
          }),
        )
      ).success,
    ).toBe(false));
  it("pins gateway routing in the evaluated bundle, without credentials", () => {
    const original = port(valid);
    expect(
      roadmapModelManifest({ ...original, transportReference: "https-route:sha256:routeA" }, null),
    ).not.toBe(
      roadmapModelManifest({ ...original, transportReference: "https-route:sha256:routeB" }, null),
    );
  });
});
