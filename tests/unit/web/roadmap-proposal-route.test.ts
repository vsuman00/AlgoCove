import type * as Application from "@algocove/application";
import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  repository: vi.fn(),
  optional: vi.fn(),
  build: vi.fn(),
}));
vi.mock("../../../apps/web/src/auth/request-context", () => ({
  authenticatedWebRequestContext: mocks.auth,
  webTraceId: () => "req_aaaaaaaaaaaaaaaa",
}));
vi.mock("../../../apps/web/src/planning/runtime", () => ({
  getRoadmapRepository: mocks.repository,
}));
vi.mock("../../../apps/web/src/planning/proposal-runtime", () => ({
  getRoadmapOptional: mocks.optional,
}));
vi.mock("@algocove/application", async (original) => ({
  ...(await original<typeof Application>()),
  buildOwnedRoadmap: mocks.build,
}));
import { POST } from "../../../apps/web/app/api/planning/roadmap/route";
const body = {
  action: "build",
  scope: "reviewed_pilot",
  expectedToken: null,
  idempotencyKey: "route:proposal",
};
const request = (input: unknown) =>
  new Request("http://localhost/api/planning/roadmap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({});
  mocks.repository.mockReturnValue({});
  mocks.optional.mockResolvedValue(undefined);
  mocks.build.mockResolvedValue({ status: "valid", lineage: "baseline_ai_off" });
});
describe("Task45a opt-in planning HTTP boundary", () => {
  it("defaults AI off without constructing the optional gateway", async () => {
    const response = await POST(request(body));
    expect(response.status).toBe(200);
    expect(mocks.optional).not.toHaveBeenCalled();
    expect(mocks.build.mock.calls[0]![2]).toMatchObject({ useProposal: false });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("uses only server composed ports after explicit opt-in", async () => {
    const optional = { provider: {}, budget: {} };
    mocks.optional.mockResolvedValue(optional);
    expect((await POST(request({ ...body, useProposal: true }))).status).toBe(200);
    expect(mocks.optional).toHaveBeenCalledTimes(1);
    expect(mocks.build.mock.calls[0]![3]).toBe(optional);
  });
  it.each([
    { model: "PRIVATE_CANARY" },
    { provider: "PRIVATE_CANARY" },
    { useProposal: "true" },
    { response: "PRIVATE_CANARY" },
  ])("rejects browser configuration/candidate injection %j", async (patch) => {
    const response = await POST(request({ ...body, ...patch }));
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("PRIVATE_CANARY");
    expect(mocks.optional).not.toHaveBeenCalled();
    expect(mocks.build).not.toHaveBeenCalled();
  });
});
