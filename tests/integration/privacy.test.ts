import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import type { RequestContext } from "@algocove/application";
import { createActor, createRequestContext, createSystemClock } from "@algocove/application";
import { formatId } from "@algocove/domain";
import {
  bootstrapWorkerRole,
  createPool,
  PostgresIdentityRepository,
  PostgresPrivacyRepository,
  PostgresOperationalRepository,
  PostgresPrivacyOperationsRepository,
} from "@algocove/db";
import { processPrivacyDeletion } from "../../apps/worker/src/jobs/privacy.ts";
import { createIsolatedDatabase } from "../../ops/restore/isolated-database.ts";
const httpAuth = vi.hoisted(() => ({
  fresh: false,
  context: null as RequestContext | null,
  pool: null as Pool | null,
}));
vi.mock("../../apps/web/src/auth/clerk-config", () => ({ isClerkConfigured: () => true }));
vi.mock("../../apps/web/src/auth/clerk-server", () => ({
  auth: async () => ({
    isAuthenticated: true,
    userId: "user_phase11_http",
    has: () => httpAuth.fresh,
  }),
  reverificationErrorResponse: () =>
    Response.json({ error: "reauthentication_required" }, { status: 403 }),
}));
vi.mock("../../apps/web/src/auth/request-context", () => ({
  authenticatedWebRequestContext: async () => httpAuth.context,
  webTraceId: () => "req_12345678",
}));
vi.mock("../../apps/web/src/practice/runtime", () => ({
  getPracticeRuntime: () => ({ pool: httpAuth.pool }),
}));
import { GET as privacyStatus, POST as privacyCommand } from "../../apps/web/app/api/privacy/route";
let database: Awaited<ReturnType<typeof createIsolatedDatabase>>;
const ids = {
  generate: <T extends Parameters<typeof formatId>[0]>(kind: T) => {
    const id = formatId(kind, randomBytes(20).toString("hex"));
    if (!id.ok) throw Error("bad fixture");
    return id.value;
  },
};
const actor = createActor({
  userId: ids.generate("learner"),
  sessionId: ids.generate("session"),
  roles: ["learner"],
});
const other = ids.generate("learner");
const context = () =>
  createRequestContext({ actor, clock: createSystemClock(), ids, serviceName: "privacy-test" });
