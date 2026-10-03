import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
const profile = {
  goal: "Learn patterns",
  targetRole: "Engineer",
  timezone: "Asia/Kolkata",
  dailyCapacityMinutes: 45,
  preferredLanguages: ["python"],
};
test("planning preferences save, reload, clamp calendar months, and preserve edits after a conflict", async ({
  page,
}) => {
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      json: { authenticated: true, user: { id: "usr_browser_fixture", roles: ["learner"] } },
    }),
  );
  let intent: unknown = null,
    submitted: Record<string, unknown> | null = null,
    conflict = false;
  await page.route("**/api/planning/intent", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        json: {
          intent,
          profile,
          collections: [{ collectionId: "col_aaaaaaaaaaaaaaaa", title: "Pattern practice" }],
          asOf: "2026-10-02T10:00:00Z",
        },
      });
      return;
    }
    submitted = route.request().postDataJSON() as Record<string, unknown>;
    if (conflict) {
      await route.fulfill({
        status: 409,
        json: {
          error: {
            message: "Planning preferences changed in another tab. Refresh before editing.",
          },
        },
      });
      return;
    }
    const preferences = submitted.preferences as Record<string, unknown>;
    intent = {
      planId: "pln_aaaaaaaaaaaaaaaa",
      learnerId: "usr_aaaaaaaaaaaaaaaa",
      version: 1,
      preferences: { ...preferences, endDay: "2027-02-28" },
      savedAt: "2026-10-02T10:00:00Z",
    };
    await route.fulfill({ json: { intent, disposition: "committed" } });
  });
  await page.goto("/plan");
  await expect(page.getByLabel("Goal", { exact: true })).toHaveValue("Learn patterns");
  await page.getByLabel("Start day", { exact: true }).fill("2026-10-31");
  await page.getByLabel("Calendar horizon").selectOption("4");
  await expect(page.getByText("2027-02-28", { exact: true })).toBeVisible();
  await page.getByLabel("Pattern practice", { exact: true }).check();
  await page.getByRole("button", { name: "Save planning preferences" }).click();
  await expect(page.getByRole("status").first()).toHaveText(
    "Planning preferences revision 1 saved. Review a schedule preview before accepting changes.",
  );
  expect(submitted).toMatchObject({
    planId: null,
    expectedVersion: null,
    preferences: { horizonMonths: 4, collectionIds: ["col_aaaaaaaaaaaaaaaa"] },
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.reload();
  await expect(page.getByLabel("Calendar horizon")).toHaveValue("4");
  await expect(page.getByLabel("Pattern practice")).toBeChecked();
  conflict = true;
  await page.getByLabel("Goal", { exact: true }).fill("My unsaved update");
  await page.getByRole("button", { name: "Save planning preferences" }).click();
  await expect(page.getByRole("status").first()).toHaveText(
    "Planning preferences changed in another tab. Refresh before editing.",
  );
  await expect(page.getByLabel("Goal", { exact: true })).toHaveValue("My unsaved update");
  expect(submitted).toMatchObject({ planId: "pln_aaaaaaaaaaaaaaaa", expectedVersion: 1 });
  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
test("signed-out planning preferences provide accessible recovery without a fake schedule", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/plan");
  await expect(page.getByRole("status").first()).toHaveText(
    "Sign in to save private planning preferences.",
  );
  await expect(page.getByRole("button", { name: "Save planning preferences" })).toHaveCount(0);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
