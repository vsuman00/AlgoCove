import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Learner Home shell", () => {
  test("has no automatically detectable accessibility violations", async ({ page }) => {
    await page.goto("/");

    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);
  });

  test("supports keyboard skip navigation and labeled controls", async ({ page }) => {
    await page.goto("/");

    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();

    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
    await expect(page.getByRole("link", { name: "System status" })).toHaveAttribute(
      "href",
      "/api/health",
    );
  });

  test("shows real authentication entry points without a placeholder identity", async ({
    page,
  }) => {
    await page.goto("/");

    const signInButton = page.getByRole("button", { name: "Sign in", exact: true });
    const signInLink = page.getByRole("link", { name: "Sign in", exact: true });
    const createAccountButton = page.getByRole("button", { name: "Create account", exact: true });
    const createAccountLink = page.getByRole("link", { name: "Create account", exact: true });
    await expect(signInButton.or(signInLink)).toBeVisible();
    await expect(createAccountButton.or(createAccountLink)).toBeVisible();
    if ((await signInLink.count()) > 0) {
      await expect(signInLink).toHaveAttribute("href", "/sign-in");
      await expect(createAccountLink).toHaveAttribute("href", "/sign-up");
    }
    await expect(page.getByText("VS", { exact: true })).toHaveCount(0);
  });

  test("reflows at the narrowest supported shell width", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/");

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));

    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  });

  test("honors reduced-motion preferences", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior))
      .toBe("auto");
  });
});
