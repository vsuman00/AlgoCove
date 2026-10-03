import { createServer, type Server } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { chromium, expect as browserExpect, type Browser, type Page } from "@playwright/test";
import { createActor, type Actor } from "@algocove/application";
import {
  createPool,
  PostgresPracticeRepository,
  PostgresDraftRepository,
  PostgresHintRepository,
  PostgresPseudocodeRepository,
} from "@algocove/db";
import { formatId, PROBLEM_LANGUAGES, type ProblemLanguage } from "@algocove/domain";
import type * as RequestContextModule from "../../apps/web/src/auth/request-context";
import type { PracticeRuntime } from "../../apps/web/src/practice/runtime";
import { createHttpExecutionRelay } from "../../apps/web/src/adapters/execution-client";
import {
  correctContainerSource,
  wrongContainerSource,
  timeoutContainerSource,
} from "../fixtures/container-solutions.ts";

// Authentication is the only fixture seam. Every practice route, repository,
// descriptor, sandbox execution, callback and browser state is the real implementation.
const fixture = vi.hoisted(() => ({
  runtime: null as PracticeRuntime | null,
  actor: null as Actor | null,
}));
vi.mock("../../apps/web/src/practice/runtime", () => ({
  getPracticeRuntime: () => fixture.runtime,
}));
vi.mock("../../apps/web/src/auth/request-context", async (original) => {
  const authModule = await original<typeof RequestContextModule>();
  return {
    ...authModule,
    authenticatedWebRequestContext: async (request: Request) =>
      authModule.createWebRequestContext(
        fixture.actor!,
        request.headers.get("x-trace-id") ?? undefined,
      ),
  };
});

const routes = {
  explanation: await import("../../apps/web/app/api/mastery/explanation/route"),
  publishedProblem: await import("../../apps/web/app/api/practice/problems/[problemId]/route"),
  workspace: await import("../../apps/web/app/api/practice/workspace/route"),
  draft: await import("../../apps/web/app/api/practice/drafts/[draftId]/route"),
  pseudocode: await import("../../apps/web/app/api/practice/pseudocode/[pseudocodeId]/route"),
  trace: await import("../../apps/web/app/api/practice/trace/route"),
  hint: await import("../../apps/web/app/api/practice/hints/route"),
  run: await import("../../apps/web/app/api/practice/runs/route"),
  status: await import("../../apps/web/app/api/practice/runs/[runId]/route"),
  cancel: await import("../../apps/web/app/api/practice/runs/[runId]/cancel/route"),
  result: await import("../../apps/web/app/api/internal/practice/results/route"),
};
const callbackToken = "local-f5-callback-token-for-tests-only-20261001";
const command = promisify(execFile);
const outcomes: unknown[] = [];
let server: Server | undefined;
let browser: Browser | undefined;
let failHints = false;
let failTrace = false;
let failDrafts = false;
const workspacePath = process.cwd().replaceAll("'", "'\\''");
const hostCommand = `cd '${workspacePath}' && echo $$ > /tmp/algocove-host.pid && exec env DOCKER_HOST=unix:///var/run/docker.sock ALGO_COVE_LOCAL_EXECUTION=1 LOCAL_EXECUTION_STATE_DIR=/tmp/algocove-f5-host LOCAL_EXECUTION_IMAGES_FILE=/tmp/algocove-images.json LOCAL_RESULT_CALLBACK_URL=http://host.lima.internal:3301/api/internal/practice/results LOCAL_RESULT_CALLBACK_TOKEN=local-f5-callback-token-for-tests-only-20261001 /tmp/node-v22.22.0-linux-arm64/bin/node services/execution-host/src/cli.ts`;

