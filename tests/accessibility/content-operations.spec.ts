import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Content operations fixture", () => {
  test("renders the governed candidate and lifecycle blocker accessibly", async ({ page }) => {
    await page.goto("/admin/content");
    await expect(page.getByRole("heading", { name: "Governed authoring preview." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open workflow" })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("renders the detail workflow without narrow-screen overflow", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/admin/content");
    await page.getByRole("link", { name: "Open workflow" }).click();
    await expect(
      page.getByRole("heading", { name: "Runnable publication is blocked" }),
    ).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
