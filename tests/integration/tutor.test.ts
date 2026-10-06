import { spawn } from "node:child_process";
import { chromium, expect as browserExpect } from "@playwright/test";
import { parseTutorInput } from "@algocove/tutor";
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from "vitest";
import { PostgresTutorRepository } from "@algocove/db";
import { TutorService, fixtureGenerationPort, type GenerationPort } from "@algocove/tutor";
import type { TutorInput } from "@algocove/application";
import { createRetrievalFixture } from "./support/retrieval-fixture.ts";
let f: Awaited<ReturnType<typeof createRetrievalFixture>>,
  repo: PostgresTutorRepository,
  serial = 1;
const input = (override: Partial<TutorInput> = {}): TutorInput => ({
  attemptId: f.attempt,
  intent: "explain",
  query: "shorter boundary invariant",
  requestedTier: 1,
  shareCode: false,
  idempotencyKey: `tutor-fixture:${serial++}`,
  ...override,
});
function service(port: GenerationPort | null = fixtureGenerationPort, timeout = 100) {
  return new TutorService(
    repo,
    {
      retrieve: (ctx, i) =>
        f.repo.retrieve(
          ctx,
          {
            ...i,
            curriculumVersionId: "cur_aaaaaaaaaaaaaaaa",
            configurationVersion: f.config.version,
          },
          f.embedding(i.query),
        ),
      read: (ctx, id) => f.repo.read(ctx, id),
    },
    port,
    timeout,
  );
}
async function start(i = input()) {
  return repo.start(f.context(), i);
}
describe("Task44 transactional tutor delivery", () => {
  beforeAll(async () => {
    f = await createRetrievalFixture();
    repo = new PostgresTutorRepository(f.runtime);
  });
  afterAll(async () => {
    await f?.close();
  });
  beforeEach(async () => {
    await f.runtime.query(
      "DELETE FROM platform.optional_reservation WHERE operation='tutor_generation'",
    );
    await f.runtime.query(
      "DELETE FROM platform.operation_breaker WHERE operation='tutor_generation'",
    );
  });
  it("returns pending without text, persists validated response and assistance before returning, and replays the saved answer", async () => {
    const port = { ...fixtureGenerationPort, generate: vi.fn(fixtureGenerationPort.generate) };
    const raw = input(),
      pending = await start(raw);
    expect(pending).toMatchObject({ status: "pending", response: null });
    const answer = await service(port).complete(f.context(), pending.requestId);
    expect(answer.status).toBe("completed");
    expect(answer.response?.hintTier).toBe(1);
    const saved = (
      await f.runtime.query(
        "SELECT r.body,a.tier FROM tutor.response r JOIN tutor.assistance a USING(request_id) WHERE request_id=$1",
        [pending.requestId],
      )
    ).rows[0];
    expect(saved.body).toEqual(answer.response);
    expect(saved.tier).toBe(1);
    expect(
      (
        await f.runtime.query(
          "SELECT model_configuration FROM tutor.response WHERE request_id=$1",
          [pending.requestId],
        )
      ).rows[0].model_configuration,
    ).toEqual(port.configuration);
    expect(await repo.start(f.context(), raw)).toEqual(answer);
    expect(await service(port).complete(f.context(), pending.requestId)).toEqual(answer);
    expect(port.generate).toHaveBeenCalledTimes(1);
    expect(
      (await f.runtime.query("SELECT count(*)::integer AS n FROM practice.assessment_observation"))
        .rows[0].n,
    ).toBe(0);
    expect(
      (await f.runtime.query("SELECT count(*)::integer AS n FROM mastery.projection")).rows[0].n,
    ).toBe(0);
    expect(
      (
        await f.runtime.query(
          "SELECT finished_at,outcome FROM platform.optional_reservation WHERE reservation_key=$1",
          [pending.requestId],
        )
      ).rows[0],
    ).toMatchObject({ outcome: "success" });
    await expect(
      f.runtime.query("UPDATE tutor.response SET body=body WHERE request_id=$1", [
        pending.requestId,
      ]),
    ).rejects.toMatchObject({ code: "55006" });
    await expect(
      f.runtime.query("DELETE FROM tutor.assistance WHERE request_id=$1", [pending.requestId]),
    ).rejects.toMatchObject({ code: "55006" });
  });
  it.each(["malformed", "injected", "citation", "tier"])(
    "rejects %s candidate with authored fallback and never persists canary output",
    async (kind) => {
      const port = {
        ...fixtureGenerationPort,
        async generate(r: Parameters<GenerationPort["generate"]>[0], s: AbortSignal) {
          const good = (await fixtureGenerationPort.generate(r, s)) as object;
          return kind === "malformed"
            ? "REJECTED_PRIVATE_CANARY"
            : kind === "injected"
              ? { ...good, message: "REJECTED_PRIVATE_CANARY tool_calls execute command" }
              : kind === "citation"
                ? { ...good, message: "REJECTED_PRIVATE_CANARY", citations: [] }
                : { ...good, message: "LOCKED_SOLUTION_CANARY", hintTier: 6 };
        },
      };
      const pending = await start();
      const answer = await service(port).complete(f.context(), pending.requestId);
      expect(answer.status).toBe("fallback");
      expect(answer.response?.message).not.toContain("CANARY");
      expect(
        JSON.stringify(
          (
            await f.runtime.query("SELECT body FROM tutor.response WHERE request_id=$1", [
              pending.requestId,
            ])
          ).rows,
        ),
      ).not.toContain("CANARY");
    },
  );
  it("bounds an unresponsive provider and falls back without releasing raw text", async () => {
    const pending = await start();
    const port = { ...fixtureGenerationPort, generate: () => new Promise(() => {}) };
    expect((await service(port, 5).complete(f.context(), pending.requestId)).status).toBe(
      "fallback",
    );
  });
  it("keeps restricted tiers authored and denies solution review before submission", async () => {
    await expect(start(input({ intent: "hint", requestedTier: 6 }))).rejects.toMatchObject({
      category: "validation",
    });
    const port = { ...fixtureGenerationPort, generate: vi.fn(fixtureGenerationPort.generate) };
    const pending = await start(input({ intent: "hint", requestedTier: 2 }));
    const answer = await service(port).complete(f.context(), pending.requestId);
    expect(answer.response?.hintTier).toBe(2);
    expect(answer.response?.message).toBe(f.current.chunks[2]!.text);
    expect(port.generate).not.toHaveBeenCalled();
  });
  it("enforces ownership, key conflicts, invalid scope and revoked database grants", async () => {
    const raw = input(),
      pending = await start(raw);
    await expect(repo.read(f.context(f.other), pending.requestId)).rejects.toMatchObject({
      category: "not_found",
    });
    await expect(repo.cancel(f.context(f.other), pending.requestId)).rejects.toMatchObject({
      category: "not_found",
    });
    await expect(repo.start(f.context(), { ...raw, query: "changed" })).rejects.toMatchObject({
      category: "conflict",
    });
    await expect(repo.start(f.context(), { ...input(), shareCode: true })).rejects.toMatchObject({
      category: "validation",
    });
    await f.runtime.query(
      "UPDATE platform.role_grant SET revoked_at=clock_timestamp() WHERE learner_id=$1 AND role='learner'",
      [f.learner],
    );
    try {
      await expect(repo.read(f.context(), pending.requestId)).rejects.toMatchObject({
        category: "authorization",
      });
    } finally {
      await f.runtime.query(
        "UPDATE platform.role_grant SET revoked_at=NULL WHERE learner_id=$1 AND role='learner'",
        [f.learner],
      );
    }
  });
  it("fences concurrent completion and cancellation while the provider is running", async () => {
    let release: (v: unknown) => void = () => {},
      entered: () => void = () => {};
    const gate = new Promise<void>((r) => (entered = r));
    let response: unknown;
    const port = {
      ...fixtureGenerationPort,
      generate: vi.fn(async (r: Parameters<GenerationPort["generate"]>[0], s: AbortSignal) => {
        response = await fixtureGenerationPort.generate(r, s);
        entered();
        return new Promise((r) => (release = r));
      }),
    };
    const pending = await start();
    const running = service(port, 1000).complete(f.context(), pending.requestId);
    await gate;
    expect((await service(port).complete(f.context(), pending.requestId)).status).toBe("running");
    expect((await repo.cancel(f.context(), pending.requestId)).status).toBe("cancelled");
    release(response);
    expect((await running).status).toBe("cancelled");
    expect(port.generate).toHaveBeenCalledTimes(1);
    expect(
      (
        await f.runtime.query("SELECT 1 FROM tutor.response WHERE request_id=$1", [
          pending.requestId,
        ])
      ).rowCount,
    ).toBe(0);
  });
  it("refuses provider admission when the budget is exhausted", async () => {
    await f.runtime.query(
      "INSERT INTO platform.optional_reservation(learner_id,operation,reservation_key,digest,units,policy_version,created_at,finished_at,outcome) SELECT $1,'tutor_generation','spent-'||g,'fixture',20480,1,$2,$2,'success' FROM generate_series(1,20) g",
      [f.learner, f.now],
    );
    const port = { ...fixtureGenerationPort, generate: vi.fn(fixtureGenerationPort.generate) },
      pending = await start();
    expect(pending).toMatchObject({
      status: "fallback",
      reason: "budget_exhausted",
      response: null,
    });
    expect((await service(port).complete(f.context(), pending.requestId)).status).toBe("fallback");
    expect(port.generate).not.toHaveBeenCalled();
  });
  it("expires an abandoned turn, settles its budget, and never duplicates provider work", async () => {
    const setup = f.pool(f.migrationUrl),
      pending = await start();
    await setup.query("ALTER TABLE tutor.request DISABLE TRIGGER tutor_request_guard");
    try {
      await setup.query(
        "UPDATE tutor.request SET created_at=clock_timestamp()-interval '20 seconds',expires_at=clock_timestamp()-interval '1 second' WHERE request_id=$1",
        [pending.requestId],
      );
    } finally {
      await setup.query("ALTER TABLE tutor.request ENABLE TRIGGER tutor_request_guard");
      await setup.end();
    }
    const port = { ...fixtureGenerationPort, generate: vi.fn(fixtureGenerationPort.generate) };
    const recovered = await start();
    expect(recovered.status).toBe("pending");
    await repo.cancel(f.context(), recovered.requestId);
    expect((await service(port).complete(f.context(), pending.requestId)).reason).toBe("expired");
    expect(port.generate).not.toHaveBeenCalled();
  });
  it("sends only explicit debug code, rejects a restrictive provider policy, and captures assistance conservatively", async () => {
    const manifest = (
      await f.runtime.query("SELECT manifest_id FROM practice.attempt WHERE attempt_id=$1", [
        f.attempt,
      ])
    ).rows[0].manifest_id;
    await f.runtime.query(
      "INSERT INTO practice.draft(draft_id,attempt_id,learner_id,problem_version_id,manifest_id,language,kind,current_text,current_revision,saved_revision,version,updated_at,expires_at,local_recovery_enabled) VALUES($1,$2,$3,$4,$5,'python','source','PRIVATE_CODE_CANARY',1,1,1,$6,clock_timestamp()+interval '1 day',false)",
      [f.ids.generate("draft"), f.attempt, f.learner, f.current.problemVersionId, manifest, f.now],
    );
    const port = { ...fixtureGenerationPort, generate: vi.fn(fixtureGenerationPort.generate) };
    const plain = await start();
    await service(port).complete(f.context(), plain.requestId);
    expect(port.generate.mock.calls[0]?.[0]).not.toHaveProperty("privateCode");
    const debug = await start(input({ intent: "debug", shareCode: true }));
    expect((await service(port).complete(f.context(), debug.requestId)).status).toBe("completed");
    expect(port.generate.mock.calls[1]?.[0].privateCode).toBe("PRIVATE_CODE_CANARY");
    await f.runtime.query(
      "UPDATE practice.draft SET current_revision=2,saved_revision=2,current_text='CHANGED_PRIVATE_CANARY' WHERE attempt_id=$1 AND kind='source'",
      [f.attempt],
    );
    await expect(repo.read(f.context(), debug.requestId)).rejects.toMatchObject({
      category: "conflict",
    });
    const restrictive = {
      ...port,
      configuration: { ...port.configuration, allowPrivateCode: false },
    };
    const refused = await start(input({ intent: "debug", shareCode: true }));
    expect((await service(restrictive).complete(f.context(), refused.requestId)).status).toBe(
      "fallback",
    );
    expect(port.generate).toHaveBeenCalledTimes(2);
  });
  it("rolls back response and assistance atomically when persistence fails", async () => {
    const setup = f.pool(f.migrationUrl),
      pending = await start();
    await setup.query(
      "CREATE FUNCTION tutor.fail_assistance_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure' USING ERRCODE='23514'; END $$",
    );
    await setup.query(
      "CREATE TRIGGER fail_assistance_fixture BEFORE INSERT ON tutor.assistance FOR EACH ROW EXECUTE FUNCTION tutor.fail_assistance_fixture()",
    );
    try {
      await expect(service().complete(f.context(), pending.requestId)).rejects.toMatchObject({
        code: "23514",
      });
      expect(
        (
          await f.runtime.query("SELECT 1 FROM tutor.response WHERE request_id=$1", [
            pending.requestId,
          ])
        ).rowCount,
      ).toBe(0);
      expect((await repo.read(f.context(), pending.requestId)).status).toBe("running");
    } finally {
      await setup.query("DROP TRIGGER fail_assistance_fixture ON tutor.assistance");
      await setup.query("DROP FUNCTION tutor.fail_assistance_fixture()");
      await setup.end();
      await repo.cancel(f.context(), pending.requestId);
    }
  });
  it("browser network receives only pending/cancelled/fallback or persisted validated answers", async () => {
    const server = spawn(
      "pnpm",
      [
        "--filter",
        "@algocove/web",
        "exec",
        "next",
        "dev",
        "--hostname",
        "127.0.0.1",
        "--port",
        "3197",
      ],
      {
        env: {
          ...process.env,
          ALGOCOVE_TEST_DIST_DIR: ".next/integration-tutor",
          DATABASE_URL: "",
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
          CLERK_SECRET_KEY: "",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    server.stdout.on("data", () => undefined);
    server.stderr.on("data", () => undefined);
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    try {
      browser = await chromium.launch();
      let ready = false;
      for (let n = 0; n < 100 && !ready; n++) {
        ready = await fetch("http://127.0.0.1:3197/api/health")
          .then((r) => r.ok)
          .catch(() => false);
        if (!ready) await new Promise((r) => setTimeout(r, 100));
      }
      expect(ready).toBe(true);
      const page = await browser.newPage();
      await page.route("**/api/auth/session", (r) =>
        r.fulfill({ json: { authenticated: true, user: { id: f.learner, roles: ["learner"] } } }),
      );
      await page.route("**/api/practice/problems/*", (r) =>
        r.fulfill({
          json: {
            problem: {
              title: "Original pilot",
              statement: "Original published container statement.",
            },
          },
        }),
      );
      await page.route("**/api/practice/workspace", (r) =>
        r.fulfill({
          json: {
            attempt: { attemptId: f.attempt },
            firstHintId: "pilot-hint-1",
            starterTemplate: "source",
            sourceDraft: {
              draftId: "drf_aaaaaaaaaaaaaaaa",
              version: 1,
              currentRevision: 1,
              currentText: "private saved code",
            },
            pseudocode: { pseudocodeId: "psc_aaaaaaaaaaaaaaaa", version: 1, current: {} },
          },
        }),
      );
      let mode: "reject" | "slow" | "valid" = "reject",
        release: (value: unknown) => void = () => {},
        entered: () => void = () => {};
      let calls = 0,
        buffered: unknown;
      const port = {
        ...fixtureGenerationPort,
        async generate(r: Parameters<GenerationPort["generate"]>[0], s: AbortSignal) {
          calls++;
          buffered = await fixtureGenerationPort.generate(r, s);
          if (mode === "reject")
            return {
              ...(buffered as object),
              message: "LOCKED_SOLUTION_REJECTED_CANARY",
              hintTier: 6,
            };
          if (mode === "slow") {
            entered();
            return new Promise((r) => (release = r));
          }
          return buffered;
        },
      };
      const payloads: string[] = [];
      await page.route("**/api/tutor", async (r) => {
        const body = r.request().postDataJSON();
        const result =
          body.action === "start"
            ? await repo.start(f.context(), parseTutorInput(body.input))
            : body.action === "cancel"
              ? await repo.cancel(f.context(), body.requestId)
              : await service(port, 2000).complete(f.context(), body.requestId);
        payloads.push(JSON.stringify(result));
        await r.fulfill({ json: result });
      });
      await page.goto("http://127.0.0.1:3197/learn/arrays-two-pointer");
      await page.getByLabel("Question", { exact: true }).fill("shorter boundary invariant");
      await page.getByRole("button", { name: "Ask tutor", exact: true }).click();
      await browserExpect(
        page.getByText("Authored fallback or unavailable guidance.", { exact: true }),
      ).toBeVisible();
      expect(payloads[0]).toContain("pending");
      expect(payloads.join("")).not.toContain("CANARY");
      expect(await page.locator("body").innerText()).not.toContain("LOCKED_SOLUTION");
      mode = "slow";
      const gate = new Promise<void>((r) => (entered = r));
      await page.getByRole("button", { name: "Ask tutor", exact: true }).click();
      await gate;
      await browserExpect(
        page.getByText("Pending — waiting for validated guidance.", { exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Cancel tutor request" }).click();
      await browserExpect(page.getByText("Request cancelled.", { exact: true })).toBeVisible();
      release(buffered);
      mode = "valid";
      await page.getByRole("button", { name: "Ask tutor", exact: true }).click();
      await browserExpect(
        page.getByText("Validated guidance saved.", { exact: true }),
      ).toBeVisible();
      const before = calls;
      await page.getByRole("button", { name: "Retry saved request" }).click();
      await browserExpect(
        page.getByText("Validated guidance saved.", { exact: true }),
      ).toBeVisible();
      expect(calls).toBe(before);
      expect(payloads.join("")).not.toContain("CANARY");
      expect(
        (
          await f.runtime.query(
            "SELECT count(*)::integer AS n FROM tutor.response r JOIN tutor.assistance a USING(request_id)",
          )
        ).rows[0].n,
      ).toBeGreaterThan(1);
    } finally {
      await browser?.close();
      server.kill("SIGTERM");
      await new Promise<void>((done) => {
        if (server.exitCode !== null) done();
        else server.once("exit", () => done());
      });
    }
  }, 60000);
  it("serves tier-six solution review only as authored content after submission", async () => {
    await f.runtime.query(
      "INSERT INTO practice.hint_exposure(exposure_id,learner_id,attempt_id,problem_version_id,hint_id,tier,idempotency_key,exposed_at) VALUES($1,$2,$3,$4,'pilot-hint-5',5,'tutor-review-exposure',$5)",
      [f.ids.generate("event"), f.learner, f.attempt, f.current.problemVersionId, f.now],
    );
    await f.runtime.query(
      "UPDATE practice.attempt SET status='submitted',terminal_reason='submitted',ended_at=$2 WHERE attempt_id=$1",
      [f.attempt, f.now],
    );
    const port = { ...fixtureGenerationPort, generate: vi.fn(fixtureGenerationPort.generate) },
      pending = await start(input({ intent: "hint", requestedTier: 6 }));
    const answer = await service(port).complete(f.context(), pending.requestId);
    expect(answer.response?.message).toBe(f.current.chunks[6]!.text);
    expect(answer.response?.hintTier).toBe(6);
    expect(port.generate).not.toHaveBeenCalled();
  });
  it("rejects a buffered answer after current source withdrawal and returns no candidate text", async () => {
    const pending = await start();
    const first = f.current.contentVersionId;
    const port = {
      ...fixtureGenerationPort,
      async generate(r: Parameters<GenerationPort["generate"]>[0], s: AbortSignal) {
        const answer = await fixtureGenerationPort.generate(r, s);
        await f.runtime.query(
          "UPDATE content.content_version SET status='retired',retired_at=$2,retirement_reason='rights_withdrawn',payload_status='tombstoned' WHERE content_version_id=$1",
          [first, f.now],
        );
        return answer;
      },
    };
    await expect(service(port).complete(f.context(), pending.requestId)).rejects.toMatchObject({
      category: "not_found",
    });
    expect(
      (
        await f.runtime.query("SELECT 1 FROM tutor.response WHERE request_id=$1", [
          pending.requestId,
        ])
      ).rowCount,
    ).toBe(0);
  });
});