const nativeHost = process.env.LOCAL_PHASE5_NATIVE_HOST === "1";
const nativeDirectory = process.env.LOCAL_EXECUTION_STATE_DIR;
const nativeImages = process.env.LOCAL_EXECUTION_IMAGES_FILE;
let hostProcess: ChildProcess | undefined;
async function killHost(): Promise<void> {
  if (nativeHost) {
    if (hostProcess?.pid && hostProcess.exitCode === null && hostProcess.signalCode === null) {
      const closed = new Promise<void>((resolve) => hostProcess!.once("exit", () => resolve()));
      hostProcess.kill("SIGKILL");
      await closed;
    }
    hostProcess = undefined;
  } else
    await command("limactl", [
      "shell",
      "algocove-gvisor",
      "bash",
      "-lc",
      "kill -KILL $(cat /tmp/algocove-host.pid)",
    ]);
}
async function restartHost(images?: "missing" | "reviewed") {
  if (nativeHost) {
    if (!nativeDirectory || !nativeImages)
      throw Error("Native host requires owned state and image paths");
    await killHost();
    if (images === "missing") {
      writeFileSync(`${nativeImages}.reviewed`, readFileSync(nativeImages));
      const mapping = JSON.parse(readFileSync(nativeImages, "utf8")) as Record<string, string>;
      for (const language of Object.keys(mapping)) mapping[language] = `sha256:${"0".repeat(64)}`;
      writeFileSync(nativeImages, JSON.stringify(mapping));
    }
    if (images === "reviewed")
      writeFileSync(nativeImages, readFileSync(`${nativeImages}.reviewed`));
    hostProcess = spawn(process.execPath, ["services/execution-host/src/cli.ts"], {
      env: {
        PATH: process.env.PATH,
        NODE_ENV: "test",
        ALGO_COVE_LOCAL_EXECUTION: "1",
        LOCAL_EXECUTION_STATE_DIR: nativeDirectory,
        LOCAL_EXECUTION_IMAGES_FILE: nativeImages,
        LOCAL_RESULT_CALLBACK_URL: "http://127.0.0.1:3301/api/internal/practice/results",
        LOCAL_RESULT_CALLBACK_TOKEN: callbackToken,
      },
      stdio: "inherit",
    });
  } else {
    await command("limactl", [
      "shell",
      "algocove-gvisor",
      "bash",
      "-lc",
      "kill -KILL $(cat /tmp/algocove-host.pid)",
    ]);
    if (images === "missing")
      await command("limactl", [
        "shell",
        "algocove-gvisor",
        "bash",
        "-lc",
        `cp /tmp/algocove-images.json /tmp/algocove-images-reviewed.json; /tmp/node-v22.22.0-linux-arm64/bin/node -e 'const fs=require("fs");const m=JSON.parse(fs.readFileSync("/tmp/algocove-images.json"));for(const k of Object.keys(m))m[k]="sha256:"+"0".repeat(64);fs.writeFileSync("/tmp/algocove-images.json",JSON.stringify(m));'`,
      ]);
    if (images === "reviewed")
      await command("limactl", [
        "shell",
        "algocove-gvisor",
        "bash",
        "-lc",
        "cp /tmp/algocove-images-reviewed.json /tmp/algocove-images.json",
      ]);
    const child = spawn(
      "limactl",
      ["shell", "algocove-gvisor", "sg", "docker", "-c", hostCommand],
      {
        stdio: "ignore",
      },
    );
    child.unref();
  }
  await browserExpect
    .poll(
      async () => {
        try {
          return (
            await fetch("http://127.0.0.1:3302/v1/runs/prepare", { method: "POST", body: "{}" })
          ).status;
        } catch {
          return 0;
        }
      },
      { timeout: 15000 },
    )
    .toBe(401);
}

async function freshLearner(): Promise<void> {
  const learner = formatId("learner", randomBytes(20).toString("hex")),
    session = formatId("session", randomBytes(20).toString("hex"));
  if (!learner.ok || !session.ok) throw Error("Invalid fixture identity");
  await fixture.runtime!.pool.query("INSERT INTO platform.learner(learner_id) VALUES($1)", [
    learner.value,
  ]);
  fixture.actor = createActor({
    userId: learner.value,
    sessionId: session.value,
    roles: ["learner"],
  });
}

