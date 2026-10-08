import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { pilotPublicView, validatePilotBundle } from "../../packages/content/src/pilot-bundle";
const patterns = ["arrays-hashing", "two-pointers", "sliding-window", "stack"];
for (const pattern of patterns) {
  const b = validatePilotBundle(
    JSON.parse(readFileSync(`content/patterns/${pattern}/bundle.json`, "utf8")),
  );
  test(`${pattern}: governed workspace, every trace state, keyboard, reduced motion and mobile`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/api/auth/session", (r) =>
      r.fulfill({
        json: { authenticated: true, user: { id: "usr_1111111111111111", roles: ["learner"] } },
      }),
    );
    await page.route("**/api/practice/problems/**", (r) =>
      r.fulfill({
        json: { problem: { title: b.title, statement: b.statement, pilot: pilotPublicView(b) } },
      }),
    );
    await page.route("**/api/practice/workspace", async (r) => {
      const lang = r.request().postDataJSON().language as keyof typeof b.languages;
      await r.fulfill({
        json: {
          problem: { title: b.title, statement: b.statement, pilot: pilotPublicView(b) },
          starterTemplate: b.languages[lang].starter,
          firstHintId: `hint-pilot-${pattern}-1`,
          highestHintTier: 0,
          attempt: { attemptId: "att_1111111111111111", status: "active" },
          sourceDraft: {
            draftId: "drf_1111111111111111",
            version: 1,
            currentRevision: 0,
            currentText: "",
          },
          pseudocode: {
            pseudocodeId: "pse_1111111111111111",
            version: 1,
            savedRevision: 0,
            current: {
              inputs: "",
              state: "",
              initialization: "",
              invariant: "",
              loop: "",
              termination: "",
              output: "",
              complexity: "",
              structuredAnswers: {},
            },
          },
        },
      });
    });
    let reveals = 0;
    await page.route("**/api/practice/trace", (r) => {
      reveals++;
      return r.fulfill({
        json: {
          trace: { schemaVersion: 2, provenance: "authored_reference", pattern, ...b.trace },
          exposure: { tier: 4 },
        },
      });
    });
    await page.goto(`/learn/${b.slug}`);
    await expect(page.getByRole("heading", { name: b.title, exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Python source" })).toHaveValue(
      b.languages.python.starter,
    );
    expect(reveals).toBe(0);
    await expect(page.locator(".ac-pilot-trace")).toHaveCount(0);
    await page.getByRole("button", { name: "Reveal reviewed reference" }).click();
    const trace = page.locator(".ac-pilot-trace");
    await expect(trace).toBeVisible();
    for (let i = 0; i < b.trace.states.length; i++) {
      await expect(trace.getByRole("status")).toContainText(b.trace.states[i]!.explanation);
      expect(
        (await new AxeBuilder({ page }).include(".ac-pilot-trace").analyze()).violations,
      ).toEqual([]);
      if (i < b.trace.states.length - 1)
        await trace.getByRole("button", { name: "Next step" }).click();
    }
    await expect(trace.getByRole("button", { name: "Next step" })).toBeDisabled();
    await trace.focus();
    await page.keyboard.press("Home");
    await expect(trace.getByRole("status")).toContainText("initialize");
    await page.keyboard.press("End");
    await expect(trace.getByRole("status")).toContainText("complete");
    await trace.getByRole("button", { name: "Restart trace" }).click();
    await trace.getByRole("combobox", { name: "Playback speed" }).selectOption("4");
    await trace.getByRole("button", { name: "Play walkthrough" }).click();
    await expect(trace.getByRole("button", { name: "Pause playback" })).toBeVisible();
    await trace.getByRole("button", { name: "Pause playback" }).click();
    await trace.getByRole("slider", { name: "Walkthrough step" }).press("Home");
    await trace.getByRole("slider", { name: "Walkthrough step" }).press("ArrowRight");
    await expect(trace.getByRole("status")).toContainText(b.trace.states[1]!.explanation);
    await expect(trace.locator('[aria-current="step"]')).toContainText(/./);
    await trace.getByText("Full text transcript").click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.setViewportSize({ width: 320, height: 800 });
    const size = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(size.scroll).toBeLessThanOrEqual(size.width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.evaluate(() => {
      document.documentElement.style.zoom = "1";
    });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await trace.getByRole("button", { name: "Use isometric view" }).click();
    await expect(trace).toHaveAttribute("data-view", "isometric");
    expect(
      (await new AxeBuilder({ page }).include(".ac-pilot-trace").analyze()).violations,
    ).toEqual([]);
    await trace.getByRole("button", { name: "Use flat view" }).click();
    for (const [language, label] of [
      ["javascript", "JavaScript"],
      ["typescript", "TypeScript"],
      ["java", "Java"],
      ["cpp", "C++"],
      ["c", "C"],
      ["python", "Python"],
    ] as const) {
      await page
        .getByRole("combobox", { name: "Implementation language", exact: true })
        .selectOption(language);
      await expect(page.getByRole("textbox", { name: `${label} source`, exact: true })).toHaveValue(
        b.languages[language].starter,
      );
    }
  });
  test(`${pattern}: unpublished bundle stays unavailable`, async ({ page }) => {
    await page.route("**/api/auth/session", (r) =>
      r.fulfill({ status: 401, json: { authenticated: false } }),
    );
    await page.route("**/api/practice/problems/**", (r) =>
      r.fulfill({ status: 404, json: { error: { code: "not_found" } } }),
    );
    await page.goto(`/learn/${b.slug}`);
    await expect(page.getByRole("textbox", { name: "Python source" })).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "This problem is no longer available." }),
    ).toBeVisible();
  });
}

