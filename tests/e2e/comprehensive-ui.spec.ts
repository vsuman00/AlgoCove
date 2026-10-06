import { expect, test } from "@playwright/test";

test.describe("AlgoCove Full UI Comprehensive Browser Test Suite", () => {
  test.describe("1. Learner Home & 3D Interactive Preview Hero (/)", () => {
    test.beforeEach(async ({ page }) => {
      await page.route("**/api/auth/session", (route) =>
        route.fulfill({ status: 401, json: { authenticated: false } }),
      );
      await page.route("**/api/onboarding", (route) =>
        route.fulfill({ status: 401, json: { profile: null } }),
      );
      await page.goto("/");
    });

    test("renders 3D preview hero stage with correct badges and structure", async ({ page }) => {
      const heroCard = page.locator(".ac-preview-hero-card");
      await expect(heroCard).toBeVisible();

      await expect(heroCard.getByText("Two Pointers", { exact: true })).toBeVisible();
      await expect(heroCard.getByText("Interactive 3D Preview")).toBeVisible();
      await expect(
        heroCard.getByRole("heading", { name: "Converging on a sorted array" }),
      ).toBeVisible();
      await expect(
        heroCard.getByText("Experience spatial invariant reasoning in action"),
      ).toBeVisible();

      // Check all 6 array cubes in 3D scene: [1, 3, 4, 6, 8, 11]
      const cubeColumns = heroCard.locator(".ac-preview-cube-column");
      await expect(cubeColumns).toHaveCount(6);
      await expect(cubeColumns.nth(0)).toContainText("1");
      await expect(cubeColumns.nth(1)).toContainText("3");
      await expect(cubeColumns.nth(2)).toContainText("4");
      await expect(cubeColumns.nth(3)).toContainText("6");
      await expect(cubeColumns.nth(4)).toContainText("8");
      await expect(cubeColumns.nth(5)).toContainText("11");
    });

    test("steps through 2-pointer convergence algorithm with live calculation updates", async ({
      page,
    }) => {
      const heroCard = page.locator(".ac-preview-hero-card");
      const calcPill = heroCard.locator(".ac-trace-calc-pill");
      const stepBadge = heroCard.locator(".ac-preview-step-badge");
      const prevBtn = heroCard.getByRole("button", { name: "Previous step" });
      const nextBtn = heroCard.getByRole("button", { name: "Next step" });

      // Step 1: L=0 (1), R=5 (11) -> Sum = 12 > Target 10
      await expect(stepBadge).toHaveText("Step 1 of 5");
      await expect(calcPill).toContainText("Current sum: 1 + 11 = 12");
      await expect(calcPill.locator(".ac-trace-target-badge")).toHaveText("> Target 10");
      await expect(prevBtn).toBeDisabled();
      await expect(nextBtn).toBeEnabled();

      // Verify discrete pointer badges: L on index 0, R on index 5
      await expect(
        heroCard.locator('.ac-preview-cube-column[data-pointer-left="true"]'),
      ).toContainText("1");
      await expect(
        heroCard.locator('.ac-preview-cube-column[data-pointer-right="true"]'),
      ).toContainText("11");

      // Advance to Step 2: L=0 (1), R=4 (8) -> Sum = 9 < Target 10
      await nextBtn.click();
      await expect(stepBadge).toHaveText("Step 2 of 5");
      await expect(calcPill).toContainText("Current sum: 1 + 8 = 9");
      await expect(calcPill.locator(".ac-trace-target-badge")).toHaveText("< Target 10");
      await expect(prevBtn).toBeEnabled();
      await expect(heroCard.getByRole("button", { name: "Reset" })).toBeVisible();

      // Advance to Step 3: L=1 (3), R=4 (8) -> Sum = 11 > Target 10
      await nextBtn.click();
      await expect(stepBadge).toHaveText("Step 3 of 5");
      await expect(calcPill).toContainText("Current sum: 3 + 8 = 11");
      await expect(calcPill.locator(".ac-trace-target-badge")).toHaveText("> Target 10");

      // Advance to Step 4: L=1 (3), R=3 (6) -> Sum = 9 < Target 10
      await nextBtn.click();
      await expect(stepBadge).toHaveText("Step 4 of 5");
      await expect(calcPill).toContainText("Current sum: 3 + 6 = 9");
      await expect(calcPill.locator(".ac-trace-target-badge")).toHaveText("< Target 10");

      // Advance to Step 5: L=2 (4), R=3 (6) -> Sum = 10 == Target 10 (Found)
      await nextBtn.click();
      await expect(stepBadge).toHaveText("Step 5 of 5");
      await expect(calcPill).toContainText("Current sum: 4 + 6 = 10");
      await expect(calcPill.locator(".ac-trace-target-badge")).toHaveText("= Target 10 (Found)");
      await expect(heroCard.getByRole("button", { name: "Completed" })).toBeDisabled();

      // Step backwards
      await prevBtn.click();
      await expect(stepBadge).toHaveText("Step 4 of 5");
      await expect(nextBtn).toBeEnabled();

      // Reset to initial step
      await heroCard.getByRole("button", { name: "Reset" }).click();
      await expect(stepBadge).toHaveText("Step 1 of 5");
      await expect(prevBtn).toBeDisabled();
    });

    test("renders curriculum progression and CTA navigates to workspace", async ({ page }) => {
      const heroCard = page.locator(".ac-preview-hero-card");

      // Curriculum phases
      await expect(heroCard.getByText("Phase 1")).toBeVisible();
      await expect(heroCard.getByText("Foundations")).toBeVisible();
      await expect(heroCard.getByText("Phase 2 · Active")).toBeVisible();
      await expect(heroCard.getByText("Core Patterns")).toBeVisible();
      await expect(heroCard.getByText("Phase 3")).toBeVisible();
      await expect(heroCard.getByText("Trees & Graphs")).toBeVisible();
      await expect(heroCard.getByText("Phase 4")).toBeVisible();
      await expect(heroCard.getByText("Transfer & Interview")).toBeVisible();

      // CTA button
      const cta = heroCard.getByRole("link", { name: "Explore full problem workspace" });
      await expect(cta).toBeVisible();
      await cta.click();
      await expect(page).toHaveURL(/\/learn\/arrays-two-pointer/);
    });

    test("disables 3D transform under prefers-reduced-motion", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.reload();

      const transform = await page.locator(".ac-preview-array-scene").evaluate((el) => {
        return window.getComputedStyle(el).transform;
      });
      expect(transform).toBe("none");
    });
  });

  test.describe("2. Guided Problem Workspace (/learn/arrays-two-pointer)", () => {
    test.beforeEach(async ({ page }) => {
      await page.route("**/api/auth/session", (route) =>
        route.fulfill({
          json: { authenticated: true, user: { id: "usr_full_fixture", roles: ["learner"] } },
        }),
      );
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
      await page.route("**/api/practice/workspace", (route) =>
        route.fulfill({
          json: {
            attempt: { attemptId: "att_ui_fixture" },
            firstHintId: "hint-arrays-1",
            starterTemplate:
              "def max_area(heights):\n    left, right = 0, len(heights) - 1\n    best = 0\n    return best",
            sourceDraft: {
              draftId: "drf_ui_fixture",
              version: 1,
              currentRevision: 1,
              currentText:
                "def max_area(heights):\n    left, right = 0, len(heights) - 1\n    best = 0\n    return best",
            },
            pseudocode: {
              pseudocodeId: "psc_ui_fixture",
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
          },
        }),
      );
      await page.goto("/learn/arrays-two-pointer");
    });

    test("verifies invariant callout, guidance placeholders, and layout docking", async ({
      page,
    }) => {
      // Problem statement & invariant
      await expect(page.getByRole("heading", { name: "Container with most water" })).toBeVisible();
      const invariant = page.locator(".ac-invariant-callout");
      await expect(invariant).toBeVisible();
      await expect(invariant.locator(".ac-invariant-badge")).toHaveText("Key Invariant");
      await expect(invariant).toContainText("The width decreases at every step");

      // Guidance panel
      await expect(page.getByRole("heading", { name: "Need a nudge?" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Request clarification hint" })).toBeVisible();

      // Pseudocode fields placeholders
      await expect(page.getByRole("textbox", { name: "Inputs" })).toHaveAttribute(
        "placeholder",
        "e.g. heights array of positive integer elevations",
      );
      await expect(page.getByRole("textbox", { name: "State" })).toHaveAttribute(
        "placeholder",
        "e.g. left pointer, right pointer, best area so far",
      );
      await expect(page.getByRole("textbox", { name: "Initialization" })).toHaveAttribute(
        "placeholder",
        "e.g. left = 0, right = heights.length - 1, best = 0",
      );
      await expect(page.getByRole("textbox", { name: "Invariant" })).toHaveAttribute(
        "placeholder",
        "e.g. optimal container between [0, left-1] and [right+1, n-1] already checked",
      );
      await expect(page.getByRole("textbox", { name: "Complexity" })).toHaveAttribute(
        "placeholder",
        "e.g. O(n) time, O(1) auxiliary space",
      );
    });

    test("exercises 3D trace camera presets, flat view toggle, and live calculation pill", async ({
      page,
    }) => {
      const trace = page.locator(".ac-trace");
      await expect(trace).toBeVisible();

      const stage = page.locator(".ac-trace-stage");
      await expect(stage).toHaveClass(/is-spatial/);

      // Verify live calculation pill exists
      const calc = page.locator(".ac-trace-calculation");
      await expect(calc).toBeVisible();
      await expect(calc).toContainText("Width =");
      await expect(calc).toContainText("Height =");
      await expect(calc).toContainText("Current Area =");

      // Verify Camera Presets
      const values = page.locator(".ac-trace-values");
      await expect(values).toHaveCSS("--trace-angle", "-18deg");
      await expect(values).toHaveCSS("--trace-tilt", "24deg");

      // Click "Top-Down"
      await page.getByRole("button", { name: "Top-Down" }).click();
      await expect(values).toHaveCSS("--trace-angle", "0deg");
      await expect(values).toHaveCSS("--trace-tilt", "45deg");

      // Click "Front View"
      await page.getByRole("button", { name: "Front View" }).click();
      await expect(values).toHaveCSS("--trace-angle", "0deg");
      await expect(values).toHaveCSS("--trace-tilt", "0deg");

      // Click "Isometric 3D"
      await page.getByRole("button", { name: "Isometric 3D" }).click();
      await expect(values).toHaveCSS("--trace-angle", "-18deg");
      await expect(values).toHaveCSS("--trace-tilt", "24deg");

      // Flat view toggle
      await page.getByRole("button", { name: "Use flat view" }).click();
      await expect(stage).not.toHaveClass(/is-spatial/);
      await expect(page.getByRole("button", { name: "Use 3D view" })).toBeVisible();

      // Return to 3D view
      await page.getByRole("button", { name: "Use 3D view" }).click();
      await expect(stage).toHaveClass(/is-spatial/);
    });

    test("code editor handles Tab/Shift+Tab 4-space indent and updates statusbar", async ({
      page,
    }) => {
      const editor = page.getByRole("textbox", { name: "Python source" });
      const statusbar = page.locator(".ac-editor-statusbar");

      await expect(statusbar).toBeVisible();
      await expect(statusbar).toContainText("4 lines");
      await expect(statusbar).toContainText("Tab indent · ⌘↵ run checks");

      // Focus editor and test Tab insertion at position 0
      await editor.focus();
      await editor.evaluate((el: HTMLTextAreaElement) => {
        el.setSelectionRange(0, 0);
      });
      await page.keyboard.press("Tab");

      const textWithIndent = await editor.inputValue();
      expect(textWithIndent.startsWith("    def max_area")).toBe(true);

      // Test Shift+Tab unindentation on line 1
      await editor.evaluate((el: HTMLTextAreaElement) => {
        el.setSelectionRange(4, 4);
      });
      await page.keyboard.press("Shift+Tab");
      const textUnindented = await editor.inputValue();
      expect(textUnindented.startsWith("def max_area")).toBe(true);

      // Verify language selector switches
      const langSelect = page.getByLabel("Implementation language");
      await langSelect.selectOption("javascript");
      await expect(page.getByRole("textbox", { name: "JavaScript source" })).toBeVisible();
    });
  });

  test.describe("3. Roadmap & Planning Routes (/roadmap and /plan)", () => {
    test.beforeEach(async ({ page }) => {
      await page.route("**/api/auth/session", (route) =>
        route.fulfill({
          json: { authenticated: true, user: { id: "usr_plan_fixture", roles: ["learner"] } },
        }),
      );
      await page.route("**/api/planning/intent", (route) =>
        route.fulfill({
          json: {
            intent: null,
            profile: {
              goal: "Pass algorithmic interviews",
              targetRole: "Staff Software Engineer",
              timezone: "UTC",
              dailyCapacityMinutes: 60,
              preferredLanguages: ["python"],
            },
            collections: [],
            asOf: "2026-10-06T00:00:00Z",
          },
        }),
      );
      await page.route("**/api/planning/roadmap", (route) =>
        route.fulfill({
          json: { state: null, candidates: [], history: [], journal: [] },
        }),
      );
    });

    test("navigates to /roadmap and verifies active planning shell", async ({ page }) => {
      await page.goto("/roadmap");
      await expect(page.getByRole("heading", { name: "Planning preferences" })).toBeVisible();

      const planningNav = page.getByRole("link", { name: "Planning", exact: true });
      await expect(planningNav).toHaveAttribute("aria-current", "page");
    });

    test("navigates to /plan and renders planning preferences form", async ({ page }) => {
      await page.goto("/plan");
      await expect(page.getByLabel("Study minutes per available day")).toHaveValue("60");
      await expect(page.getByRole("button", { name: "Save planning preferences" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Build schedule preview" })).toBeVisible();
    });
  });

  test.describe("4. Learner Onboarding (/onboarding)", () => {
    test("submits profile with accessibility preferences", async ({ page }) => {
      let saved = false;
      await page.route("**/api/auth/session", (route) =>
        route.fulfill({
          json: { authenticated: true, user: { id: "usr_onboard_fixture", roles: ["learner"] } },
        }),
      );
      await page.route("**/api/onboarding", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ json: { profile: null } });
        } else if (route.request().method() === "PUT") {
          saved = true;
          await route.fulfill({
            json: { profile: { version: 1 } },
          });
        }
      });

      await page.goto("/onboarding");
      await expect(
        page.getByRole("heading", { name: "Shape the learning loop around your week." }),
      ).toBeVisible();

      await page.getByLabel("Learning goal").fill("Master two pointer and dynamic programming");
      await page.getByLabel("Target role").fill("Senior Backend Engineer");
      await page.getByLabel("Daily minutes").fill("60");

      // Check Reduce motion accessibility checkbox
      const motionCheckbox = page.getByLabel("Reduce motion");
      await motionCheckbox.check();
      expect(await motionCheckbox.isChecked()).toBe(true);

      // Submit
      await page.getByRole("button", { name: "Save profile" }).click();
      await expect(
        page.getByText("Profile saved. Your learning plan can now use it."),
      ).toBeVisible();
      expect(saved).toBe(true);
    });
  });

  for (const failure of ["validation", "network"] as const) {
    test(`onboarding recovers from ${failure} failure and retries with corrected data`, async ({
      page,
    }) => {
      let saves = 0;
      const requests: Record<string, unknown>[] = [];
      await page.route("**/api/auth/session", (route) =>
        route.fulfill({
          json: { authenticated: true, user: { id: "usr_onboard_fixture", roles: ["learner"] } },
        }),
      );
      await page.route("**/api/onboarding", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ json: { profile: null } });
          return;
        }
        requests.push(route.request().postDataJSON());
        saves += 1;
        if (saves === 1) {
          if (failure === "network") await route.abort("connectionfailed");
          else
            await route.fulfill({
              status: 400,
              json: {
                error: {
                  code: "invalid_request",
                  message: "Choose at least one supported language.",
                },
              },
            });
          return;
        }
        await route.fulfill({ json: { profile: { version: 1 } } });
      });
      await page.goto("/onboarding");
      await expect(page.getByRole("status")).toContainText("Start with a few details");
      await page.getByLabel("Learning goal").fill("Learn arrays");
      await page.getByLabel("Target role").fill("Engineer");
      await page.getByLabel(/^Preferred languages/).fill(failure === "validation" ? "," : "python");
      await page.getByRole("button", { name: "Save profile" }).click();
      await expect(page.getByRole("status")).toContainText(
        failure === "validation"
          ? "Choose at least one supported language."
          : "We could not reach the profile service. Try again.",
      );
      await expect(page.getByRole("button", { name: "Save profile" })).toBeEnabled();
      await page.getByLabel(/^Preferred languages/).fill("python");
      await page.getByRole("button", { name: "Save profile" }).click();
      await expect(page.getByRole("status")).toContainText("Profile saved.");
      expect(saves).toBe(2);
      expect(requests[1]).toMatchObject({ preferredLanguages: ["python"] });
    });
  }

  test("tutor question and actions have usable spacing at mobile width", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/learn/arrays-two-pointer");
    const panel = page.locator(".ac-tutor-panel");
    await expect(panel.getByLabel("Question", { exact: true })).toBeVisible();
    const boxes = await panel.locator("button").evaluateAll((buttons) =>
      buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height,
        };
      }),
    );
    expect(boxes).toHaveLength(3);
    for (const box of boxes) expect(box.height).toBeGreaterThanOrEqual(44);
    for (let i = 1; i < boxes.length; i++) {
      const a = boxes[i - 1]!;
      const b = boxes[i]!;
      expect(b.top >= a.bottom + 7 || b.left >= a.right + 7).toBe(true);
    }
  });

  test.describe("5. Mobile Viewport (320px) Reflow Across Core Pages", () => {
    const paths = [
      "/",
      "/learn/arrays-two-pointer",
      "/roadmap",
      "/plan",
      "/onboarding",
      "/review",
      "/progress",
      "/execution-readiness",
      "/admin/content",
      "/admin/readiness",
      "/sign-in",
      "/sign-up",
    ];

    for (const path of paths) {
      test(`no horizontal document scroll overflow at 320px on ${path}`, async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 800 });
        await page.route("**/api/auth/session", (route) =>
          route.fulfill({ status: 401, json: { authenticated: false } }),
        );
        await page.goto(path);

        const dimensions = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));

        expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
      });
    }
  });
});