async function execute(
  page: Page,
  language: ProblemLanguage,
  source: string,
  mode: "run" | "submit",
  label: string,
) {
  await page.locator(".ac-workspace__editor").fill(source);
  const receiptPromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/practice/runs") && response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: mode === "run" ? "Run checks" : "Submit attempt", exact: true })
    .click();
  const receipt = await receiptPromise;
  expect(receipt.status()).toBe(202);
  const body = (await receipt.json()) as { runId: string };
  const outcome: {
    readonly runId: string;
    readonly language: ProblemLanguage;
    readonly mode: "run" | "submit";
    terminalCategory: string | null;
    classification: string | null;
  } = {
    runId: body.runId,
    language,
    mode,
    terminalCategory: null,
    classification: null,
  };
  outcomes.push(outcome);
  try {
    await browserExpect
      .poll(
        async () =>
          (
            await fixture.runtime!.practice.getRunById(
              body.runId as Parameters<PostgresPracticeRepository["getRunById"]>[0],
            )
          )?.terminalCategory,
        { timeout: 60000 },
      )
      .not.toBeNull();
  } catch (error) {
    const incomplete = await fixture.runtime!.practice.getRunById(
      body.runId as Parameters<PostgresPracticeRepository["getRunById"]>[0],
    );
    outcome.terminalCategory = incomplete?.terminalCategory ?? null;
    outcome.classification = incomplete?.classification ?? null;
    throw new Error(
      "Execution run " +
        body.runId +
        " did not reach a terminal result within the Docker command and callback budget.",
      { cause: error },
    );
  }
  await browserExpect(page.getByText(`Execution complete · ${label}`, { exact: true })).toBeVisible(
    { timeout: 25000 },
  );
  const record = await fixture.runtime!.practice.getRunById(
    body.runId as Parameters<PostgresPracticeRepository["getRunById"]>[0],
  );
  outcome.terminalCategory = record?.terminalCategory ?? null;
  outcome.classification = record?.classification ?? null;
  return record!;
}

