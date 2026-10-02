import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => vi.fn());
const getLearningRuntime = vi.hoisted(() => vi.fn());
vi.mock("../../../apps/web/src/auth/clerk-server", () => ({ auth }));
vi.mock("../../../apps/web/src/mastery/learning-runtime", () => ({ getLearningRuntime }));
const review = await import("../../../apps/web/app/api/review/route");
const progress = await import("../../../apps/web/app/api/progress/route");
const home = await import("../../../apps/web/app/api/learner-home/route");
const explanation = await import("../../../apps/web/app/api/mastery/explanation/route");
const pause = await import("../../../apps/web/app/api/progress/pause/route");
const external = await import("../../../apps/web/app/api/progress/external/route");
const request = (path: string, body?: unknown) =>
  new Request(
    `http://localhost/api/${path}`,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_fixture");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_fixture");
});
afterEach(() => {
  auth.mockReset();
  getLearningRuntime.mockReset();
  vi.unstubAllEnvs();
});
describe("Phase 6 private routes", () => {
  it("authenticates all six endpoints before accessing persistence", async () => {
    auth.mockResolvedValue({ isAuthenticated: false, userId: null, sessionId: null });
    for (const call of [
      () => review.GET(request("review")),
      () => progress.GET(request("progress")),
      () => home.GET(request("learner-home")),
      () => review.POST(request("review", {})),
      () => explanation.POST(request("mastery/explanation", {})),
      () => pause.POST(request("progress/pause", {})),
      () => external.POST(request("progress/external", {})),
    ]) {
      const response = await call();
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
    expect(getLearningRuntime).not.toHaveBeenCalled();
  });
  it("derives review ownership from authentication and reports missing persistence", async () => {
    auth.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_phase6_test",
      sessionId: "session_phase6_test",
    });
    const listReviews = vi.fn().mockResolvedValue([]);
    getLearningRuntime.mockReturnValue({ reviews: { listReviews } });
    expect((await review.GET(request("review?learnerId=usr_bbbbbbbbbbbbbbbb"))).status).toBe(200);
    expect(listReviews.mock.calls[0]?.[0].learnerId).toMatch(/^usr_/);
    expect(listReviews.mock.calls[0]?.[0].learnerId).not.toBe("usr_bbbbbbbbbbbbbbbb");
    getLearningRuntime.mockReturnValue(null);
    expect((await progress.GET(request("progress"))).status).toBe(503);
  });
  it("returns a durable pending receipt when immediate projection delivery fails", async () => {
    auth.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_phase6_test",
      sessionId: "session_phase6_test",
    });
    const answerReview = vi.fn().mockResolvedValue({
      observationId: "evt_aaaaaaaaaaaaaaaa",
      sourceEventId: "evt_bbbbbbbbbbbbbbbb",
      correct: true,
      disposition: "committed",
    });
    getLearningRuntime.mockReturnValue({
      reviews: { answerReview },
      ingestion: {
        practice: {
          loadAssessment: vi.fn().mockRejectedValue(new Error("projection unavailable")),
        },
      },
    });
    const response = await review.POST(
      request("review", {
        action: "answer",
        reviewId: "evt_cccccccccccccccc",
        exerciseId: "review-v1",
        answers: { one: "a" },
        confidence: null,
        learnerId: "usr_bbbbbbbbbbbbbbbb",
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "projection_pending", correct: true });
    expect(answerReview.mock.calls[0]?.[0].learnerId).not.toBe("usr_bbbbbbbbbbbbbbbb");
  });
  it("rejects malformed source identifiers, confidence, dates and journal commands", async () => {
    auth.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_phase6_test",
      sessionId: "session_phase6_test",
    });
    getLearningRuntime.mockReturnValue({ reviews: {}, progress: {} });
    for (const response of [
      await review.POST(
        new Request("http://localhost/api/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{",
        }),
      ),
      await explanation.POST(
        request("mastery/explanation", { pseudocodeId: "invalid", revision: 1 }),
      ),
      await review.POST(
        request("review", {
          reviewId: "evt_aaaaaaaaaaaaaaaa",
          action: "answer",
          exerciseId: "x",
          answers: {},
          confidence: "certain",
        }),
      ),
      await pause.POST(request("progress/pause", { startDay: "2026-10-02", endDay: "2026-10-03" })),
      await external.POST(
        request("progress/external", {
          referenceId: "ref_aaaaaaaaaaaaaaaa",
          kind: "completed",
          idempotencyKey: "bad",
        }),
      ),
    ])
      expect(response.status).toBe(400);
  });
});
