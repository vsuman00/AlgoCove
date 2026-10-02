import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatId, projectMastery, type Result } from "@algocove/domain";
const auth = vi.hoisted(() => vi.fn());
const getMasteryRepository = vi.hoisted(() => vi.fn());
vi.mock("../../../apps/web/src/auth/clerk-server", () => ({ auth }));
vi.mock("../../../apps/web/src/mastery/runtime", () => ({ getMasteryRepository }));
const { GET } = await import("../../../apps/web/app/api/mastery/[conceptId]/route");
function must<T>(result: Result<T, unknown>): T {
  if (!result.ok) throw new Error("Invalid mastery route fixture");
  return result.value;
}
const conceptId = must(formatId("concept", "aaaaaaaaaaaaaaaa"));
const observationId = must(formatId("event", "bbbbbbbbbbbbbbbb"));
const params = { params: Promise.resolve({ conceptId }) };
const request = () =>
  new Request(
    `http://localhost/api/mastery/${conceptId}?afterObservation=${observationId}&learnerId=usr_bbbbbbbbbbbbbbbb`,
  );
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_fixture");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_fixture");
});
afterEach(() => {
  auth.mockReset();
  getMasteryRepository.mockReset();
  vi.unstubAllEnvs();
});
describe("authenticated mastery route", () => {
  it("requires authentication before reading the projection", async () => {
    auth.mockResolvedValue({ isAuthenticated: false, userId: null, sessionId: null });
    const response = await GET(request(), params);
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(getMasteryRepository).not.toHaveBeenCalled();
  });
  it("derives the owner from authentication and preserves pending and watermark information", async () => {
    auth.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_mastery_route",
      sessionId: "sess_mastery",
    });
    const readView = vi.fn().mockImplementation(async ({ learnerId }) => ({
      status: "projection_pending",
      projection: must(projectMastery({ learnerId, conceptId, evidence: [] })),
    }));
    getMasteryRepository.mockReturnValue({ readView });
    const response = await GET(request(), params);
    expect(response.status).toBe(200);
    expect(readView).toHaveBeenCalledWith({
      learnerId: expect.stringMatching(/^usr_/),
      conceptId,
      policyVersion: 1,
      afterObservationId: observationId,
    });
    expect(readView.mock.calls[0]?.[0].learnerId).not.toBe("usr_bbbbbbbbbbbbbbbb");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      status: "projection_pending",
      projection: { evidenceWatermark: "0", band: "unassessed" },
    });
  });
  it("does not expose another owner's observation and rejects invalid identifiers", async () => {
    auth.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_mastery_route",
      sessionId: "sess_mastery",
    });
    const readView = vi.fn().mockResolvedValue(null);
    getMasteryRepository.mockReturnValue({ readView });
    expect((await GET(request(), params)).status).toBe(404);
    const invalid = await GET(
      new Request(`http://localhost/api/mastery/${conceptId}?afterObservation=invalid`),
      params,
    );
    expect(invalid.status).toBe(400);
    expect(readView).toHaveBeenCalledOnce();
  });
});
