import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("privacy export, confirmation, deletion status and scoped browser recovery cleanup", async ({
  page,
}) => {
  const account = "usr_aaaaaaaaaaaaaaaa";
  let state = "active";
  await page.route("**/api/auth/session", (r) =>
    r.fulfill({ json: { authenticated: true, user: { id: account, roles: ["learner"] } } }),
  );
  await page.route("**/api/privacy", async (r) => {
    if (r.request().method() === "GET")
      return r.fulfill({
        json: {
          state,
          requestId: state === "active" ? null : "evt_aaaaaaaaaaaaaaaa",
          deletionState: state === "active" ? null : state === "deleted" ? "completed" : "pending",
          backupExpiry: state === "active" ? null : "2026-11-06T12:00:00Z",
        },
      });
    if (r.request().postDataJSON().action === "export")
      return r.fulfill({ json: { schemaVersion: 1, data: { owned: "SYNTHETIC_OWN_EXPORT" } } });
    state = "deletion_pending";
    return r.fulfill({
      json: {
        state,
        requestId: "evt_aaaaaaaaaaaaaaaa",
        deletionState: "pending",
        backupExpiry: "2026-11-06T12:00:00Z",
      },
    });
  });
  await page.goto("/settings/privacy");
  await expect(page.getByRole("button", { name: "Export private data" })).toBeEnabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export private data" }).click();
  expect((await download).suggestedFilename()).toBe("algocove-private-data.json");
  await expect(page.getByRole("button", { name: "Request deletion" })).toBeDisabled();
  await page.evaluate(() => {
    localStorage.setItem(
      "algocove:workspace-recovery:matching-readings:usr_aaaaaaaaaaaaaaaa:python",
      "owned",
    );
    localStorage.setItem(
      "algocove:workspace-recovery:matching-readings:usr_bbbbbbbbbbbbbbbb:python",
      "other",
    );
  });
  await page.getByLabel("Type DELETE MY DATA to confirm").fill("DELETE MY DATA");
  await page.getByRole("button", { name: "Request deletion" }).click();
  await expect(page.getByRole("status")).toContainText("Deletion requested");
  expect(
    await page.evaluate(() =>
      localStorage.getItem(
        "algocove:workspace-recovery:matching-readings:usr_aaaaaaaaaaaaaaaa:python",
      ),
    ),
  ).toBeNull();
  expect(
    await page.evaluate(() =>
      localStorage.getItem(
        "algocove:workspace-recovery:matching-readings:usr_bbbbbbbbbbbbbbbb:python",
      ),
    ),
  ).toBe("other");
  state = "deleted";
  await page.getByRole("button", { name: "Refresh status" }).click();
  await expect(page.getByText("Account state: deleted.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export private data" })).toBeDisabled();
});
test("privacy interruption preserves data and presents a status-first retry", async ({ page }) => {
  await page.route("**/api/auth/session", (r) =>
    r.fulfill({
      json: { authenticated: true, user: { id: "usr_aaaaaaaaaaaaaaaa", roles: ["learner"] } },
    }),
  );
  await page.route("**/api/privacy", (r) =>
    r.fulfill(
      r.request().method() === "GET"
        ? { json: { state: "active", requestId: null, deletionState: null, backupExpiry: null } }
        : {
            status: 503,
            json: { error: { message: "Cancellation dependency unavailable. Retry." } },
          },
    ),
  );
  await page.goto("/settings/privacy");
  await page.getByLabel("Type DELETE MY DATA to confirm").fill("DELETE MY DATA");
  await page.getByRole("button", { name: "Request deletion" }).click();
  await expect(page.getByRole("status")).toContainText("Cancellation dependency unavailable");
  await expect(page.getByRole("button", { name: "Refresh status" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Export private data" })).toBeEnabled();
});