beforeAll(async () => {
  database = await createIsolatedDatabase(
    process.env.DATABASE_TEST_OPERATOR_URL ??
      "postgres://postgres:postgres@localhost:54329/postgres",
  );
  for (const learner of [actor.userId, other]) {
    await database.runtime.query("INSERT INTO platform.learner(learner_id) VALUES($1)", [learner]);
    await database.runtime.query(
      "INSERT INTO platform.role_grant(learner_id,role) VALUES($1,'learner')",
      [learner],
    );
    await database.runtime.query(
      "INSERT INTO platform.learner_profile(learner_id,goal,target_role,timezone,daily_capacity_minutes,horizon_days,preferred_languages,updated_by) VALUES($1,$2,'engineer','UTC',30,30,ARRAY['python'],$1)",
      [learner, learner === other ? "OTHER_PRIVATE_CANARY" : "OWN_PRIVATE_CANARY"],
    );
  }
});
afterAll(async () => {
  if (database) await database.cleanup();
});
describe("persistent privacy lifecycle", () => {
  it("exports only owned records and version context", async () => {
    const exported = JSON.stringify(
      await new PostgresPrivacyRepository(database.runtime).exportOwned(context()),
    );
    expect(exported).toContain("OWN_PRIVATE_CANARY");
    expect(exported).not.toContain("OTHER_PRIVATE_CANARY");
    expect(exported).toContain("versionPins");
  });
  it("marks pending atomically, fences writes and refuses runtime purge", async () => {
    const repo = new PostgresPrivacyRepository(database.runtime);
    const first = await repo.requestDeletion(context());
    expect(await repo.requestDeletion(context())).toEqual(first);
    expect(first.state).toBe("deletion_pending");
    await expect(
      database.runtime.query(
        "INSERT INTO platform.operation_breaker(learner_id,operation,failures) VALUES($1,'code_execution',1)",
        [actor.userId],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      database.runtime.query("SELECT platform.complete_privacy_deletion($1,'wrong')", [
        first.requestId,
      ]),
    ).rejects.toMatchObject({ code: "42501" });
    await database.runtime.query("select set_config('algocove.privacy_subject',$1,false)", [
      actor.userId,
    ]);
    expect(
      (await database.runtime.query("SELECT platform.privacy_purge_authorized() AS permitted"))
        .rows[0].permitted,
    ).toBe(false);
  });
  it("uses fenced leases, reconciles to zero, retains the other learner and blocks resurrection", async () => {
    const token = "privacy-test-lease-123456789";
    const job = (
      await database.owner.query("SELECT * FROM platform.claim_privacy_deletion($1)", [token])
    ).rows[0];
    await expect(
      database.owner.query("SELECT platform.complete_privacy_deletion($1,'stale-lease')", [
        job.request_id,
      ]),
    ).rejects.toThrow("stale");
    const result = (
      await database.owner.query("SELECT platform.complete_privacy_deletion($1,$2) AS result", [
        job.request_id,
        token,
      ])
    ).rows[0].result;
    expect(result).toEqual({ state: "completed", activePrivateReferences: 0 });
    expect(
      (
        await database.runtime.query(
          "SELECT goal FROM platform.learner_profile WHERE learner_id=$1",
          [other],
        )
      ).rows[0].goal,
    ).toBe("OTHER_PRIVATE_CANARY");
    await expect(
      database.runtime.query(
        "INSERT INTO platform.identity_account(provider,provider_subject,learner_id) VALUES('clerk','clerk:deleted-fixture',$1)",
        [actor.userId],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    expect(await new PostgresIdentityRepository(database.runtime).getRoles(actor.userId)).toEqual(
      [],
    );
  });
  it("respects holds, retries interrupted cancellation and grants no raw private data to the worker", async () => {
    const repo = new PostgresPrivacyRepository(database.runtime);
    const otherContext = { ...context(), actor: { ...actor, userId: other } };
    const pending = await repo.requestDeletion(otherContext);
    const run = ids.generate("codeRun");
    await database.owner.query(
      "INSERT INTO platform.privacy_cancellation(request_id,run_id) VALUES($1,$2)",
      [pending.requestId, run],
    );
    await database.owner.query(
      "INSERT INTO platform.privacy_hold(learner_id,reason_code,placed_at,expires_at) VALUES($1,'security',clock_timestamp(),clock_timestamp()+interval '1 hour')",
      [other],
    );
    expect(await processPrivacyDeletion(database.owner, null)).toEqual({ state: "idle" });
    await database.owner.query("DELETE FROM platform.privacy_hold WHERE learner_id=$1", [other]);
    await expect(processPrivacyDeletion(database.owner, null)).rejects.toThrow("cancellation");
    expect((await repo.status(otherContext)).deletionState).toBe("purging");
    await database.owner.query(
      "UPDATE platform.privacy_deletion SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE learner_id=$1",
      [other],
    );
    await expect(
      processPrivacyDeletion(
        database.owner,
        { cancel: async () => {} },
        {
          append: async () => {
            throw Error("ledger unavailable");
          },
        },
      ),
    ).rejects.toThrow("ledger unavailable");
    expect((await repo.status(otherContext)).state).toBe("deletion_pending");
    await database.owner.query(
      "UPDATE platform.privacy_deletion SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE learner_id=$1",
      [other],
    );
    const workerRole = `ac_priv_${process.pid}_${Date.now()}`,
      password = randomBytes(20).toString("hex");
    await bootstrapWorkerRole({
      operatorConnectionString: database.databaseUrl,
      name: workerRole,
      password,
      capability: "privacy",
    });
    const url = new URL(database.databaseUrl);
    url.username = workerRole;
    url.password = password;
    const worker = createPool({
      connectionString: url.toString(),
      applicationName: "privacy-worker-test",
      maxConnections: 1,
      statementTimeoutMs: 5000,
    });
    try {
      await expect(worker.query("SELECT current_text FROM practice.draft")).rejects.toMatchObject({
        code: "42501",
      });
      await expect(worker.query("SELECT payload FROM platform.outbox_event")).rejects.toMatchObject(
        { code: "42501" },
      );
      expect(await processPrivacyDeletion(worker, { cancel: async () => {} })).toEqual({
        state: "completed",
        activePrivateReferences: 0,
      });
    } finally {
      await worker.end();
      await database.inspection.query(`DROP OWNED BY "${workerRole}"`);
      await database.inspection.query(`DROP ROLE "${workerRole}"`);
    }
  });
  it("requires a current privacy-administrator grant and audits bounded hold/release", async () => {
    const identity = new PostgresIdentityRepository(database.runtime);
    const adminId = await identity.findOrCreateLearner("clerk:privacy_admin_fixture"),
      subject = await identity.findOrCreateLearner("clerk:held_subject_fixture");
    const adminContext = createRequestContext({
      actor: createActor({
        userId: adminId,
        sessionId: ids.generate("session"),
        roles: ["privacy_administrator"],
      }),
      clock: createSystemClock(),
      ids,
      serviceName: "privacy-hold",
    });
    const subjectContext = createRequestContext({
      clock: createSystemClock(),
      ids,
      serviceName: "privacy-hold-subject",
      actor: createActor({
        userId: subject,
        sessionId: ids.generate("session"),
        roles: ["learner"],
      }),
    });
    const repo = new PostgresPrivacyOperationsRepository(database.runtime);
    const command = {
      learnerId: subject,
      reason: "security",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };
    await expect(repo.hold(adminContext, command)).rejects.toMatchObject({
      category: "authorization",
    });
    await database.runtime.query(
      "INSERT INTO platform.role_grant(learner_id,role) VALUES($1,'privacy_administrator')",
      [adminId],
    );
    await expect(
      repo.hold(adminContext, {
        ...command,
        expiresAt: new Date(Date.now() + 91 * 86400000).toISOString(),
      }),
    ).rejects.toMatchObject({ category: "validation" });
    await repo.hold(adminContext, command);
    const pending = await new PostgresPrivacyRepository(database.runtime).requestDeletion(
      subjectContext,
    );
    expect(pending.deletionState).toBe("held");
    expect(await processPrivacyDeletion(database.owner, null)).toEqual({ state: "idle" });
    await repo.hold(adminContext, { ...command, release: true });
    expect(
      (
        await database.runtime.query(
          "SELECT 1 FROM platform.audit_event WHERE actor_id=$1 AND action IN ('privacy.hold_placed','privacy.hold_released')",
          [adminId],
        )
      ).rowCount,
    ).toBe(2);
    expect(await processPrivacyDeletion(database.owner, null)).toMatchObject({
      state: "completed",
      activePrivateReferences: 0,
    });
    expect(
      (await new PostgresPrivacyRepository(database.runtime).status(subjectContext)).requestId,
    ).toBe(pending.requestId);
  });
  it("persists only operational projections and purges expired telemetry", async () => {
    const repo = new PostgresOperationalRepository(database.runtime);
    const sample = {
      operation: "workspace",
      outcome: "success",
      durationMs: 42,
      traceId: "trace_12345678",
      requestId: "request_12345678",
      observedAt: new Date(Date.now() - 8 * 86400000).toISOString(),
    } as const;
    await repo.record({ ...sample, ...({ source: "PRIVATE_CANARY" } as object) });
    expect(
      JSON.stringify(
        (await database.runtime.query("SELECT * FROM platform.operational_sample")).rows,
      ),
    ).not.toContain("PRIVATE_CANARY");
    expect(
      (await database.owner.query("SELECT platform.apply_privacy_retention(100) AS result")).rows[0]
        .result.expiredTelemetry,
    ).toBe(1);
  });
});

describe("verified privacy HTTP boundary", () => {
  it("requires server verification, exports ownership, purges and returns the deleted receipt without recreating identity", async () => {
    const identity = new PostgresIdentityRepository(database.runtime);
    const learner = await identity.findOrCreateLearner("clerk:user_phase11_http");
    httpAuth.pool = database.runtime;
    httpAuth.context = createRequestContext({
      actor: createActor({
        userId: learner,
        sessionId: ids.generate("session"),
        roles: ["learner"],
      }),
      clock: createSystemClock(),
      ids,
      serviceName: "privacy-http",
    });
    const command = (body: object, origin = "http://localhost:3000") =>
      new Request("http://localhost:3000/api/privacy", {
        method: "POST",
        headers: { "Content-Type": "application/json", origin },
        body: JSON.stringify(body),
      });
    expect(
      (
        await privacyCommand(
          command({ action: "export", recentlyVerified: true, learnerId: other }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await database.runtime.query(
          "SELECT account_state FROM platform.learner WHERE learner_id=$1",
          [learner],
        )
      ).rows[0].account_state,
    ).toBe("active");
    httpAuth.fresh = true;
    expect(
      (await privacyCommand(command({ action: "export" }, "https://other.invalid"))).status,
    ).toBe(400);
    const exported = await privacyCommand(command({ action: "export", learnerId: other }));
    expect(exported.status).toBe(200);
    expect(exported.headers.get("Cache-Control")).toBe("no-store");
    expect(await exported.text()).not.toContain("OTHER_PRIVATE_CANARY");
    expect((await privacyCommand(command({ action: "delete", confirmation: "yes" }))).status).toBe(
      400,
    );
    const deleted = await privacyCommand(
      command({ action: "delete", confirmation: "DELETE MY DATA" }),
    );
    expect(deleted.status).toBe(200);
    const pending = await deleted.json();
    const token = "http-privacy-lease-12345678";
    const claimed = (
      await database.owner.query("SELECT * FROM platform.claim_privacy_deletion($1)", [token])
    ).rows[0];
    expect(claimed.request_id).toBe(pending.requestId);
    await database.owner.query("SELECT platform.complete_privacy_deletion($1,$2)", [
      pending.requestId,
      token,
    ]);
    const status = await privacyStatus(new Request("http://localhost:3000/api/privacy"));
    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({ state: "deleted", deletionState: "completed" });
    expect(
      (
        await database.runtime.query(
          "SELECT 1 FROM platform.identity_account WHERE learner_id=$1",
          [learner],
        )
      ).rowCount,
    ).toBe(0);
    await expect(identity.findOrCreateLearner("clerk:user_phase11_http")).rejects.toMatchObject({
      category: "authorization",
    });
  });
});
