import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Learner onboarding", () => {
  test("renders an accessible signed-out entry point", async ({ page }) => {
    await page.goto("/onboarding");

    await expect(page.getByRole("heading", { name: "Shape the learning loop around your week." })).toBeVisible();
    await expect(page.getByRole("status")).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("does not overflow at the narrowest supported shell width", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/onboarding");

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  });
});
