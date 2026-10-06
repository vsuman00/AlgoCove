import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  CONTAINER_EXTERNAL_QUESTIONS,
  buildBaselinePlan,
  parseRoadmapPreferences,
  parseInstant,
  evaluateExternalReadiness,
  formatId,
} from "../../packages/domain/src/index.ts";
/** Controlled browser transport seams; real grading, ownership and journal SQL are covered by the PostgreSQL companion integration test. */
test("accepted plan to internal preparation, safe navigation, self-report, correction and review", async ({
  page,
  context,
}) => {
  const outgoing: { url: string; headers: Record<string, string> }[] = [];
  context.on("request", (request) => {
    outgoing.push({ url: request.url(), headers: request.headers() });
  });
  const now = parseInstant("2026-10-06T10:00:00Z");
  if (!now.ok) throw Error();
  const preferences = parseRoadmapPreferences(
    {
      goal: "Reviewed pilot",
      targetRole: "Engineer",
      horizonMonths: 1,
      startDay: "2026-10-06",
      timezone: "UTC",
      dailyCapacityMinutes: 90,
      studyWeekdays: [1, 2, 3, 4, 5],
      preferredLanguages: ["python"],
      collectionIds: [],
    },
    now.value,
  );
  const schedule = buildBaselinePlan({
    preferences,
    catalog: {
      curriculumVersionId: null,
      masteredKeys: [],
      coverage: "Reviewed pilot",
      fullCoverage: false,
      collections: [],
      units: [
        {
          key: "problem:prb_dddddddddddddddd",
          kind: "internal_problem",
          targetId: "prb_dddddddddddddddd",
          title: "Original two-pointer exercise",
          href: "/learn/arrays-two-pointer",
          minutes: 50,
          required: true,
          prerequisites: [],
          languages: ["python"],
          available: true,
          rightsValid: true,
          linkHealthy: true,
          reasonCodes: ["reviewed_pilot"],
        },
      ],
    },
    scope: "reviewed_pilot",
    today: "2026-10-06",
  });
  if (!schedule.ok) throw Error();
  await page.route("**/api/auth/session", (r) =>
    r.fulfill({
      json: { authenticated: true, user: { id: "usr_companion_fixture", roles: ["learner"] } },
    }),
  );
  await page.route("**/api/planning/intent", (r) =>
    r.fulfill({ json: { intent: null, profile: null, collections: [], asOf: now.value } }),
  );
  await page.route("**/api/planning/roadmap", (r) =>
    r.fulfill({
      json: {
        state: {
          versionId: "evt_aaaaaaaaaaaaaaaa",
          token: "evt_bbbbbbbbbbbbbbbb",
          status: "active",
          schedule: schedule.schedule,
        },
        candidates: [],
        history: [],
        journal: [],
      },
    }),
  );
  await page.route("**/api/practice/problems/*", (r) =>
    r.fulfill({
      json: {
        problem: {
          title: "Original two-pointer exercise",
          statement: "Original internal preparation.",
        },
      },
    }),
  );
  const fields = Object.fromEntries(
    [
      "inputs",
      "state",
      "initialization",
      "invariant",
      "loop",
      "termination",
      "output",
      "complexity",
    ].map((f) => [f, "my reasoning"]),
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
          currentText: "my internally checked source",
        },
        pseudocode: { pseudocodeId: "psc_aaaaaaaaaaaaaaaa", version: 1, current: fields },
      },
    }),
  );
  await page.route("**/api/practice/drafts/*", (r) =>
    r.fulfill({ json: { draft: { version: 2 }, state: "saved_current" } }),
  );
  await page.route("**/api/practice/pseudocode/*", (r) =>
    r.fulfill({ json: { artifact: { version: 2, savedRevision: 1 }, state: "saved_revision" } }),
  );
  await page.route("**/api/mastery/explanation", (r) =>
    r.fulfill({ json: { correct: true, status: "ready" } }),
  );
  const url = "https://leetcode.com/problems/container-with-most-water";
  let ready = false,
    journal = "none",
    blocked = false,
    failJournal = false,
    bypassRequested = false;
  function parsed<K extends Parameters<typeof formatId>[0]>(kind: K) {
    const result = formatId(kind, "aaaaaaaaaaaaaaaa");
    if (!result.ok) throw Error("Invalid browser fixture identity");
    return result.value;
  }
  const view = () => ({
    decision: {
      status: ready && !blocked ? "ready" : "not_ready",
      rubricId: "fixture",
      rubricVersion: 1,
      reasons: bypassRequested
        ? evaluateExternalReadiness({
            binding: {
              learnerId: parsed("learner"),
              attemptId: parsed("attempt"),
              problemVersionId: parsed("problemVersion"),
              manifestId: parsed("languageManifest"),
              sourceChecksum: null,
              reasoningRevision: 0,
            },
            mode: "practice",
            contentAvailable: true,
            rubric: null,
            highestAssistanceTier: 0,
            evidence: [],
            bypassRequested: true,
          }).reasons
        : ready && !blocked
          ? []
          : [
              {
                code: "preparation_required",
                message: blocked
                  ? "The reviewed destination is unavailable."
                  : "Complete reviewed preparation checks.",
              },
            ],
      evidenceIds: [],
      bypassAvailable: false,
    },
    questions: CONTAINER_EXTERNAL_QUESTIONS.map(
      ({ answer: _answer, category: _category, ...q }) => q,
    ),
    reference: blocked
      ? null
      : {
          referenceId: "ref_aaaaaaaaaaaaaaaa",
          title: "Independent provider practice",
          attribution: "LeetCode",
          relation: "same_pattern",
          rationale: "Independent practice for the same pattern.",
          url: ready ? url : null,
        },
    journal,
  });
  await page.route("**/api/practice/external-companion", async (r) => {
    const body = r.request().postDataJSON();
    expect(body.attemptId).toBe("att_aaaaaaaaaaaaaaaa");
    if (body.action === "grade") {
      expect(body.answers).toEqual(
        Object.fromEntries(CONTAINER_EXTERNAL_QUESTIONS.map((q) => [q.id, q.answer])),
      );
      ready = true;
    }
    if (body.action === "open") {
      if (blocked || failJournal) {
        await r.fulfill({ status: blocked ? 400 : 503, json: { error: { code: "unavailable" } } });
        return;
      }
      journal = "handoff_requested";
      await r.fulfill({ json: { status: "recorded", provenance: "learner_reported", url } });
      return;
    }
    if (body.action === "completed" || body.action === "corrected") {
      journal = body.action;
      await r.fulfill({ json: { status: "recorded", provenance: "learner_reported", url: null } });
      return;
    }
    await r.fulfill({ json: view() });
  });
  await context.route("https://leetcode.com/**", (r) =>
    r.fulfill({ contentType: "text/html", body: "<p>Provider navigation test stub</p>" }),
  );
  await page.goto("/plan");
  await page.getByRole("link", { name: "Open Original two-pointer exercise" }).click();
  await page.getByRole("button", { name: "Save and check reasoning revision" }).click();
  await expect(page.getByText(/Reviewed structured checks passed/)).toBeVisible();
  await page.getByRole("button", { name: "Check external practice readiness" }).click();
  const panel = page.getByRole("region", { name: "External practice readiness" });
  for (const q of CONTAINER_EXTERNAL_QUESTIONS)
    await panel.getByLabel(q.prompt).selectOption(q.answer);
  await panel.getByRole("button", { name: "Check preparation answers" }).click();
  await expect(panel.getByText("Internal preparation is ready.")).toBeVisible();
  failJournal = true;
  await panel.getByRole("button", { name: "Prepare external link" }).click();
  await expect(panel.getByText(/The journal is unavailable/)).toBeVisible();
  expect(journal).toBe("none");
  failJournal = false;
  await panel.getByRole("button", { name: "Prepare external link" }).click();
  const link = panel.getByRole("link", { name: "Open on provider" });
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  await expect(link).toHaveAttribute("referrerpolicy", "no-referrer");
  const popup = context.waitForEvent("page");
  await link.click();
  const destination = await popup;
  await destination.waitForURL(url);
  expect(destination.url()).toBe(url);
  await destination.close();
  await panel
    .getByRole("button", { name: "I completed this externally (learner-confirmed)" })
    .click();
  await expect(panel.getByText("External completion recorded as learner-confirmed.")).toBeVisible();
  await panel.getByRole("button", { name: "Correct my external completion" }).click();
  await expect(
    panel.getByRole("button", { name: "I completed this externally (learner-confirmed)" }),
  ).toBeVisible();
  ready = false;
  bypassRequested = true;
  await panel.getByRole("button", { name: "Check external practice readiness" }).click();
  await expect(
    panel.getByText("Complete internal preparation before external practice."),
  ).toBeVisible();
  await expect(panel.getByRole("link", { name: "Open on provider" })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Prepare external link" })).toHaveCount(0);
  expect(journal).toBe("corrected");
  bypassRequested = false;
  blocked = true;
  await panel.getByRole("button", { name: "Check external practice readiness" }).click();
  await expect(panel.getByText("The reviewed destination is unavailable.")).toBeVisible();
  await expect(panel.getByRole("link", { name: "Open on provider" })).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 900 });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("textbox", { name: "Python source" }).fill("changed source");
  await expect(panel.getByText("Save your current work, then check preparation.")).toBeVisible();
  await page.route("**/api/review", (r) =>
    r.fulfill({
      json: {
        reviews: [
          {
            reviewId: "evt_aaaaaaaaaaaaaaaa",
            status: "due",
            timing: "overdue",
            timezone: "UTC",
            dueStart: "2026-10-04T10:00:00Z",
            dueEnd: "2026-10-05T10:00:00Z",
            exercise: {
              exerciseId: "companion-reasoning-v1",
              title: "Companion delayed reasoning",
              kind: "recall",
              rubricVersion: 1,
              questions: [
                {
                  id: "boundary",
                  prompt: "Which boundary can move?",
                  options: [
                    { value: "shorter", label: "Shorter" },
                    { value: "taller", label: "Taller" },
                  ],
                },
              ],
            },
          },
        ],
        asOf: now.value,
        policyVersion: 1,
      },
    }),
  );
  await page.goto("/review");
  await expect(page.getByRole("heading", { name: "Your reviews" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Companion delayed reasoning" })).toBeVisible();
  await expect(page.getByText("Overdue · catch up when ready")).toBeVisible();
  const provider = outgoing.filter((r) => new URL(r.url).hostname === "leetcode.com");
  expect(provider).toHaveLength(1);
  expect(provider[0]?.url).toBe(url);
  expect(provider[0]?.headers.referer).toBeUndefined();
  for (const request of outgoing.filter(
    (r) =>
      new URL(r.url).pathname.startsWith("/api/") || new URL(r.url).hostname === "leetcode.com",
  )) {
    expect(new URL(request.url).search).toBe("");
    expect(request.url).not.toContain("my internally checked source");
    expect(request.url).not.toContain("my reasoning");
  }
});
