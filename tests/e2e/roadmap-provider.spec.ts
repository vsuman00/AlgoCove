import { test, expect } from "@playwright/test";
import {
  buildBaselinePlan,
  parseRoadmapPreferences,
  parseInstant,
  type PlanningCatalog,
} from "../../packages/domain/src/index.ts";
import {
  createRoadmapProposalAdapter,
  type RoadmapGenerationRequest,
} from "../../packages/tutor/src/plan-proposal-adapter.ts";
import { proposeValidatedPlan } from "../../packages/application/src/roadmap-use-cases.ts";
/** Browser uses the real proposal gateway/policy with a synthetic provider and
 * controlled HTTP identity/persistence seam. SQL ownership/atomicity is separate. */
for (const mode of ["primary", "fallback", "outage"] as const) {
  test(`optional ${mode} preview preserves active plan until explicit learner acceptance`, async ({
    page,
  }) => {
    const instant = parseInstant("2026-10-06T00:00:00Z");
    if (!instant.ok) throw Error();
    const preferences = parseRoadmapPreferences(
      {
        goal: "PRIVATE_GOAL_CANARY",
        targetRole: "Engineer",
        horizonMonths: 1,
        startDay: "2026-10-06",
        timezone: "UTC",
        dailyCapacityMinutes: 90,
        studyWeekdays: [1, 2, 3, 4, 5],
        preferredLanguages: ["python"],
        collectionIds: [],
      },
      instant.value,
    );
    const catalog: PlanningCatalog = {
      curriculumVersionId: null,
      units: [
        {
          key: "one",
          kind: "internal_problem",
          targetId: "prb_dddddddddddddddd",
          title: "Original fixture",
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
    const baseline = buildBaselinePlan({
      preferences,
      catalog,
      scope: "reviewed_pilot",
      today: preferences.startDay,
    });
    if (!baseline.ok) throw Error();
    const configuration = {
      version: "roadmap.browser.fixture.v1",
      provider: "fixture",
      model: "original.schedule.v1",
      kind: "fixture" as const,
      approvalReference: null,
      region: "local",
      dataPolicy: "synthetic-only",
      allowPrivateCode: false,
    };
    const captured: string[] = [];
    const valid = async (r: RoadmapGenerationRequest) => {
      captured.push(JSON.stringify(r));
      return { items: r.items.map((i) => ({ index: i.index, day: i.day })) };
    };
    const provider = createRoadmapProposalAdapter({
      bundleVersion: "browser.fixture.v1",
      primary: {
        configuration,
        generate:
          mode === "primary"
            ? valid
            : async () => {
                throw Error("RAW_PROVIDER_CANARY");
              },
      },
      fallback: {
        configuration,
        generate:
          mode === "outage"
            ? async () => {
                throw Error("RAW_PROVIDER_CANARY");
              }
            : valid,
      },
      authorize: async () => true,
      validate: () => true,
      record: async () => {},
    });
    let candidate: unknown = null,
      builds = 0,
      accepted = 0;
    const state = {
      versionId: "evt_aaaaaaaaaaaaaaaa",
      token: "evt_bbbbbbbbbbbbbbbb",
      status: "active",
      schedule: baseline.schedule,
    };
    const view = { state, candidates: [], history: [], journal: [] };
    await page.route("**/api/auth/session", (route) =>
      route.fulfill({
        json: { authenticated: true, user: { id: "usr_browser_fixture", roles: ["learner"] } },
      }),
    );
    await page.route("**/api/planning/intent", (route) =>
      route.fulfill({
        json: {
          intent: {
            planId: "pln_aaaaaaaaaaaaaaaa",
            learnerId: "usr_browser_fixture",
            version: 1,
            preferences,
            savedAt: instant.value,
          },
          profile: null,
          collections: [],
          asOf: instant.value,
        },
      }),
    );
    await page.route("**/api/planning/catalog", (route) => route.fulfill({ json: catalog }));
    await page.route("**/api/planning/roadmap", async (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: view });
      const input = route.request().postDataJSON();
      if (input.action === "build") {
        builds++;
        expect(input.useProposal).toBe(true);
        expect(input.expectedToken).toBe(state.token);
        const proposal = await proposeValidatedPlan({
          baseline: baseline.schedule,
          catalog,
          fixed: [],
          today: preferences.startDay,
          provider,
        });
        candidate = {
          candidateId: "evt_cccccccccccccccc",
          status: "valid",
          intentVersion: 1,
          expectedToken: state.token,
          schedule: proposal.schedule,
          failures: [],
          preview: { moved: [], removed: [], added: [], retained: [], blocked: [] },
          lineage: proposal.lineage,
          createdAt: instant.value,
          expiresAt: "2026-10-07T00:00:00Z",
        };
        return route.fulfill({ json: candidate });
      }
      expect(input.action).toBe("accept");
      expect(input.candidateId).toBe("evt_cccccccccccccccc");
      accepted++;
      return route.fulfill({ json: view });
    });
    await page.goto("/roadmap");
    await page.getByLabel("Use optional AI sequencing").check();
    await page.getByRole("button", { name: "Preview replan" }).click();
    await expect(page.getByRole("heading", { name: "Schedule preview" })).toBeVisible();
    expect(builds).toBe(1);
    expect(accepted).toBe(0);
    expect(JSON.stringify(candidate)).not.toContain("RAW_PROVIDER_CANARY");
    expect(captured.join()).not.toContain("PRIVATE_GOAL_CANARY");
    await expect(page.getByRole("heading", { name: /Accepted schedule —/ })).toBeVisible();
    await page
      .getByRole("button", { name: /Accept.*preview|Accept.*schedule|Accept this plan/i })
      .click();
    expect(accepted).toBe(1);
  });
}
