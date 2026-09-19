import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatId, type Instant, type Result } from "@algocove/domain";
import { sha256Digest } from "@algocove/execution-contracts";

const authMock = vi.hoisted(() => vi.fn());
const runtimeMock = vi.hoisted(() => ({ getPracticeRuntime: vi.fn() }));
vi.mock("../../../apps/web/src/auth/clerk-server", () => ({ auth: authMock }));
vi.mock("../../../apps/web/src/practice/runtime", () => runtimeMock);

const { POST: startDraft } = await import("../../../apps/web/app/api/practice/drafts/route");
const { GET: getDraft, PUT: updateDraft } =
  await import("../../../apps/web/app/api/practice/drafts/[draftId]/route");
const { POST: startWorkspace } = await import("../../../apps/web/app/api/practice/workspace/route");
const { POST: requestHint } = await import("../../../apps/web/app/api/practice/hints/route");
const { POST: requestRun } = await import("../../../apps/web/app/api/practice/runs/route");
const { GET: getRunStatus } = await import("../../../apps/web/app/api/practice/runs/[runId]/route");
const { POST: cancelRun } =
  await import("../../../apps/web/app/api/practice/runs/[runId]/cancel/route");
const { POST: ingestExecutionResult } =
  await import("../../../apps/web/app/api/internal/practice/results/route");

function must<T>(result: Result<T, unknown>): T {
  if (!result.ok) throw new Error("practice route fixtures are invalid");
  return result.value;
}

const learner = must(formatId("learner", "aaaaaaaaaaaaaaaa"));
const session = must(formatId("session", "ffffffffffffffff"));
const attempt = must(formatId("attempt", "bbbbbbbbbbbbbbbb"));
const draft = must(formatId("draft", "cccccccccccccccc"));
const problem = must(formatId("problemVersion", "dddddddddddddddd"));
const manifest = must(formatId("languageManifest", "eeeeeeeeeeeeeeee"));
const codeRun = must(formatId("codeRun", "cccccccccccccccc"));

const startedAt = "2026-09-18T10:00:00.000Z" as Instant;
const updatedAt = "2026-09-18T00:00:00.000Z" as Instant;
const expiresAt = "2026-09-25T10:00:00.000Z" as Instant;

const activeAttempt = {
  attemptId: attempt,
  sessionId: session,
  learnerId: learner,
  problemVersionId: problem,
  manifestId: manifest,
  language: "python" as const,
  mode: "learn" as const,
  status: "active" as const,
  terminalReason: null,
  resetFromAttemptId: null,
  version: 1,
  eventSequence: 1,
  startedAt,
  updatedAt,
  endedAt: null,
};

function repository() {
  const currentDraft = {
    draftId: draft,
    attemptId: attempt,
    learnerId: learner,
    problemVersionId: problem,
    manifestId: manifest,
    language: "python" as const,
    kind: "source" as const,
    currentText: "starter",
    currentRevision: 0,
    savedRevision: 0,
    version: 1,
    updatedAt,
    expiresAt,
    localRecoveryEnabled: true,
  };
  return {
    getAttempt: vi.fn().mockResolvedValue(activeAttempt),
    createDraft: vi.fn().mockImplementation(async (value) => value),
    getDraft: vi.fn().mockResolvedValue(currentDraft),
    replaceCurrentDraft: vi.fn().mockImplementation(async ({ draft: value }) => value),
    saveDraftRevision: vi.fn().mockImplementation(async ({ draft: value }) => value),
  };
}

afterEach(() => {
  authMock.mockReset();
  runtimeMock.getPracticeRuntime.mockReset();
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_fixture");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_fixture");
});

