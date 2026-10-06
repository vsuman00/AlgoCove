import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const id = "cnt_aaaaaaaaaaaaaaaa";
const record = {
  content: {
    contentVersionId: id,
    title: "Original array practice",
    statement: "Reason about the authored array.",
    checksum: `sha256:${"a".repeat(64)}`,
    status: "draft",
    payloadStatus: "available",
    authorId: "usr_aaaaaaaaaaaaaaaa",
    provenance: { kind: "original", rightsHolder: "AlgoCove", license: "original-v1" },
    reviews: [],
    validation: { status: "pending", message: null },
  },
  revision: "a".repeat(64),
  manifest: { languages: [], fixtures: [] },
  manifestIssue: "Six supported languages are required.",
};

test("content operations show sign-in without substituting a candidate", async ({ page }) => {
  await page.goto("/admin/content");
  await expect(page.getByText("Sign in to open content operations.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open workflow" })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("content library and private workflow reflow accessibly at 320px", async ({ page }) => {
  await page.route("**/api/admin/content**", (route) =>
    route.fulfill({
      json: {
        records: [record],
        permissions: ["content.author", "content.publish"],
        actorId: "usr_aaaaaaaaaaaaaaaa",
      },
    }),
  );
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/admin/content");
  await expect(page.getByRole("heading", { name: "Content library" })).toBeVisible();
  await page.getByRole("link", { name: "Original array practice", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Version details" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish version" })).toBeDisabled();
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("forbidden content access stays closed and transient failures can retry", async ({ page }) => {
  let status = 403;
  await page.route("**/api/admin/content**", (route) => route.fulfill({ status, json: {} }));
  await page.goto(`/admin/content/${id}`);
  await expect(
    page.getByText("Your account does not have access to content operations."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish version" })).toHaveCount(0);
  status = 503;
  await page.reload();
  await expect(page.getByRole("button", { name: "Retry content" })).toBeVisible();
  status = 200;
  await page.unroute("**/api/admin/content**");
  await page.route("**/api/admin/content**", (route) =>
    route.fulfill({
      json: { records: [], permissions: ["content.author"], actorId: "usr_aaaaaaaaaaaaaaaa" },
    }),
  );
  await page.getByRole("button", { name: "Retry content" }).click();
  await expect(page.getByRole("button", { name: "Retry content" })).toHaveCount(0);
});

test("readiness operations recover from load and JSON errors and reflow accessibly", async ({
  page,
}) => {
  let reads = 0;
  const commands: unknown[] = [];
  await page.route("**/api/admin/readiness", async (route) => {
    if (route.request().method() === "POST") {
      commands.push(route.request().postDataJSON());
      await route.fulfill({ json: {} });
      return;
    }
    reads += 1;
    await route.fulfill(
      reads === 1
        ? { status: 503, json: {} }
        : {
            json: { rubrics: [], references: [], draftTemplate: { action: "create_reference" } },
          },
    );
  });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/admin/readiness");
  const load = page.getByRole("button", { name: "Load policies and references" });
  await load.click();
  await expect(
    page.getByText("Content unavailable or staff access denied. Retry after signing in."),
  ).toBeVisible();
  await load.click();
  await expect(page.getByRole("heading", { name: "References", exact: true })).toBeVisible();
  const input = page.getByLabel("Preparation or reference command (JSON)");
  await input.fill("invalid-json");
  await page.getByRole("button", { name: "Record content command" }).click();
  await expect(page.getByText("Enter valid JSON.")).toBeVisible();
  expect(commands).toEqual([]);
  await input.fill('{"action":"create_reference"}');
  await page.getByRole("button", { name: "Record content command" }).click();
  await expect(page.getByText("Content command recorded.")).toBeVisible();
  expect(commands).toEqual([{ action: "create_reference" }]);
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
