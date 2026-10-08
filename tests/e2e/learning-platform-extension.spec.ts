import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("discovery filters, pagination, no matches and retry preserve usable navigation", async ({
  page,
}) => {
  await page.route("**/api/auth/session", (r) =>
    r.fulfill({ status: 401, json: { authenticated: false } }),
  );
  let fail = false;
  await page.route("**/api/learning/problems?**", (r) => {
    const q = new URL(r.request().url()).searchParams;
    if (fail) return r.fulfill({ status: 503, json: { error: { message: "offline" } } });
    const items = q.get("search")
      ? []
      : [
          {
            problemId: "pro_1111111111111111",
            problemVersionId: "prb_1111111111111111",
            contentVersionId: "cnt_1111111111111111",
            checksum: "sha256:" + "a".repeat(64),
            slug: q.has("after") ? "another-fixture" : "distinct-fixture",
            title: q.has("after") ? "Another release" : "Distinct reviewed release",
            pattern: "stack",
            languages: ["python", "java"],
          },
        ];
    return r.fulfill({
      json: { items, nextAfter: q.has("after") || q.get("search") ? null : "distinct-fixture" },
    });
  });
  await page.goto("/learn");
  await expect(page.getByRole("heading", { name: "Distinct reviewed release" })).toBeVisible();
  await page.getByRole("combobox", { name: "Language", exact: true }).selectOption("java");
  await expect(page.getByRole("link", { name: "Start guided learning" })).toHaveAttribute(
    "href",
    "/learn/distinct-fixture?language=java",
  );
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByRole("heading", { name: "Another release" })).toBeVisible();
  await page.getByRole("button", { name: "First page" }).click();
  await page.getByLabel("Search", { exact: true }).fill("absent");
  await expect(page.getByRole("status")).toContainText("No reviewed items");
  await page.getByLabel("Search", { exact: true }).fill("");
  fail = true;
  await page.getByRole("button", { name: "Refresh availability" }).click();
  await expect(page.getByRole("status")).toContainText("Discovery is unavailable");
  fail = false;
  await page.getByRole("button", { name: "Refresh availability" }).click();
  await expect(page.getByRole("heading", { name: "Distinct reviewed release" })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 800 });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("ordered sheets keep duplicate memberships and separate internal mappings from external solves", async ({
  page,
}) => {
  await page.route("**/api/auth/session", (r) =>
    r.fulfill({ status: 401, json: { authenticated: false } }),
  );
  await page.route("**/api/learning/sheets?**", (r) =>
    r.fulfill({
      json: {
        collection: { id: "col_1111111111111111", title: "Reviewed curated sheet" },
        items: [
          {
            ordinal: 1,
            referenceId: "ref_1111111111111111",
            canonicalIdentity: "dst_one",
            title: "First membership",
            availability: "supported_internal",
            internalSlug: "matching-readings",
            solveUrl: "https://leetcode.com/problems/two-sum/",
            mappingKind: "transfer",
            mappingRationale: "Separate target-sum task",
            attribution: "Official source",
          },
          {
            ordinal: 2,
            referenceId: "ref_2222222222222222",
            canonicalIdentity: "dst_one",
            title: "Repeated membership",
            availability: "external_only",
            internalSlug: null,
            solveUrl: "https://leetcode.com/problems/two-sum/",
            attribution: "Official source",
          },
        ],
      },
    }),
  );
  await page.goto("/sheets/col_1111111111111111");
  await expect(page.getByRole("heading", { name: "1. First membership" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "2. Repeated membership" })).toBeVisible();
  await expect(page.getByRole("link", { name: "External solve (new tab)" })).toHaveCount(2);
  await expect(page.getByRole("link", { name: "Open mapped internal learning" })).toHaveAttribute(
    "href",
    /returnTo=/,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("auth cancellation rejects unsafe returns and preserves a valid deep link", async ({
  page,
}) => {
  await page.goto("/sign-in?returnTo=https%3A%2F%2Fevil.test");
  await expect(page.getByRole("link", { name: "Cancel and return" })).toHaveAttribute(
    "href",
    "/learn",
  );
  await page.goto("/sign-in?returnTo=%2Flearn%2Fmatching-readings%3Flanguage%3Djava");
  await expect(page.getByRole("link", { name: "Cancel and return" })).toHaveAttribute(
    "href",
    "/learn/matching-readings?language=java",
  );
});

test("distinct typed release composes learning panels and stage switches preserve reasoning", async ({
  page,
}) => {
  const learning = {
    schemaVersion: 1,
    slug: "distinct-fixture",
    pattern: "stack",
    brief: {
      input: "Markers arrive in order",
      output: "Count remaining markers",
      invariant: "Stack contains the uncancelled prefix",
      complexity: "O(n) time",
    },
    lesson: {
      objectives: ["Recognize cancellation"],
      prerequisites: [],
      blocks: [{ kind: "prose", text: "A distinct reviewed lesson fixture." }],
    },
    questions: [
      {
        id: "check",
        prompt: "Which structure preserves the prefix?",
        options: [
          { id: "stack", text: "Stack" },
          { id: "set", text: "Set" },
        ],
      },
    ],
    media: [],
    traceKind: "unavailable",
  };
  await page.route("**/api/auth/session", (r) =>
    r.fulfill({ status: 401, json: { authenticated: false } }),
  );
  await page.route("**/api/practice/problems/distinct-fixture", (r) =>
    r.fulfill({
      json: {
        problem: {
          title: "Distinct typed exercise",
          statement: "Cancel adjacent equal markers.",
          learning,
        },
      },
    }),
  );
  await page.goto("/learn/distinct-fixture?returnTo=%2Fsheets%2Fcol_1111111111111111");
  await expect(
    page.getByText("A distinct reviewed lesson fixture.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Markers arrive in order", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pseudocode", exact: true }).click();
  const invariant = page.getByRole("textbox", { name: "Invariant", exact: true });
  await invariant.fill("The prefix is uncancelled.");
  await page.getByRole("button", { name: "Implement", exact: true }).click();
  await page.getByRole("button", { name: "Pseudocode", exact: true }).click();
  await expect(invariant).toHaveValue("The prefix is uncancelled.");
  await expect(page.getByRole("link", { name: "Return to learning" })).toHaveAttribute(
    "href",
    "/sheets/col_1111111111111111",
  );
  await expect(
    page.getByText("Choose the boundary with the smaller height", { exact: false }),
  ).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
