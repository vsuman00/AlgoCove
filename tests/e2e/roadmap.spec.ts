import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  addCalendarMonths,
  buildBaselinePlan,
  parseRoadmapPreferences,
  parseInstant,
  type PlanningCatalog,
} from "../../packages/domain/src/index.ts";
import type {
  RoadmapView,
  PlanCandidate,
} from "../../packages/application/src/roadmap-use-cases.ts";
/** Browser API fixtures exercise UI commands; PostgreSQL ownership/atomicity is verified by roadmap.test.ts. */
test("complete AI-off create, review, accept, miss, pause, resume, replan and history journey", async ({
  page,
}) => {
  const now = parseInstant("2026-10-03T10:00:00Z");
  if (!now.ok) throw Error("fixture");
  let preferences = parseRoadmapPreferences(
      {
        goal: "Reviewed pilot",
        targetRole: "Engineer",
        horizonMonths: 1,
        startDay: "2026-10-05",
        timezone: "UTC",
        dailyCapacityMinutes: 90,
        studyWeekdays: [1, 2, 3, 4, 5],
        preferredLanguages: ["python"],
        collectionIds: [],
      },
      now.value,
    ),
    intent: unknown = null,
    view: RoadmapView = { state: null, candidates: [], history: [], journal: [] },
    serial = 1000;
  const token = () => `evt_${String(serial++).padStart(16, "0")}`;
  const catalog: PlanningCatalog = {
    curriculumVersionId: null,
    masteredKeys: [],
    coverage: "Reviewed two-pointer pilot only.",
    fullCoverage: false,
    collections: [],
    units: [
      {
        key: "lesson:cnt_aaaaaaaaaaaaaaaa",
        kind: "lesson",
        targetId: "cnt_aaaaaaaaaaaaaaaa",
        title: "Pilot introduction",
        href: "/learn/arrays-two-pointer",
        minutes: 20,
        required: true,
        prerequisites: [],
        languages: [],
        available: true,
        rightsValid: true,
        linkHealthy: true,
        reasonCodes: ["reviewed_introduction"],
      },
      {
        key: "problem:prb_dddddddddddddddd",
        kind: "internal_problem",
        targetId: "prb_dddddddddddddddd",
        title: "Pilot exercise",
        href: "/learn/arrays-two-pointer",
        minutes: 50,
        required: true,
        prerequisites: ["lesson:cnt_aaaaaaaaaaaaaaaa"],
        languages: ["python"],
        available: true,
        rightsValid: true,
        linkHealthy: true,
        reasonCodes: ["reviewed_core"],
      },
    ],
  };
  await page.route("**/api/planning/intent", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      preferences = {
        ...body.preferences,
        endDay: addCalendarMonths(body.preferences.startDay, body.preferences.horizonMonths),
      };
      intent = {
        planId: "pln_aaaaaaaaaaaaaaaa",
        learnerId: "usr_eeeeeeeeeeeeeeee",
        version: 1,
        preferences,
        savedAt: now.value,
      };
      await route.fulfill({ json: { intent, disposition: "committed" } });
    } else
      await route.fulfill({
        json: {
          intent,
          profile: {
            goal: "Reviewed pilot",
            targetRole: "Engineer",
            timezone: "UTC",
            dailyCapacityMinutes: 90,
            preferredLanguages: ["python"],
          },
          collections: [],
          asOf: now.value,
        },
      });
  });
  const commands: Record<string, unknown>[] = [];
  await page.route("**/api/planning/roadmap", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: view });
      return;
    }
    const body = route.request().postDataJSON();
    commands.push(body);
    expect(body.expectedToken).toBe(view.state?.token ?? null);
    if (body.action === "build") {
      const result = buildBaselinePlan({
        preferences,
        catalog,
        scope: body.scope,
        today: preferences.startDay,
        fixed:
          view.state?.schedule.items
            .filter((i) => i.kind === "lesson")
            .map((i) => ({ ...i, frozen: true })) ?? [],
      });
      const candidate: PlanCandidate = {
        candidateId: token(),
        status: result.ok ? "valid" : "invalid",
        intentVersion: 1,
        expectedToken: view.state?.token ?? null,
        schedule: result.ok ? result.schedule : null,
        failures: result.ok ? [] : result.failures,
        preview: { moved: [], removed: [], added: ["one"], retained: [], blocked: [] },
        lineage: "baseline_ai_off",
        createdAt: now.value,
        expiresAt: "2026-10-04T10:00:00Z" as PlanCandidate["expiresAt"],
      };
      view.candidates = [candidate];
      await route.fulfill({ json: candidate });
      return;
    }
    if (body.action === "accept") {
      const candidate = view.candidates[0]!;
      expect(body.candidateId).toBe(candidate.candidateId);
      view = {
        ...view,
        state: {
          versionId: candidate.candidateId,
          token: token(),
          status: "active",
          schedule: candidate.schedule!,
        },
        candidates: [],
        history: [
          ...view.history,
          {
            versionId: candidate.candidateId,
            schedule: candidate.schedule!,
            acceptedAt: now.value,
          },
        ],
      };
    } else if (body.action === "pause" || body.action === "resume")
      view = {
        ...view,
        state: {
          ...view.state!,
          token: token(),
          status: body.action === "pause" ? "paused" : "active",
        },
      };
    else if (body.action === "missed" || body.action === "done")
      view = {
        ...view,
        state: { ...view.state!, token: token() },
        journal: [
          ...view.journal,
          {
            eventId: token(),
            versionId: view.state!.versionId,
            kind: body.action,
            occurrenceId: body.occurrenceId,
            reversesId: null,
            localDay: "2026-10-05",
            timezone: "UTC",
            occurredAt: now.value,
          },
        ],
      };
    await route.fulfill({ json: view });
  });
  await page.goto("/plan");
  await page.getByLabel("Study minutes per available day").fill("90");
  await page.getByLabel("Start day", { exact: true }).fill("2026-10-05");
  await page.getByRole("button", { name: "Save planning preferences" }).click();
  await page.getByRole("button", { name: "Build schedule preview" }).click();
  await expect(page.getByRole("heading", { name: "Schedule preview" })).toBeVisible();
  await expect(
    page.getByText("Your schedule follows your capacity and prerequisites.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Workload:", { exact: false })).toContainText("70 minutes");
  await page.getByRole("button", { name: "Accept this schedule" }).click();
  await expect(page.getByRole("heading", { name: "Accepted schedule — active" })).toBeVisible();
  await page
    .getByRole("button", { name: "Check in completed: Pilot introduction", exact: true })
    .click();
  await page.getByRole("button", { name: "Record missed: Pilot exercise", exact: true }).click();
  await page.getByRole("button", { name: "Pause plan", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Accepted schedule — paused" })).toBeVisible();
  await page.getByRole("button", { name: "Resume plan", exact: true }).click();
  await expect(page.getByText("Deadline 2026-11-05.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Preview replan", exact: true }).click();
  await expect(page.getByText("Changes:", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Accept this schedule" }).click();
  await expect(page.getByText("Accepted version history (2)", { exact: true })).toBeVisible();
  expect(commands.map((c) => c.action)).toEqual([
    "build",
    "accept",
    "done",
    "missed",
    "pause",
    "resume",
    "build",
    "accept",
  ]);
  expect(new Set(commands.map((c) => c.idempotencyKey)).size).toBe(commands.length);
  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("infeasible full-course goals show a scoped alternative without an accept action", async ({
  page,
}) => {
  await page.route("**/api/planning/intent", (route) =>
    route.fulfill({
      json: { intent: null, profile: null, collections: [], asOf: "2026-10-03T10:00:00Z" },
    }),
  );
  await page.route("**/api/planning/roadmap", (route) =>
    route.fulfill({
      json:
        route.request().method() === "GET"
          ? { state: null, candidates: [], history: [], journal: [] }
          : {
              candidateId: "evt_aaaaaaaaaaaaaaaa",
              status: "invalid",
              schedule: null,
              failures: [
                {
                  code: "insufficient_coverage",
                  message: "Reviewed curriculum cannot support full DSA.",
                  alternatives: ["Choose the reviewed pilot scope."],
                },
              ],
              preview: null,
            },
    }),
  );
  await page.goto("/plan");
  await page.getByLabel("Coverage scope").selectOption("full_dsa");
  await page.getByRole("button", { name: "Build schedule preview" }).click();
  await expect(page.getByText("insufficient_coverage:", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept this schedule" })).toHaveCount(0);
});
