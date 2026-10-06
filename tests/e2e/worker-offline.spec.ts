import { expect, test } from "@playwright/test";

// No application worker or model provider is started by this suite. Controlled
// transport seams isolate the authored UI and honest execution degradation.
test("authored learning and saves work with worker/provider stopped while execution stays queued or unavailable", async ({
  page,
}) => {
  await page.route("**/api/auth/session", (r) =>
    r.fulfill({
      json: { authenticated: true, user: { id: "usr_offline_fixture", roles: ["learner"] } },
    }),
  );
  await page.route("**/api/practice/problems/*", (r) =>
    r.fulfill({
      json: {
        problem: {
          title: "Original two-pointer exercise",
          statement: "Original authored learning remains available.",
        },
      },
    }),
  );
  await page.route("**/api/practice/workspace", (r) =>
    r.fulfill({
      json: {
        attempt: { attemptId: "att_aaaaaaaaaaaaaaaa" },
        firstHintId: "hint-arrays-1",
        starterTemplate: "source",
        sourceDraft: {
          draftId: "drf_aaaaaaaaaaaaaaaa",
          version: 1,
          currentRevision: 1,
          currentText: "saved source",
        },
        pseudocode: { pseudocodeId: "psc_aaaaaaaaaaaaaaaa", version: 1, current: {} },
      },
    }),
  );
  let saves = 0;
  await page.route("**/api/practice/drafts/*", async (r) => {
    saves++;
    await r.fulfill({ json: { draft: { version: 2 }, state: "saved_current" } });
  });
  await page.route("**/api/practice/pseudocode/*", (r) =>
    r.fulfill({ json: { artifact: { version: 2 }, state: "saved_current" } }),
  );
  await page.route("**/api/practice/hints", (r) =>
    r.fulfill({
      json: { hint: { body: "Original authored clarification: measure the bounded interval." } },
    }),
  );
  let unavailable = true;
  await page.route("**/api/practice/runs", (r) =>
    r.fulfill(
      unavailable
        ? { status: 503, json: { error: { code: "dependency_unavailable" } } }
        : { status: 202, json: { status: "queued", runId: "run_aaaaaaaaaaaaaaaa" } },
    ),
  );
  await page.route("**/api/practice/runs/run_aaaaaaaaaaaaaaaa", (r) =>
    r.fulfill({
      json: { runId: "run_aaaaaaaaaaaaaaaa", status: "queued", matchesCurrentDraft: true },
    }),
  );
  await page.goto("/learn/arrays-two-pointer");
  await expect(page.getByText("Original authored learning remains available.")).toBeVisible();
  await page.getByRole("button", { name: "Request clarification hint" }).click();
  await expect(
    page.getByText("Original authored clarification: measure the bounded interval."),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Python source" }).fill("saved edited source");
  await expect.poll(() => saves).toBeGreaterThan(0);
  const disabledMessage = page.getByText(
    "Execution is temporarily unavailable. Your work remains saved; try again later.",
  );
  if (await disabledMessage.isVisible()) {
    await expect(page.getByRole("button", { name: "Run checks" })).toBeDisabled();
    await expect(page.getByText("Execution complete · Passed")).toHaveCount(0);
    return;
  }
  await page.getByRole("button", { name: "Run checks" }).click();
  await expect(page.getByText("Execution unavailable · please try again")).toBeVisible();
  await expect(page.getByText("Execution complete · Passed")).toHaveCount(0);
  unavailable = false;
  await page.getByRole("button", { name: "Run checks" }).click();
  await expect(page.getByText(/Execution queued/)).toBeVisible();
  await expect(page.getByText("Execution complete · Passed")).toHaveCount(0);
});
