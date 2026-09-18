import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Guided problem workspace", () => {
  test("renders the complete learner critical path without pretending to run code", async ({
    page,
  }) => {
    await page.goto("/learn/arrays-two-pointer");

    await expect(page.getByRole("heading", { name: "Container with most water" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pseudocode checkpoint" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Step through the reviewed trace" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Run checks" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Submit attempt" })).toBeDisabled();

    await page.getByRole("button", { name: "Request clarification hint" }).click();
    await expect(page.getByText(/authenticated exposure endpoint acknowledges/i)).toBeVisible();
    await expect(page.getByText(/shorter boundary limits/i)).toHaveCount(0);

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("does not overflow at the narrowest supported width", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/learn/arrays-two-pointer");

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  });

  test("recovers the active language draft after a reload", async ({ page }) => {
    await page.route("**/api/auth/session", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ authenticated: true, user: { id: "usr_guided_fixture" } }),
      });
    });
    await page.goto("/learn/arrays-two-pointer");

    const source = page.getByRole("textbox", { name: "Python source" });
    await source.fill("def max_area(heights):\n    return 49");
    await expect(page.getByText("Local recovery saved")).toBeVisible();
    await page.reload();
    await expect(source).toHaveValue("def max_area(heights):\n    return 49");
  });

  test("syncs authenticated workspace edits and reveals authored hints only after the route responds", async ({
    page,
  }) => {
    let sourcePut = false;
    await page.route("**/api/auth/session", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ authenticated: true, user: { id: "usr_guided_fixture" } }),
      });
    });
    await page.route("**/api/practice/workspace", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          attempt: { attemptId: "att_guided_fixture" },
          firstHintId: "hint-arrays-1",
          starterTemplate: "starter source",
          sourceDraft: {
            draftId: "drf_guided_fixture",
            version: 1,
            currentRevision: 1,
            currentText: "server source",
          },
          pseudocode: {
            pseudocodeId: "psc_guided_fixture",
            version: 1,
            current: {
              inputs: "",
              state: "",
              initialization: "",
              invariant: "",
              loop: "",
              termination: "",
              output: "",
              complexity: "",
            },
          },
        }),
      });
    });
    await page.route("**/api/practice/hints", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ hint: { body: "Move the shorter boundary." } }),
      });
    });
    await page.route("**/api/practice/drafts/*", async (route) => {
      sourcePut = true;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ state: "saved_current", draft: { version: 2 } }),
      });
    });
    await page.route("**/api/practice/pseudocode/*", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ state: "saved_current", artifact: { version: 2 } }),
      });
    });

    await page.goto("/learn/arrays-two-pointer");
    const source = page.getByRole("textbox", { name: "Python source" });
    await expect(source).toHaveValue("server source");
    await page.getByRole("button", { name: "Request clarification hint" }).click();
    await expect(page.getByText("Move the shorter boundary.")).toBeVisible();
    await source.fill("server source edited");
    await expect.poll(() => sourcePut).toBe(true);
  });
});
