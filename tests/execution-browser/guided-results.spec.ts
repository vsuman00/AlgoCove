import { expect, test } from "@playwright/test";

const terminalCases = [
  { category: "pass", label: "Passed" },
  { category: "wrong_answer", label: "Wrong answer" },
  { category: "compile_error", label: "Compile error" },
  { category: "limits", label: "Resource limit" },
  { category: "infrastructure_error", label: "Infrastructure failure" },
] as const;

for (const terminalCase of terminalCases) {
  test(`renders trusted ${terminalCase.category} status and never exposes source`, async ({
    page,
  }) => {
    const runId = `run_browser_${terminalCase.category}`;
    const source = "browser fixture source";
    const workspaceResponse = () => ({
      attempt: { attemptId: "att_browser_fixture" },
      firstHintId: "hint-arrays-1",
      starterTemplate: "starter source",
      sourceDraft: {
        draftId: "drf_browser_fixture",
        version: 1,
        currentRevision: 1,
        currentText: source,
      },
      pseudocode: {
        pseudocodeId: "psc_browser_fixture",
        version: 1,
        current: {},
      },
      activeRun: {
        runId,
        mode: "run",
        status: "completed",
        result: {
          resultId: `result_${terminalCase.category}`,
          terminalCategory: terminalCase.category,
          classification:
            terminalCase.category === "pass"
              ? "success"
              : terminalCase.category === "infrastructure_error"
                ? "infrastructure_failure"
                : terminalCase.category === "limits"
                  ? "learner_failure"
                  : "learner_failure",
          passed: terminalCase.category === "pass",
        },
      },
    });

    await page.route("**/api/auth/session", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ authenticated: true, user: { id: "usr_browser_fixture" } }),
      });
    });
    await page.route("**/api/practice/workspace", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(workspaceResponse()),
      });
    });
    await page.route("**/api/practice/drafts/*", async (route) => {
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
    await page.route("**/api/practice/runs", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      const body = route.request().postDataJSON() as { source?: string; mode?: string };
      expect(body).toMatchObject({ source, mode: "run" });
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({ status: "queued", runId }),
      });
    });
    await page.route(`**/api/practice/runs/${runId}`, async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(workspaceResponse().activeRun),
      });
    });

    await page.goto("/learn/arrays-two-pointer");
    await expect(page.getByRole("textbox", { name: "Python source" })).toHaveValue(source);
    await expect(page.getByText(`Execution complete · ${terminalCase.label}`)).toBeVisible();

    if (terminalCase.category === "pass") {
      await page.getByRole("button", { name: "Run checks" }).click();
      await expect(page.getByText("Execution complete · Passed")).toBeVisible();
      await page.reload();
      await expect(page.getByText("Execution complete · Passed")).toBeVisible();
    }
  });
}
