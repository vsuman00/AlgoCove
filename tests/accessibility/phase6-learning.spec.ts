import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
const instant = "2026-10-02T10:00:00.000Z";
const reviewItem = {
  reviewId: "evt_aaaaaaaaaaaaaaaa",
  learnerId: "usr_aaaaaaaaaaaaaaaa",
  conceptId: "cpt_aaaaaaaaaaaaaaaa",
  originObservationId: "evt_bbbbbbbbbbbbbbbb",
  originProblemVersionId: "prb_dddddddddddddddd",
  evidenceWatermark: "fixture",
  policyVersion: 1,
  dueStart: "2026-09-25T10:00:00Z",
  dueEnd: "2026-09-26T10:00:00Z",
  status: "due",
  completedObservationId: null,
  timing: "overdue",
  timezone: "America/New_York",
  exercise: {
    exerciseId: "boundary-transfer-v1",
    title: "Transfer the boundary strategy",
    kind: "transfer",
    rubricVersion: 1,
    questions: [
      {
        id: "measure",
        prompt: "Which area is possible?",
        options: [
          { value: "15", label: "15 units" },
          { value: "40", label: "40 units" },
        ],
      },
    ],
  },
};
const report = {
  asOf: instant,
  policyVersion: 1,
  timezone: "America/New_York",
  pendingConcepts: [],
  mastery: [
    {
      title: "Two pointers",
      status: "ready",
      projection: {
        conceptId: "cpt_aaaaaaaaaaaaaaaa",
        band: "independent_completion",
        evidenceCount: 1,
        lastPracticed: instant,
        reasonCodes: ["independent_immediate_completion", "delayed_transfer_unobserved"],
        languageProficiency: { python: { observedPasses: 1, compileErrors: 0, typeErrors: 0 } },
      },
    },
  ],
  calibration: [
    { confidence: "high", correct: false, observedAt: instant, provenance: "learner_reported" },
  ],
  activities: [],
  pauses: [],
  completedSessions: 0,
  externalPractice: {
    provenance: "learner_reported",
    requested: 1,
    completed: 1,
    references: [
      {
        referenceId: "ref_aaaaaaaaaaaaaaaa",
        title: "Reviewed practice",
        url: "https://neetcode.io/practice",
      },
    ],
  },
  planAdherence: { status: "no_accepted_plan", completedOnTime: null, totalDue: null },
  reviewHealth: { due: 0, overdue: 1, deferred: 0, completed: 0, pending: 0 },
  consistency: {
    policyVersion: 1,
    asOf: instant,
    timezone: "America/New_York",
    activeDays: 0,
    currentStreak: 0,
    longestStreak: 0,
    graceDays: 0,
  },
};
test("overdue review supports keyboard answers, receipt and deferral with accessible states", async ({
  page,
}) => {
  let submitted: unknown;
  await page.route("**/api/review", async (route) => {
    if (route.request().method() === "POST") {
      submitted = route.request().postDataJSON();
      await route.fulfill({ json: { status: "ready", correct: true } });
    } else
      await route.fulfill({ json: { reviews: [reviewItem], asOf: instant, policyVersion: 1 } });
  });
  await page.goto("/review");
  await expect(page.getByText("Overdue · catch up when ready")).toBeVisible();
  await page.getByLabel("15 units").check();
  await page.getByLabel("Confidence (optional, self-reported)").selectOption("medium");
  await page.getByRole("button", { name: "Record review", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Structured checks passed. Review recorded.");
  expect(submitted).toMatchObject({
    action: "answer",
    answers: { measure: "15" },
    confidence: "medium",
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Defer for 24 hours" }).click();
  expect(submitted).toMatchObject({ action: "defer" });
});
test("progress keeps self-reports separate and records a timezone-fenced prospective pause", async ({
  page,
}) => {
  let submitted: unknown;
  await page.route("**/api/progress", (route) => route.fulfill({ json: report }));
  await page.route("**/api/progress/pause", async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ json: { status: "paused" } });
  });
  await page.goto("/progress");
  for (const heading of [
    "Internal mastery",
    "Review health",
    "Study consistency",
    "Confidence calibration",
    "External practice journal",
    "Plan adherence",
  ])
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  await expect(page.getByText(/No accepted plan/)).toBeVisible();
  await expect(page.getByText(/Self-reported: 1 completed references/)).toBeVisible();
  await page.getByLabel("First day").fill("2026-10-03");
  await page.getByLabel("Last day").fill("2026-10-04");
  await page.getByRole("button", { name: "Save pause" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved to your learning history.");
  expect(submitted).toEqual({
    startDay: "2026-10-03",
    endDay: "2026-10-04",
    timezone: "America/New_York",
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("home shows one reasoned action with alternatives and honors recommended language", async ({
  page,
}) => {
  await page.route("**/api/learner-home", (route) =>
    route.fulfill({
      json: {
        action: {
          kind: "intro",
          href: "/learn/arrays-two-pointer?language=c",
          title: "Start two pointers",
          reasonCodes: ["cold_start_intro"],
          reasons: ["Begin with an authored introduction."],
        },
        alternatives: [{ kind: "review", title: "Recover review", href: "/review" }],
        asOf: instant,
        policyVersion: 1,
      },
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Start two pointers" })).toBeVisible();
  await page.getByRole("link", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Implementation language" })).toHaveValue("c");
});
for (const path of ["/review", "/progress"])
  test(`${path} has accessible signed-out recovery at 320px`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(path);
    await expect(page.getByRole("status")).toHaveText(
      "Sign in to view your private learning record.",
    );
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });

test("home explains overdue and unavailable scenarios", async ({ page }) => {
  for (const action of [
    {
      kind: "review",
      href: "/review",
      title: "Recover your due review",
      reasonCodes: ["due_review_first"],
      reasons: ["A due or overdue review is ready. Catch up without resetting your progress."],
    },
    {
      kind: "unavailable",
      href: "/onboarding",
      title: "No eligible exercise is available",
      reasonCodes: ["content_or_language_unavailable"],
      reasons: [
        "Current content, language availability or prerequisites prevent a supported practice recommendation.",
      ],
    },
  ]) {
    await page.route("**/api/learner-home", (route) =>
      route.fulfill({ json: { action, alternatives: [], asOf: instant, policyVersion: 1 } }),
    );
    await page.goto("/");
    await expect(page.getByRole("heading", { name: action.title, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue", exact: true })).toHaveAttribute(
      "href",
      action.href,
    );
    await expect(page.getByText(action.reasons[0]!, { exact: true })).toBeVisible();
    await page.unroute("**/api/learner-home");
  }
});

test("saved explanation checks carry self-reported confidence and preserve saved state if the check fails", async ({
  page,
}) => {
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({ json: { authenticated: true, user: { id: "usr_phase6_fixture" } } }),
  );
  const fields = {
    inputs: "",
    state: "",
    initialization: "",
    invariant: "",
    loop: "",
    termination: "",
    output: "",
    complexity: "",
    structuredAnswers: { area: "minimum_times_width", boundary: "shorter" },
  };
  await page.route("**/api/practice/workspace", (route) =>
    route.fulfill({
      json: {
        attempt: { attemptId: "att_aaaaaaaaaaaaaaaa" },
        firstHintId: "hint-arrays-1",
        starterTemplate: "starter",
        sourceDraft: {
          draftId: "drf_aaaaaaaaaaaaaaaa",
          version: 1,
          currentRevision: 1,
          currentText: "server source",
        },
        pseudocode: { pseudocodeId: "psc_aaaaaaaaaaaaaaaa", version: 1, current: fields },
      },
    }),
  );
  let version = 1,
    revision = 0,
    submitted: unknown,
    fail = false;
  await page.route("**/api/practice/pseudocode/*", (route) => {
    const input = route.request().postDataJSON();
    version++;
    if (input.saveRevision) revision++;
    return route.fulfill({ json: { artifact: { version, savedRevision: revision } } });
  });
  await page.route("**/api/mastery/explanation", (route) => {
    submitted = route.request().postDataJSON();
    return fail
      ? route.abort("failed")
      : route.fulfill({ json: { correct: true, status: "projection_pending" } });
  });
  await page.goto("/learn/arrays-two-pointer");
  await expect(page.getByRole("textbox", { name: "Python source" })).toHaveValue("server source");
  await page
    .getByLabel("Confidence before checking (optional, self-reported)")
    .selectOption("high");
  await page.getByRole("button", { name: "Save and check reasoning revision" }).click();
  await expect(
    page.getByText(/Reviewed structured checks passed.*Progress update pending/),
  ).toBeVisible();
  expect(submitted).toEqual({
    pseudocodeId: "psc_aaaaaaaaaaaaaaaa",
    revision: 1,
    confidence: "high",
  });
  fail = true;
  await page.getByRole("button", { name: "Save and check reasoning revision" }).click();
  await expect(
    page.getByText(
      "Revision 2 saved. Structured check unavailable; save another revision to retry.",
    ),
  ).toBeVisible();
});
