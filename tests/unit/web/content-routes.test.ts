import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const authMock = vi.hoisted(() => vi.fn());
const operations = vi.hoisted(() => ({ readContent: vi.fn(), commandContent: vi.fn() }));
vi.mock("../../../apps/web/src/auth/clerk-server", () => ({ auth: authMock }));
vi.mock("../../../apps/web/src/content/operations", () => operations);
const { GET, POST } = await import("../../../apps/web/app/api/admin/content/route");
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_fixture");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_fixture");
  authMock.mockResolvedValue({
    isAuthenticated: true,
    userId: "user_content_route",
    sessionId: "sess_content_route",
  });
  operations.readContent.mockReset();
  operations.commandContent.mockReset();
});
afterEach(() => vi.unstubAllEnvs());
describe("content HTTP boundary", () => {
  it("authenticates before reading content or consuming commands", async () => {
    authMock.mockResolvedValue({ isAuthenticated: false, userId: null, sessionId: null });
    expect((await GET(new Request("http://localhost/api/admin/content"))).status).toBe(401);
    expect(
      (
        await POST(
          new Request("http://localhost/api/admin/content", { method: "POST", body: "{}" }),
        )
      ).status,
    ).toBe(401);
    expect(operations.readContent).not.toHaveBeenCalled();
    expect(operations.commandContent).not.toHaveBeenCalled();
  });
  it("rejects oversized UTF-8 streams before dispatching a command", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < 5; i++) controller.enqueue(new TextEncoder().encode("α".repeat(20000)));
        controller.close();
      },
    });
    const request = new Request("http://localhost/api/admin/content", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(operations.commandContent).not.toHaveBeenCalled();
    expect(JSON.stringify(await response.json())).not.toContain("α");
  });
  it("rejects malformed JSON and arrays while deriving command identity from the session", async () => {
    for (const body of ["{", "[]"])
      expect(
        (await POST(new Request("http://localhost/api/admin/content", { method: "POST", body })))
          .status,
      ).toBe(400);
    operations.commandContent.mockResolvedValue({
      content: { contentVersionId: "cnt_aaaaaaaaaaaaaaaa" },
    });
    const response = await POST(
      new Request("http://localhost/api/admin/content", {
        method: "POST",
        body: JSON.stringify({ command: "create", actorId: "usr_forged" }),
      }),
    );
    expect(response.status).toBe(200);
    expect(operations.commandContent.mock.calls[0]![0].actor.userId).not.toBe("usr_forged");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