test("published discovery lists only available internal releases", async ({ page }) => {
  await page.route("**/api/auth/session", (r) =>
    r.fulfill({ status: 401, json: { authenticated: false } }),
  );
  await page.route("**/api/learning/problems?**", (r) =>
    r.fulfill({
      json: {
        items: [
          {
            slug: "matching-readings",
            title: "Matching sensor readings",
            pattern: "arrays-hashing",
            languages: ["python"],
          },
        ],
        nextAfter: null,
      },
    }),
  );
  await page.goto("/learn");
  await expect(page.getByRole("link", { name: "Start guided learning" })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Read concept lesson" })).toHaveCount(1);
  await page.setViewportSize({ width: 320, height: 800 });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("pilot staff packet stays private when content access is denied", async ({ page }) => {
  await page.route("**/api/auth/session", (r) =>
    r.fulfill({ status: 401, json: { authenticated: false } }),
  );
  await page.route("**/api/admin/pilot", (r) =>
    r.fulfill({ status: 403, json: { error: { code: "forbidden" } } }),
  );
  await page.goto("/admin/pilot");
  await expect(page.getByText("An active content role is required.")).toBeVisible();
  await expect(page.getByText("Complete private review packet")).toHaveCount(0);
  await expect(page.getByLabel("Import original bundle or collection JSON")).toBeDisabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("catalog aliases enter the existing reviewed workspace without a fixed route allowlist", async ({
  page,
}) => {
  const bundle = validatePilotBundle(
    JSON.parse(readFileSync("content/patterns/arrays-hashing/bundle.json", "utf8")),
  );
  await page.route("**/api/auth/session", (r) =>
    r.fulfill({ status: 401, json: { authenticated: false } }),
  );
  await page.route("**/api/practice/problems/matching-readings-old-link", (r) =>
    r.fulfill({
      json: {
        problem: {
          title: bundle.title,
          statement: bundle.statement,
          pilot: pilotPublicView(bundle),
        },
      },
    }),
  );
  await page.goto("/learn/matching-readings-old-link");
  await expect(page.getByRole("heading", { name: bundle.title, exact: true })).toBeVisible();
  await expect(page.getByText(bundle.statement, { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Python source" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Workspace status" })).toContainText(
    "Sign in for private recovery",
  );
  await expect(page.getByRole("button", { name: "Run checks", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Submit attempt", exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole("heading", { name: bundle.title, exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
