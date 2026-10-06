import { describe, it, expect, vi, beforeEach } from "vitest";
import { validationError } from "@algocove/application";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  runtime: vi.fn(),
  start: vi.fn(),
  read: vi.fn(),
  cancel: vi.fn(),
  complete: vi.fn(),
}));
vi.mock("../../../apps/web/src/auth/request-context", () => ({
  authenticatedWebRequestContext: mocks.auth,
  webTraceId: () => "req_aaaaaaaaaaaaaaaa",
}));
vi.mock("../../../apps/web/src/tutor/runtime", () => ({ getTutorRuntime: mocks.runtime }));
import { GET, POST } from "../../../apps/web/app/api/tutor/route";
const view = { requestId: "evt_aaaaaaaaaaaaaaaa", status: "pending", reason: null, response: null };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({});
  mocks.runtime.mockReturnValue({
    repository: { start: mocks.start, read: mocks.read, cancel: mocks.cancel },
    service: { complete: mocks.complete },
  });
  mocks.start.mockResolvedValue(view);
  mocks.read.mockResolvedValue(view);
  mocks.cancel.mockResolvedValue({ ...view, status: "cancelled" });
  mocks.complete.mockResolvedValue({ ...view, status: "fallback" });
});
const req = (body: unknown) =>
  new Request("http://localhost/api/tutor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
describe("private tutor HTTP delivery", () => {
  it("returns only pending state on admission and no cacheable answer", async () => {
    const response = await POST(
      req({
        action: "start",
        input: {
          attemptId: "att_aaaaaaaaaaaaaaaa",
          intent: "explain",
          query: "Clarify",
          requestedTier: 1,
          shareCode: false,
          idempotencyKey: "tutor:test",
        },
      }),
    );
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual(view);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.complete).not.toHaveBeenCalled();
  });
  it("serves persisted status, completes and cancels only an owned validated identifier", async () => {
    expect(
      (await GET(new Request("http://localhost/api/tutor?requestId=evt_aaaaaaaaaaaaaaaa"))).status,
    ).toBe(200);
    expect((await POST(req({ action: "complete", requestId: view.requestId }))).status).toBe(200);
    expect((await POST(req({ action: "cancel", requestId: view.requestId }))).status).toBe(200);
    expect(mocks.cancel).toHaveBeenCalledTimes(1);
  });
  it("rejects browser candidate injection and never reflects a private canary in errors", async () => {
    const response = await POST(
      req({ action: "complete", requestId: view.requestId, candidate: "REJECTED_PRIVATE_CANARY" }),
    );
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("CANARY");
    expect(mocks.complete).not.toHaveBeenCalled();
  });
  it("requires authentication and fails closed when persistence is absent", async () => {
    mocks.auth.mockRejectedValueOnce(validationError("Invalid request."));
    expect((await POST(req({}))).status).toBe(400);
    mocks.runtime.mockReturnValue(null);
    expect((await POST(req({}))).status).toBe(503);
  });
});