describe.skipIf(process.env.LOCAL_PHASE5_E2E !== "1")(
  "real local guided loop with fixture authentication",
  () => {
    beforeAll(async () => {
      if (nativeHost) await restartHost();
      const connectionFile = nativeHost
        ? `${nativeDirectory}/connection.local.json`
        : ".tmp/f5/connection.local.json";
      const connection = JSON.parse(readFileSync(connectionFile, "utf8")) as {
        relayUrl: string;
        relayToken: string;
        verificationKeys: string;
      };
      if (!nativeHost && existsSync(".env")) process.loadEnvFile(".env");
      vi.stubEnv("EXECUTION_RESULT_CALLBACK_TOKEN", callbackToken);
      vi.stubEnv("EXECUTION_VERIFICATION_KEYS_JSON", connection.verificationKeys);
      const learner = formatId("learner", randomBytes(20).toString("hex"));
      const session = formatId("session", randomBytes(20).toString("hex"));
      if (!learner.ok || !session.ok) throw new Error("Invalid fixture actor");
      fixture.actor = createActor({
        userId: learner.value,
        sessionId: session.value,
        roles: ["learner"],
      });
      const pool = createPool({
        connectionString: process.env.DATABASE_URL!,
        applicationName: "algocove-f5-local-test",
        maxConnections: 4,
        statementTimeoutMs: 5000,
      });
      await pool.query("INSERT INTO platform.learner (learner_id) VALUES ($1)", [learner.value]);
      fixture.runtime = {
        pool,
        practice: new PostgresPracticeRepository(pool),
        drafts: new PostgresDraftRepository(pool),
        hints: new PostgresHintRepository(pool),
        pseudocode: new PostgresPseudocodeRepository(pool),
        executionRelay: createHttpExecutionRelay({
          baseUrl: connection.relayUrl,
          token: connection.relayToken,
        }),
      };
      server = createServer(async (incoming, outgoing) => {
        try {
          const chunks: Buffer[] = [];
          let bytes = 0;
          for await (const chunk of incoming) {
            bytes += chunk.length;
            if (bytes > 6400000) throw new Error("Request too large");
            chunks.push(chunk);
          }
          const headers = new Headers();
          for (const [name, value] of Object.entries(incoming.headers))
            if (typeof value === "string") headers.set(name, value);
          const method = incoming.method ?? "GET",
            path = incoming.url ?? "/";
          const request = new Request(`http://127.0.0.1:3301${path}`, {
            method,
            headers,
            ...(method === "GET" ? {} : { body: Buffer.concat(chunks) }),
          });
          let response: Response;
          if (path === "/api/auth/session")
            response = Response.json({ authenticated: true, user: { id: fixture.actor!.userId } });
          else if (path === "/api/mastery/explanation")
            response = await routes.explanation.POST(request);
          else if (path.startsWith("/api/practice/problems/") && request.method === "GET")
            response = await routes.publishedProblem.GET(request, {
              params: Promise.resolve({
                problemId: decodeURIComponent(path.slice("/api/practice/problems/".length)),
              }),
            });
          else if (path === "/api/practice/workspace")
            response = await routes.workspace.POST(request);
          else if (path === "/api/practice/runs") response = await routes.run.POST(request);
          else if (path === "/api/internal/practice/results")
            response = await routes.result.POST(request);
          else if (path === "/api/practice/trace")
            response = failTrace
              ? Response.json({}, { status: 503 })
              : await routes.trace.POST(request);
          else if (path === "/api/practice/hints")
            response = failHints
              ? Response.json({}, { status: 503 })
              : await routes.hint.POST(request);
          else if (path.startsWith("/api/practice/drafts/")) {
            const params = Promise.resolve({ draftId: path.split("/").at(-1)! });
            response = failDrafts
              ? Response.json({}, { status: 503 })
              : method === "PUT"
                ? await routes.draft.PUT(request, { params })
                : await routes.draft.GET(request, { params });
          } else if (path.startsWith("/api/practice/pseudocode/")) {
            const params = Promise.resolve({ pseudocodeId: path.split("/").at(-1)! });
            response = failDrafts
              ? Response.json({}, { status: 503 })
              : method === "PUT"
                ? await routes.pseudocode.PUT(request, { params })
                : await routes.pseudocode.GET(request, { params });
          } else if (path.endsWith("/cancel"))
            response = await routes.cancel.POST(request, {
              params: Promise.resolve({ runId: path.split("/").at(-2)! }),
            });
          else if (path.startsWith("/api/practice/runs/"))
            response = await routes.status.GET(request, {
              params: Promise.resolve({ runId: path.split("/").at(-1)! }),
            });
          else response = Response.json({}, { status: 404 });
          outgoing.writeHead(response.status, Object.fromEntries(response.headers));
          outgoing.end(Buffer.from(await response.arrayBuffer()));
        } catch {
          outgoing.writeHead(500);
          outgoing.end();
        }
      });
      await new Promise<void>((resolve) => server!.listen(3301, "127.0.0.1", resolve));
      browser = await chromium.launch();
    }, 60000);

    afterAll(async () => {
      await browser?.close();
      if (nativeHost) await killHost();
      await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
      if (fixture.runtime && fixture.actor) {
        if (!nativeHost)
          await fixture.runtime.pool.query("DELETE FROM platform.learner WHERE learner_id=$1", [
            fixture.actor.userId,
          ]);
        await fixture.runtime.pool.end();
      }
      vi.unstubAllEnvs();
      writeFileSync(
        process.env.LOCAL_PHASE5_REPORT_FILE ?? ".tmp/f5/browser-report.local.json",
        JSON.stringify(
          {
            date: new Date().toISOString(),
            authentication:
              "fixture actor only; real application routes, PostgreSQL, gVisor and signed callback",
            outcomes,
          },
          null,
          2,
        ),
      );
    });

    it("completes reasoning, trace, hints, Run/Submit and submitted-state resume in all six languages", async () => {
      for (const language of PROBLEM_LANGUAGES) {
        if (nativeHost) await freshLearner();
        const page = await browser!.newPage();
        await page.route("**/api/**", async (route) => {
          const response = await route.fetch({
            url: route.request().url().replace("127.0.0.1:3300", "127.0.0.1:3301"),
          });
          await route.fulfill({ response });
        });
        let bootstrap = page.waitForResponse(
          (r) => r.url().endsWith("/api/practice/workspace") && r.request().method() === "POST",
        );
        await page.goto("http://127.0.0.1:3300/learn/arrays-two-pointer");
        await bootstrap;
        if (language !== "python") {
          bootstrap = page.waitForResponse(
            (r) =>
              r.url().endsWith("/api/practice/workspace") &&
              r.request().postDataJSON().language === language,
          );
          await page
            .getByRole("combobox", { name: "Implementation language" })
            .selectOption(language);
        }
        const workspace = await (await bootstrap).json();
        expect((await bootstrap).status()).toBe(200);
        await browserExpect(page.locator(".ac-workspace__editor")).toHaveValue(
          workspace.sourceDraft.currentRevision === 0
            ? workspace.starterTemplate
            : workspace.sourceDraft.currentText,
        );
        if (language === "python") {
          failDrafts = true;
          await page
            .getByRole("textbox", { name: "Inputs", exact: true })
            .fill("unsynced recovery");
          await browserExpect(
            page.getByText("Private recovery · Local recovery saved · server sync pending", {
              exact: true,
            }),
          ).toBeVisible();
          failDrafts = false;
        }
        for (const name of [
          "Inputs",
          "State",
          "Initialization",
          "Invariant",
          "Loop",
          "Termination",
          "Output",
          "Complexity",
        ])
          await page
            .getByRole("textbox", { name, exact: true })
            .fill(`${name}: bounded two-pointer reasoning`);
        await page
          .getByRole("combobox", { name: "Area checkpoint" })
          .selectOption("minimum_times_width");
        await page.getByRole("combobox", { name: "Boundary checkpoint" }).selectOption("taller");
        await page
          .getByRole("button", { name: "Save and check reasoning revision", exact: true })
          .click();
        await browserExpect(page.getByText(/Revision \d+ saved\./)).toBeVisible();
        const pendingReadiness = page.waitForResponse(
          (r) => r.url().includes("/api/practice/pseudocode/") && r.request().method() === "GET",
        );
        await page.getByRole("button", { name: "Check reasoning readiness", exact: true }).click();
        expect((await (await pendingReadiness).json()).readiness).toMatchObject({
          status: "not_ready",
          missing: expect.arrayContaining(["structured_checks", "verified_runs"]),
        });
        await page.getByRole("combobox", { name: "Boundary checkpoint" }).selectOption("shorter");
        await page
          .getByRole("button", { name: "Save and check reasoning revision", exact: true })
          .click();
        await browserExpect(page.getByText(/Revision \d+ saved\./)).toBeVisible();
        await page.getByRole("button", { name: "Next step", exact: true }).click();
        await browserExpect(page.getByText(/Step 1 of/)).toBeVisible();
        if (language === "python") {
          failHints = true;
          await page.getByRole("button", { name: "Request clarification hint" }).click();
          await browserExpect(page.getByText(/Hint request is pending\./)).toBeVisible();
          failHints = false;
          for (let tier = 1; tier <= 5; tier++) {
            await page
              .getByRole("button", {
                name: tier === 1 ? "Request clarification hint" : `Request authored hint ${tier}`,
                exact: true,
              })
              .click();
            await browserExpect
              .poll(async () =>
                fixture.runtime!.hints.getHighestExposedTier({
                  learnerId: fixture.actor!.userId,
                  problemVersionId: "prb_dddddddddddddddd" as never,
                }),
              )
              .toBe(tier);
          }
        }
        await page
          .getByRole("combobox", { name: "Predict the next boundary" })
          .selectOption("left");
        await page.getByRole("button", { name: "Record trace prediction" }).click();
        await page.getByRole("button", { name: "Complete trace", exact: true }).click();
        await browserExpect(page.getByRole("list", { name: "Trace transcript" })).toContainText(
          "left",
        );
        await page.getByText("Edit your bounded trace", { exact: true }).click();
        await page
          .getByRole("textbox", { name: "Learner trace JSON" })
          .fill('{"events":[{"kind":"invented"}]}');
        await page.getByRole("button", { name: "Apply trace edit" }).click();
        await browserExpect(page.getByText(/Trace edit rejected:/)).toBeVisible();
        if (language === "python") {
          failTrace = true;
          await page.getByRole("button", { name: "Reveal reviewed trace" }).click();
          await browserExpect(page.getByText(/Reviewed trace is unavailable\./)).toBeVisible();
          await browserExpect(
            page.getByText("Reviewed reference trace · assistance recorded", { exact: true }),
          ).toHaveCount(0);
          failTrace = false;
        }
        await page.getByRole("button", { name: "Reveal reviewed trace" }).click();
        await browserExpect(
          page.getByText("Reviewed reference trace · assistance recorded", { exact: true }),
        ).toBeVisible();
        expect(
          await fixture.runtime!.hints.getExposureByIdempotency({
            learnerId: fixture.actor!.userId,
            idempotencyKey: `reference-trace-${workspace.attempt.attemptId}`,
          }),
        ).toMatchObject({ tier: 4 });
        await execute(page, language, wrongContainerSource[language], "run", "Wrong answer");
        await execute(
          page,
          language,
          "???",
          "run",
          language === "typescript" ? "Type error" : "Compile error",
        );
        await execute(page, language, timeoutContainerSource[language], "run", "Resource limit");
        await execute(page, language, correctContainerSource[language], "run", "Passed");
        const submission = await execute(
          page,
          language,
          correctContainerSource[language],
          "submit",
          "Passed",
        );
        const before = submission.attemptId;
        await page.reload();
        if (language !== "python")
          await page
            .getByRole("combobox", { name: "Implementation language" })
            .selectOption(language);
        await browserExpect(
          page.getByText("Execution complete · Passed", { exact: true }),
        ).toBeVisible();
        await browserExpect(
          page.getByRole("button", { name: "Submit attempt", exact: true }),
        ).toBeDisabled();
        const resumed = await fixture.runtime!.practice.findActiveAttempt({
          learnerId: fixture.actor!.userId,
          problemVersionId: submission.problemVersionId,
          manifestId: submission.manifestId,
          language,
          includeSubmitted: true,
        });
        expect(resumed?.attemptId).toBe(before);
        const readyResponse = page.waitForResponse(
          (r) => r.url().includes("/api/practice/pseudocode/") && r.request().method() === "GET",
        );
        await page.getByRole("button", { name: "Check reasoning readiness", exact: true }).click();
        const readyBody = await (await readyResponse).json();
        expect(readyBody.readiness, JSON.stringify(readyBody.readiness)).toMatchObject({
          status: "ready",
        });
        await browserExpect(
          page.getByText(
            "Reasoning checkpoint ready: authored checks and a verified passing submission. Free-form reasoning remains advisory.",
            {
              exact: true,
            },
          ),
        ).toBeVisible();
        outcomes.push({
          language,
          resumeSameAttempt: true,
          reasoningRevision: true,
          trace: true,
          tracePrediction: true,
          invalidTraceRejected: true,
          referenceAssistancePersisted: true,
          authoredChecks: true,
          readiness: true,
        });
        if (language === "python") {
          const edited = `${correctContainerSource.python}\n# draft edited after verified submission`;
          await page.locator(".ac-workspace__editor").fill(edited);
          await browserExpect(
            page.getByText("Execution complete · Previous source · Passed", { exact: true }),
          ).toBeVisible();
          await browserExpect
            .poll(
              async () =>
                (
                  await fixture.runtime!.drafts.findDraftByAttempt({
                    attemptId: before,
                    learnerId: fixture.actor!.userId,
                    kind: "source",
                  })
                )?.currentText,
            )
            .toBe(edited);
          await page.reload();
          await browserExpect(
            page.getByText("Execution complete · Previous source · Passed", { exact: true }),
          ).toBeVisible();
          outcomes.push({ editedSourceDoesNotInheritPass: true, reloadDoesNotInheritPass: true });
        }
        await page.close();
      }
    }, 240000);

    it("cancels real execution, recovers a killed host without credit, and rejects missing images in every language", async () => {
      if (nativeHost) await freshLearner();
      const page = await browser!.newPage();
      await page.route("**/api/**", async (route) => {
        const response = await route.fetch({
          url: route.request().url().replace("127.0.0.1:3300", "127.0.0.1:3301"),
        });
        await route.fulfill({ response });
      });
      // This scenario also works independently of the successful-submission scenario.
      const loaded = page.waitForResponse(
        (r) => r.url().endsWith("/api/practice/workspace") && r.request().method() === "POST",
      );
      await page.goto("http://127.0.0.1:3300/learn/arrays-two-pointer");
      if ((await (await loaded).json()).attempt.status === "submitted") {
        await page.getByRole("button", { name: "Start a new attempt", exact: true }).click();
      }
      await page.locator(".ac-workspace__editor").fill(timeoutContainerSource.python);
      await page.getByRole("button", { name: "Run checks", exact: true }).click();
      await page.getByRole("button", { name: "Cancel execution", exact: true }).click();
      await browserExpect(
        page.getByText("Execution complete · Cancelled", { exact: true }),
      ).toBeVisible({ timeout: 60000 });
      outcomes.push({ realCancellation: true });
      // Submit a bounded loop, kill the owning host while its sandbox exists, then restart.
      const pending = page.waitForResponse(
        (r) => r.url().endsWith("/api/practice/runs") && r.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Submit attempt", exact: true }).click();
      const runId = ((await (await pending).json()) as { runId: string }).runId;
      if (nativeHost) {
        await browserExpect
          .poll(
            async () =>
              (
                await command("docker", ["ps", "-q", "--filter", `name=algocove-local-${runId}`])
              ).stdout.trim(),
            { timeout: 10000, intervals: [10, 25, 50] },
          )
          .not.toBe("");
      } else {
        await command("limactl", [
          "shell",
          "algocove-gvisor",
          "bash",
          "-lc",
          `for i in $(seq 1 100); do sudo docker ps -q --filter name=algocove-local-${runId} | awk 'NF{found=1} END{exit !found}' && exit 0; sleep 0.01; done; exit 1`,
        ]);
      }
      await restartHost();
      await browserExpect(
        page.getByText("Execution complete · Infrastructure failure", { exact: true }),
      ).toBeVisible({ timeout: 20000 });
      const observation = await fixture.runtime!.pool.query(
        "SELECT passed,terminal_category FROM practice.assessment_observation WHERE run_id=$1",
        [runId],
      );
      expect(observation.rows).toMatchObject([
        { passed: false, terminal_category: "infrastructure_error" },
      ]);
      outcomes.push({ hostCrashReconciled: true, noCredit: true, noReplacement: true });
      await restartHost("missing");
      for (const language of PROBLEM_LANGUAGES) {
        if (nativeHost) {
          await freshLearner();
          await page.reload();
        }
        if (language !== "python")
          await page
            .getByRole("combobox", { name: "Implementation language" })
            .selectOption(language);
        if (!nativeHost) {
          await browserExpect(
            page.getByRole("button", { name: "Start a new attempt", exact: true }),
          ).toBeVisible();
          await page.getByRole("button", { name: "Start a new attempt", exact: true }).click();
        }
        await execute(
          page,
          language,
          correctContainerSource[language],
          "submit",
          "Infrastructure failure",
        );
      }
      await restartHost("reviewed");
      await page.close();
    }, 180000);
  },
);
