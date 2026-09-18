import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Execution readiness", () => {
  test("shows all code-backed language profiles without presenting a learner runner", async ({
    page,
  }) => {
    await page.goto("/execution-readiness");

    await expect(
      page.getByRole("heading", { name: "Six languages, one explicit execution contract." }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Python" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "JavaScript" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "TypeScript" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Java", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "C++" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "C", exact: true })).toBeVisible();
    await expect(page.getByText("Security-owner approval is still required")).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(0);

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("has no horizontal overflow at the narrowest supported width", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/execution-readiness");

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  });
});