describe("authenticated practice draft routes", () => {
  it("fails closed for signed-out draft creation", async () => {
    authMock.mockResolvedValue({ isAuthenticated: false, userId: null, sessionId: null });

    const response = await startDraft(
      new Request("http://localhost/api/practice/drafts", {
        method: "POST",
        body: JSON.stringify({
          draftId: draft,
          attemptId: attempt,
          kind: "source",
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(runtimeMock.getPracticeRuntime).not.toHaveBeenCalled();
  });

  it("starts an owner-scoped source draft and replaces its current snapshot", async () => {
    authMock.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_practice_routes",
      sessionId: "sess_practice_routes",
    });
    const drafts = repository();
    runtimeMock.getPracticeRuntime.mockReturnValue({ drafts });

    const createdResponse = await startDraft(
      new Request("http://localhost/api/practice/drafts", {
        method: "POST",
        body: JSON.stringify({
          draftId: draft,
          attemptId: attempt,
          kind: "source",
          localRecoveryEnabled: true,
        }),
      }),
    );
    expect(createdResponse.status).toBe(201);
    await expect(createdResponse.json()).resolves.toMatchObject({
      draft: { draftId: draft, kind: "source", currentText: "" },
    });
    expect(drafts.createDraft).toHaveBeenCalledOnce();

    const updatedResponse = await updateDraft(
      new Request(`http://localhost/api/practice/drafts/${draft}`, {
        method: "PUT",
        body: JSON.stringify({ expectedVersion: 1, text: "durable source" }),
      }),
      { params: Promise.resolve({ draftId: draft }) },
    );
    expect(updatedResponse.status).toBe(200);
    await expect(updatedResponse.json()).resolves.toMatchObject({
      state: "saved_current",
      draft: { currentText: "durable source", version: 2 },
    });
  });

  it("does not expose an unavailable draft to an owner that cannot load it", async () => {
    authMock.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_other_practice_routes",
      sessionId: "sess_other_practice_routes",
    });
    const drafts = repository();
    drafts.getDraft.mockResolvedValue(null);
    runtimeMock.getPracticeRuntime.mockReturnValue({ drafts });

    const response = await getDraft(new Request(`http://localhost/api/practice/drafts/${draft}`), {
      params: Promise.resolve({ draftId: draft }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "not_found" } });
  });

  it("reports unavailable practice persistence without fabricating workspace state", async () => {
    authMock.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_workspace_routes",
      sessionId: "sess_workspace_routes",
    });
    runtimeMock.getPracticeRuntime.mockReturnValue(null);

    const response = await startWorkspace(
      new Request("http://localhost/api/practice/workspace", {
        method: "POST",
        body: JSON.stringify({ problemId: "arrays-two-pointer", language: "python" }),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "dependency_unavailable", retryable: true },
    });
  });

  it("recovers workspace bootstrap races through the unique active keys", async () => {
    authMock.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_workspace_race",
      sessionId: "sess_workspace_race",
    });
    const raceSession = { ...activeAttempt, sessionId: session };
    const raceAttempt = { ...activeAttempt };
    let sessionLookup = 0;
    let attemptLookup = 0;
    let sourceLookup = 0;
    let pseudocodeLookup = 0;
    const runtime = {
      pool: {
        query: vi.fn().mockResolvedValue({
          rows: [{ manifest_id: "man_eeeeeeeeeeeeeeee", starter_template: "starter" }],
        }),
      },
      practice: {
        findActiveSession: vi.fn().mockImplementation(async () => {
          sessionLookup += 1;
          return sessionLookup === 1 ? null : raceSession;
        }),
        createSession: vi.fn().mockRejectedValue({ code: "23505" }),
        getSession: vi.fn().mockResolvedValue(raceSession),
        findActiveAttempt: vi.fn().mockImplementation(async () => {
          attemptLookup += 1;
          return attemptLookup === 1 ? null : raceAttempt;
        }),
        createAttempt: vi.fn().mockRejectedValue({ code: "23505" }),
        getAttempt: vi.fn().mockResolvedValue(raceAttempt),
        getLatestRun: vi.fn().mockResolvedValue(null),
      },
      drafts: {
        findDraftByAttempt: vi.fn().mockImplementation(async () => {
          sourceLookup += 1;
          return sourceLookup === 1 ? null : { draftId: draft, currentText: "starter" };
        }),
        createDraft: vi.fn().mockRejectedValue({ code: "23505" }),
        getAttempt: vi.fn().mockResolvedValue(raceAttempt),
      },
      pseudocode: {
        findPseudocodeByAttempt: vi.fn().mockImplementation(async () => {
          pseudocodeLookup += 1;
          return pseudocodeLookup === 1 ? null : { pseudocodeId: "psc_race_fixture" };
        }),
        createPseudocode: vi.fn().mockRejectedValue({ code: "23505" }),
        getAttempt: vi.fn().mockResolvedValue(raceAttempt),
      },
    };
    runtimeMock.getPracticeRuntime.mockReturnValue(runtime);

    const response = await startWorkspace(
      new Request("http://localhost/api/practice/workspace", {
        method: "POST",
        body: JSON.stringify({ problemId: "arrays-two-pointer", language: "python" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      attempt: { attemptId: attempt },
      starterTemplate: "starter",
    });
    expect(runtime.practice.createSession).toHaveBeenCalledOnce();
    expect(runtime.practice.createAttempt).toHaveBeenCalledOnce();
    expect(runtime.drafts.createDraft).toHaveBeenCalledOnce();
    expect(runtime.pseudocode.createPseudocode).toHaveBeenCalledOnce();
  });

  it("does not hide a partially persisted terminal execution result", async () => {
    authMock.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_workspace_partial_result",
      sessionId: "sess_workspace_partial_result",
    });
    runtimeMock.getPracticeRuntime.mockReturnValue({
      pool: {
        query: vi.fn().mockResolvedValue({
          rows: [{ manifest_id: "man_eeeeeeeeeeeeeeee", starter_template: "starter" }],
        }),
      },
      practice: {
        findActiveSession: vi.fn().mockResolvedValue({ sessionId: session }),
        findActiveAttempt: vi.fn().mockResolvedValue(activeAttempt),
        getLatestRun: vi.fn().mockResolvedValue({
          runId: codeRun,
          mode: "run",
          terminalResultId: "result-partial",
          terminalCategory: null,
          classification: null,
          completedAt: null,
        }),
      },
      drafts: {
        findDraftByAttempt: vi.fn().mockResolvedValue({
          draftId: draft,
          currentText: "starter",
          currentRevision: 0,
          version: 1,
        }),
      },
      pseudocode: {
        findPseudocodeByAttempt: vi.fn().mockResolvedValue({
          pseudocodeId: "psc_partial_result",
          current: {},
          version: 1,
        }),
      },
    });

    const response = await startWorkspace(
      new Request("http://localhost/api/practice/workspace", {
        method: "POST",
        body: JSON.stringify({ problemId: "arrays-two-pointer", language: "python" }),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "dependency_unavailable", retryable: true },
    });
  });

  it("requires authentication before accepting a hint exposure request", async () => {
    authMock.mockResolvedValue({ isAuthenticated: false, userId: null, sessionId: null });

    const response = await requestHint(
      new Request("http://localhost/api/practice/hints", {
        method: "POST",
        body: JSON.stringify({
          attemptId: attempt,
          hintId: "hint-arrays-1",
          requestedTier: 1,
          idempotencyKey: "workspace-hint-test",
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(runtimeMock.getPracticeRuntime).not.toHaveBeenCalled();
  });

  it("fails closed when the isolated execution relay is not configured", async () => {
    authMock.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_execution_routes",
      sessionId: "sess_execution_routes",
    });
    runtimeMock.getPracticeRuntime.mockReturnValue({ executionRelay: null });

    const response = await requestRun(
      new Request("http://localhost/api/practice/runs", {
        method: "POST",
        body: JSON.stringify({ attemptId: attempt, mode: "run", source: "print('safe')" }),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "dependency_unavailable", retryable: true },
    });
  });

  it("returns owner-scoped queued and trusted terminal run status", async () => {
    authMock.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_execution_status",
      sessionId: "sess_execution_status",
    });
    const queuedRun = {
      runId: codeRun,
      learnerId: learner,
      attemptId: attempt,
      mode: "run" as const,
      problemVersionId: problem,
      manifestId: manifest,
      language: "python" as const,
      sourceChecksum: sha256Digest("status fixture"),
      sourceLength: 12,
      requestedAt: updatedAt,
      terminalResultId: null,
      terminalCategory: null,
      classification: null,
      completedAt: null,
    };
    const practice = {
      getRun: vi.fn().mockResolvedValue(queuedRun),
      getAttempt: vi.fn().mockResolvedValue(activeAttempt),
    };
    runtimeMock.getPracticeRuntime.mockReturnValue({ practice });

    const queuedResponse = await getRunStatus(
      new Request(`http://localhost/api/practice/runs/${codeRun}`),
      { params: Promise.resolve({ runId: codeRun }) },
    );
    expect(queuedResponse.status).toBe(200);
    await expect(queuedResponse.json()).resolves.toMatchObject({
      status: "queued",
      result: null,
    });

    practice.getRun.mockResolvedValue({
      ...queuedRun,
      terminalResultId: "result-status-1",
      terminalCategory: "infrastructure_error",
      classification: "infrastructure_failure",
      completedAt: updatedAt,
    });
    const completedResponse = await getRunStatus(
      new Request(`http://localhost/api/practice/runs/${codeRun}`),
      { params: Promise.resolve({ runId: codeRun }) },
    );
    expect(completedResponse.status).toBe(200);
    await expect(completedResponse.json()).resolves.toMatchObject({
      status: "completed",
      result: {
        resultId: "result-status-1",
        terminalCategory: "infrastructure_error",
        classification: "infrastructure_failure",
        passed: false,
      },
    });
  });

  it("cancels an owned run through the authenticated relay boundary", async () => {
    authMock.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_execution_cancel",
      sessionId: "sess_execution_cancel",
    });
    const cancel = vi.fn().mockResolvedValue(undefined);
    runtimeMock.getPracticeRuntime.mockReturnValue({
      practice: {
        getRun: vi.fn().mockResolvedValue({
          runId: codeRun,
          learnerId: learner,
          attemptId: attempt,
          mode: "run",
          problemVersionId: problem,
          manifestId: manifest,
          language: "python",
          sourceChecksum: sha256Digest("cancel fixture"),
          sourceLength: 14,
          requestedAt: updatedAt,
          terminalResultId: null,
          terminalCategory: null,
          classification: null,
          completedAt: null,
        }),
      },
      executionRelay: { cancel },
    });

    const response = await cancelRun(
      new Request(`http://localhost/api/practice/runs/${codeRun}/cancel`, { method: "POST" }),
      { params: Promise.resolve({ runId: codeRun }) },
    );
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      status: "cancellation_requested",
      runId: codeRun,
    });
    expect(cancel).toHaveBeenCalledWith({ runId: codeRun, reason: "learner" });
  });

  it("rejects an unauthenticated internal execution result callback", async () => {
    vi.stubEnv("EXECUTION_RESULT_CALLBACK_TOKEN", "callback-secret-2026");

    const response = await ingestExecutionResult(
      new Request("http://localhost/api/internal/practice/results", {
        method: "POST",
        headers: { Authorization: "Bearer wrong-callback-token" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(401);
    expect(runtimeMock.getPracticeRuntime).not.toHaveBeenCalled();
  });
});
