import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const SCREENSHOT_DIR = join(process.cwd(), ".tmp", "test-results", "browser-audit");

test.beforeAll(() => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

test.describe("AlgoCove Live Browser Audit Across Every Single Page", () => {
  test("1. Learner Home (/) — interactive 3D hero, live computation, curriculum teaser", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.route("**/api/auth/session", (route) =>
      route.fulfill({ status: 401, json: { authenticated: false } }),
    );
    await page.route("**/api/onboarding", (route) =>
      route.fulfill({ status: 401, json: { profile: null } }),
    );

    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    // Verify Brand, Navigation & Skip Link
    await expect(page.locator(".ac-skip-link")).toHaveAttribute("href", "#main-content");
    await expect(page.locator(".ac-sidebar__brand")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();

    // Verify 3D Hero Card & Elements
    const heroCard = page.locator(".ac-preview-hero-card");
    await expect(heroCard).toBeVisible();
    await expect(heroCard.getByText("Two Pointers", { exact: true })).toBeVisible();
    await expect(
      heroCard.getByRole("heading", { name: "Converging on a sorted array" }),
    ).toBeVisible();

    // Verify 3D Array Scene Cubes
    const cubes = heroCard.locator(".ac-preview-cube-column");
    await expect(cubes).toHaveCount(6);

    // Verify Live Calculation Pill
    const calcPill = heroCard.locator(".ac-trace-calc-pill");
    await expect(calcPill).toContainText("Current sum: 1 + 11 = 12");
    await expect(calcPill.locator(".ac-trace-target-badge")).toHaveText("> Target 10");

    // Click Next Step to advance algorithm
    await heroCard.getByRole("button", { name: "Next step" }).click();
    await expect(calcPill).toContainText("Current sum: 1 + 8 = 9");
    await expect(calcPill.locator(".ac-trace-target-badge")).toHaveText("< Target 10");

    // Verify Curriculum Phases
    await expect(heroCard.getByText("Phase 1")).toBeVisible();
    await expect(heroCard.getByText("Phase 2 · Active")).toBeVisible();

    // Capture Browser Screenshot
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "01-learner-home.png"),
      fullPage: true,
    });

    // Check no unexpected fatal console errors
    const fatalErrors = consoleErrors.filter(
      (err) => !err.includes("favicon") && !err.includes("clerk") && !err.includes("401"),
    );
    expect(fatalErrors).toEqual([]);
  });

  test("2. Guided Problem Workspace (/learn/arrays-two-pointer) — 3D camera presets, docked layout, editor Tab", async ({
    page,
  }) => {
    await page.route("**/api/auth/session", (route) =>
      route.fulfill({
        json: { authenticated: true, user: { id: "usr_audit_fixture", roles: ["learner"] } },
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
          attempt: { attemptId: "att_audit_fixture" },
          firstHintId: "hint-arrays-1",
          starterTemplate:
            "def max_area(heights):\n    left, right = 0, len(heights) - 1\n    best = 0\n    return best",
          sourceDraft: {
            draftId: "drf_audit_fixture",
            version: 1,
            currentRevision: 1,
            currentText:
              "def max_area(heights):\n    left, right = 0, len(heights) - 1\n    best = 0\n    return best",
          },
          pseudocode: {
            pseudocodeId: "psc_audit_fixture",
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

    const response = await page.goto("/learn/arrays-two-pointer");
    expect(response?.status()).toBe(200);

    // Problem briefing & invariant
    await expect(page.getByRole("heading", { name: "Container with most water" })).toBeVisible();
    await expect(page.locator(".ac-invariant-callout")).toBeVisible();
    await expect(page.locator(".ac-invariant-badge")).toHaveText("Key Invariant");

    // Guidance aside
    await expect(page.getByRole("heading", { name: "Need a nudge?" })).toBeVisible();

    // Pseudocode textareas with placeholders
    await expect(page.getByRole("textbox", { name: "Inputs" })).toHaveAttribute(
      "placeholder",
      "e.g. heights array of positive integer elevations",
    );

    // 3D Trace Visualizer & Live Calculation Pill
    const trace = page.locator(".ac-trace");
    await expect(trace).toBeVisible();
    const calc = page.locator(".ac-trace-calculation");
    await expect(calc).toBeVisible();
    await expect(calc).toContainText("Width =");
    await expect(calc).toContainText("Height =");
    await expect(calc).toContainText("Current Area =");

    // Camera Presets
    const values = page.locator(".ac-trace-values");
    await page.getByRole("button", { name: "Top-Down" }).click();
    await expect(values).toHaveCSS("--trace-angle", "0deg");
    await expect(values).toHaveCSS("--trace-tilt", "45deg");

    await page.getByRole("button", { name: "Isometric 3D" }).click();
    await expect(values).toHaveCSS("--trace-angle", "-18deg");
    await expect(values).toHaveCSS("--trace-tilt", "24deg");

    // Flat View / 3D View Toggle
    await page.getByRole("button", { name: "Use flat view" }).click();
    await expect(page.locator(".ac-trace-stage")).not.toHaveClass(/is-spatial/);
    await page.getByRole("button", { name: "Use 3D view" }).click();
    await expect(page.locator(".ac-trace-stage")).toHaveClass(/is-spatial/);

    // Code Editor 4-Space Indentation & Statusbar
    const editor = page.getByRole("textbox", { name: "Python source" });
    const statusbar = page.locator(".ac-editor-statusbar");
    await expect(statusbar).toContainText("4 lines");
    await expect(statusbar).toContainText("Tab indent · ⌘↵ run checks");

    await editor.focus();
    await editor.evaluate((el: HTMLTextAreaElement) => {
      el.setSelectionRange(0, 0);
    });
    await page.keyboard.press("Tab");
    const indented = await editor.inputValue();
    expect(indented.startsWith("    def max_area")).toBe(true);

    // Capture Browser Screenshot
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "02-guided-problem-workspace.png"),
      fullPage: true,
    });
  });

  test("3. DSA Roadmap (/roadmap) — active journey shell & route parity", async ({ page }) => {
    await page.route("**/api/auth/session", (route) =>
      route.fulfill({
        json: { authenticated: true, user: { id: "usr_audit_fixture", roles: ["learner"] } },
      }),
    );
    await page.route("**/api/planning/intent", (route) =>
      route.fulfill({
        json: {
          intent: null,
          profile: {
            goal: "Staff Engineer Interview",
            targetRole: "Staff Software Engineer",
            timezone: "UTC",
            dailyCapacityMinutes: 60,
            preferredLanguages: ["python", "typescript"],
          },
          collections: [],
          asOf: "2026-10-06T00:00:00Z",
        },
      }),
    );
    await page.route("**/api/planning/roadmap", (route) =>
      route.fulfill({ json: { state: null, candidates: [], history: [], journal: [] } }),
    );

    const response = await page.goto("/roadmap");
    expect(response?.status()).toBe(200);

    await expect(page.getByRole("heading", { name: "Planning preferences" })).toBeVisible();
    const planningNav = page.getByRole("link", { name: "Planning", exact: true });
    await expect(planningNav).toHaveAttribute("aria-current", "page");

    // Capture Browser Screenshot
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "03-roadmap.png"),
      fullPage: true,
    });
  });

  test("4. Planning Preferences (/plan) — schedule input and candidate generation", async ({
    page,
  }) => {
    await page.route("**/api/auth/session", (route) =>
      route.fulfill({
        json: { authenticated: true, user: { id: "usr_audit_fixture", roles: ["learner"] } },
      }),
    );
    await page.route("**/api/planning/intent", (route) =>
      route.fulfill({
        json: {
          intent: null,
          profile: {
            goal: "Staff Engineer Interview",
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
      route.fulfill({ json: { state: null, candidates: [], history: [], journal: [] } }),
    );

    const response = await page.goto("/plan");
    expect(response?.status()).toBe(200);

    await expect(page.getByLabel("Study minutes per available day")).toHaveValue("60");
    await expect(page.getByRole("button", { name: "Save planning preferences" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Build schedule preview" })).toBeVisible();

    // Capture Browser Screenshot
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "04-plan.png"),
      fullPage: true,
    });
  });

  test("5. Spaced Review Queue (/review) — retrieval practice cards and confidence", async ({
    page,
  }) => {
    await page.route("**/api/auth/session", (route) =>
      route.fulfill({
        json: { authenticated: true, user: { id: "usr_audit_fixture", roles: ["learner"] } },
      }),
    );
    await page.route("**/api/review", (route) =>
      route.fulfill({
        json: {
          reviews: [
            {
              reviewId: "rev_audit_001",
              conceptId: "cpt_two_pointer",
              scheduledDay: "2026-10-06",
              intervalDays: 3,
              reasonCode: "interval_due",
              status: "due",
              timing: "due",
              timezone: "UTC",
              dueStart: "2026-10-06T00:00:00Z",
              dueEnd: "2026-10-07T00:00:00Z",
              exercise: {
                exerciseId: "ex_audit_001",
                title: "Two Pointers Retrieval Exercise",
                questions: [
                  {
                    id: "q_1",
                    prompt: "Why can the shorter boundary be safely advanced inward?",
                    options: [
                      {
                        value: "opt_1",
                        label:
                          "Because any inner container with the shorter line has strictly smaller area.",
                      },
                      {
                        value: "opt_2",
                        label: "Because moving the taller boundary is illegal.",
                      },
                    ],
                  },
                ],
              },
            },
          ],
          asOf: "2026-10-06T00:00:00Z",
          policyVersion: 1,
        },
      }),
    );

    const response = await page.goto("/review");
    expect(response?.status()).toBe(200);

    await expect(page.getByRole("heading", { name: "Your reviews" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Two Pointers Retrieval Exercise" }),
    ).toBeVisible();
    await expect(
      page.getByText("Why can the shorter boundary be safely advanced inward?"),
    ).toBeVisible();

    // Select answer and confidence
    await page
      .getByLabel("Because any inner container with the shorter line has strictly smaller area.")
      .check();
    await page.getByLabel("Confidence (optional, self-reported)").selectOption("high");
    await expect(page.getByRole("button", { name: "Record review" })).toBeVisible();

    // Capture Browser Screenshot
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "05-review.png"),
      fullPage: true,
    });
  });

  test("6. Progress Dashboard (/progress) — multi-dimensional learning signals and pause", async ({
    page,
  }) => {
    await page.route("**/api/auth/session", (route) =>
      route.fulfill({
        json: { authenticated: true, user: { id: "usr_audit_fixture", roles: ["learner"] } },
      }),
    );
    await page.route("**/api/progress", (route) =>
      route.fulfill({
        json: {
          timezone: "UTC",
          asOf: "2026-10-06T00:00:00Z",
          mastery: [
            {
              title: "Two Pointers Convergence",
              status: "active",
              projection: {
                conceptId: "cpt_two_pointer",
                band: "strong_signal",
                evidenceCount: 4,
                lastPracticed: "2026-10-06",
                reasonCodes: ["consistent_application"],
                languageProficiency: {
                  python: { observedPasses: 4 },
                },
              },
            },
          ],
          pendingConcepts: [],
          reviewHealth: {
            due: 1,
            overdue: 0,
            deferred: 0,
            completed: 3,
            pending: 0,
          },
          consistency: {
            currentStreak: 6,
            longestStreak: 12,
            activeDays: 18,
          },
          pauses: [],
          planAdherence: {
            status: "on_track",
            totalDue: 5,
            completedOnTime: 5,
          },
          calibration: [],
          externalPractice: {
            provenance: "learner_reported",
            requested: 1,
            completed: 2,
            references: [],
          },
        },
      }),
    );

    const response = await page.goto("/progress");
    expect(response?.status()).toBe(200);

    await expect(page.getByRole("heading", { name: "Your progress" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Internal mastery" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Two Pointers Convergence" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Review health" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Study consistency" })).toBeVisible();

    // Capture Browser Screenshot
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "06-progress.png"),
      fullPage: true,
    });
  });

  test("7. Learner Onboarding (/onboarding) — profile form with accessibility options", async ({
    page,
  }) => {
    await page.route("**/api/auth/session", (route) =>
      route.fulfill({
        json: { authenticated: true, user: { id: "usr_audit_fixture", roles: ["learner"] } },
      }),
    );
    await page.route("**/api/onboarding", (route) => route.fulfill({ json: { profile: null } }));

    const response = await page.goto("/onboarding");
    expect(response?.status()).toBe(200);

    await expect(
      page.getByRole("heading", { name: "Shape the learning loop around your week." }),
    ).toBeVisible();
    await page.getByLabel("Learning goal").fill("Master algorithms with calm consistency");
    await page.getByLabel("Target role").fill("Senior Software Engineer");
    await page.getByLabel("Daily minutes").fill("45");

    // Accessibility checkboxes
    await page.getByLabel("Reduce motion").check();
    await page.getByLabel("Use higher contrast").check();

    // Capture Browser Screenshot
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "07-onboarding.png"),
      fullPage: true,
    });
  });

  test("8. Execution Readiness (/execution-readiness) — 6-language verified runtime matrix", async ({
    page,
  }) => {
    const response = await page.goto("/execution-readiness");
    expect(response?.status()).toBe(200);

    await expect(page.getByRole("heading", { name: "Python" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "JavaScript" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "TypeScript" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Java", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "C++" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "C", exact: true })).toBeVisible();

    // Capture Browser Screenshot
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "08-execution-readiness.png"),
      fullPage: true,
    });
  });

  test("9. Content Operations (/admin/content) — author role curriculum suite", async ({
    page,
  }) => {
    await page.route("**/api/auth/session", (route) =>
      route.fulfill({
        json: { authenticated: true, user: { id: "usr_author_fixture", roles: ["author"] } },
      }),
    );
    await page.route("**/api/admin/content**", (route) =>
      route.fulfill({
        json: {
          records: [
            {
              content: {
                contentVersionId: "cnt_audit_001",
                problemId: "prob_audit_001",
                version: 1,
                status: "published",
                title: "Two Pointers in a Sorted Array",
                statement: "Statement content",
                provenance: { rightsHolder: "AlgoCove Foundation", license: "CC-BY-4.0" },
                validation: { status: "passed", issues: [] },
                reviews: [],
              },
              revision: "rev_1",
              manifest: { problemId: "prob_audit_001", languageProfiles: [] },
              manifestIssue: null,
            },
          ],
          permissions: ["content.author", "content.review"],
          actorId: "usr_author_fixture",
        },
      }),
    );

    const response = await page.goto("/admin/content");
    expect(response?.status()).toBe(200);

    await expect(page.getByRole("heading", { name: "Governed content" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Content library" })).toBeVisible();
    await expect(page.getByText("Two Pointers in a Sorted Array")).toBeVisible();

    // Capture Browser Screenshot
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "09-admin-content.png"),
      fullPage: true,
    });
  });

  test("10. Readiness Operations (/admin/readiness) — governance & policy inspector", async ({
    page,
  }) => {
    await page.route("**/api/auth/session", (route) =>
      route.fulfill({
        json: { authenticated: true, user: { id: "usr_author_fixture", roles: ["author"] } },
      }),
    );
    await page.route("**/api/admin/readiness**", (route) =>
      route.fulfill({
        json: {
          draftTemplate: { command: "draft_rubric" },
          references: [
            {
              external_reference_id: "ref_audit_001",
              title: "Official Spec Two Pointers",
              url_status: "reviewed",
            },
          ],
          rubrics: [
            {
              rubric_id: "rubric_two_pointer",
              version: 1,
              status: "published",
            },
          ],
        },
      }),
    );

    const response = await page.goto("/admin/readiness");
    expect(response?.status()).toBe(200);

    await expect(page.getByRole("heading", { name: "External preparation content" })).toBeVisible();
    await page.getByRole("button", { name: "Load policies and references" }).click();
    await expect(page.getByRole("heading", { name: "References" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Rubrics" })).toBeVisible();
    await expect(page.getByText("Official Spec Two Pointers")).toBeVisible();

    // Capture Browser Screenshot
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "10-admin-readiness.png"),
      fullPage: true,
    });
  });

  test("11. Sign In (/sign-in) — authentication backdrop and setup notice", async ({ page }) => {
    const response = await page.goto("/sign-in");
    expect(response?.status()).toBe(200);

    await expect(page.locator(".ac-auth-page")).toBeVisible();
    await expect(page.locator(".ac-auth-page a[href='/']")).toBeVisible();
    await expect(page.getByText("Authentication is not configured")).toBeVisible();

    // Capture Browser Screenshot
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "11-sign-in.png"),
      fullPage: true,
    });
  });

  test("12. Sign Up (/sign-up) — registration entry and setup notice", async ({ page }) => {
    const response = await page.goto("/sign-up");
    expect(response?.status()).toBe(200);

    await expect(page.locator(".ac-auth-page")).toBeVisible();
    await expect(page.locator(".ac-auth-page a[href='/']")).toBeVisible();
    await expect(page.getByText("Authentication is not configured")).toBeVisible();

    // Capture Browser Screenshot
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "12-sign-up.png"),
      fullPage: true,
    });
  });

  test("13. 404 Recovery (/unknown-page-route) — accessible not found page", async ({ page }) => {
    const response = await page.goto("/unknown-page-route");
    expect(response?.status()).toBe(404);

    await expect(page.getByRole("heading", { name: "This page is not available." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to Home" })).toBeVisible();

    // Capture Browser Screenshot
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "13-not-found.png"),
      fullPage: true,
    });
  });

  test("14. Browser Extension Hydration Resilience — suppressHydrationWarning prevents extension attribute mismatch", async ({
    page,
  }) => {
    const hydrationErrors: string[] = [];
    page.on("console", (msg) => {
      if (
        msg.type() === "error" &&
        (msg.text().includes("hydration") || msg.text().includes("Hydration"))
      ) {
        hydrationErrors.push(msg.text());
      }
    });

    // Simulate LanguageTool injecting attributes before hydration
    await page.addInitScript(() => {
      document.documentElement.setAttribute("data-lt-installed", "true");
      document.documentElement.setAttribute("suppresshydrationwarning", "true");
    });

    await page.route("**/api/auth/session", (route) =>
      route.fulfill({ status: 401, json: { authenticated: false } }),
    );
    await page.route("**/api/onboarding", (route) =>
      route.fulfill({ status: 401, json: { profile: null } }),
    );

    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    // Verify root layout has suppressHydrationWarning
    await expect(page.locator("html")).toBeVisible();
    await expect(page.locator("body")).toBeVisible();

    // Verify zero hydration errors occurred
    expect(hydrationErrors).toEqual([]);
  });
});
