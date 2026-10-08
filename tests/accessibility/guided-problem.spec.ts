import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Guided problem workspace", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/practice/problems/arrays-two-pointer", (route) =>
      route.fulfill({
        json: {
          problem: {
            title: "Container with most water",
            statement:
              "Given an array of heights, return the maximum area formed by two vertical lines and the x-axis.",
          },
        },
      }),
    );
  });
  test("withdrawn public content is hidden and unknown problem paths return a real accessible 404", async ({
    page,
  }) => {
    await page.unroute("**/api/practice/problems/arrays-two-pointer");
    await page.route("**/api/practice/problems/arrays-two-pointer", (route) =>
      route.fulfill({ status: 404, json: { error: { code: "not_found" } } }),
    );
    await page.goto("/learn/arrays-two-pointer");
    await expect(
      page.getByRole("heading", { name: "This problem is no longer available." }),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Python source" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Container with most water" })).toHaveCount(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    const response = await page.goto("/learn/unknown-problem!");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "This page is not available." })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test("retries an unavailable account service without substituting a learner identity", async ({
    page,
  }) => {
    let unavailable = true;
    await page.route("**/api/auth/session", (route) =>
      route.fulfill({ status: unavailable ? 503 : 401, json: { authenticated: false } }),
    );
    await page.goto("/learn/arrays-two-pointer");
    await expect(page.getByRole("button", { name: "Retry account connection" })).toBeVisible();
    await expect(page.getByText("Account service unavailable.", { exact: false })).toBeVisible();
    unavailable = false;
    await page.getByRole("button", { name: "Retry account connection" }).click();
    await expect(page.getByText("Sign in for private recovery", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Run checks", exact: true })).toBeDisabled();
  });
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
    await expect(page.getByText(/Sign in or reconnect your account to use hints/i)).toBeVisible();
    await expect(page.getByText(/shorter boundary limits/i)).toHaveCount(0);

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("keeps the focused 3D workspace usable at doubled page scale and with keyboard controls", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/learn/arrays-two-pointer");
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveCount(0);
    const trace = page.locator(".ac-trace");
    await trace.focus();
    await page.keyboard.press("ArrowRight");
    await expect(trace.getByRole("status")).toContainText("Step 1 of 1");
    const rotation = page.getByRole("slider", { name: "Rotate" });
    await rotation.focus();
    await page.keyboard.press("ArrowRight");
    await expect(rotation).toHaveValue("-17");
    await expect(trace.getByRole("status")).toContainText("Step 1 of 1");
    await page.getByRole("button", { name: "Use flat view" }).click();
    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
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
      if (route.request().method() === "PUT") sourcePut = true;
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
