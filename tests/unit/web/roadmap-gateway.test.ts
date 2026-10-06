import { describe, it, expect, vi } from "vitest";
import { createHttpRoadmapTransport } from "../../../apps/web/src/planning/proposal-gateway";
import type { RoadmapGenerationRequest } from "@algocove/tutor";
const request = {
  operation: "roadmap-proposal",
  modelConfigVersion: "synthetic.model.v1",
  items: [],
} as unknown as RoadmapGenerationRequest;
describe("Task45a HTTPS gateway boundary", () => {
  it("sends only a bounded request with server credentials and disallows redirects", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    const generate = createHttpRoadmapTransport({
      url: "https://approved.example/roadmap",
      token: "SERVER_SECRET",
      fetch: transport,
    });
    expect(await generate(request, new AbortController().signal)).toEqual({ items: [] });
    expect(transport.mock.calls[0]![1]).toMatchObject({
      method: "POST",
      redirect: "error",
      cache: "no-store",
      headers: { Authorization: "Bearer SERVER_SECRET" },
    });
    expect(transport.mock.calls[0]![1]!.body).toBe(JSON.stringify(request));
  });
  it.each([
    "http://unapproved.example/roadmap",
    "https://user:secret@approved.example/roadmap",
    "https://approved.example/roadmap?secret=x",
    "https://approved.example/roadmap#x",
  ])("rejects unsafe endpoint %s", (url) =>
    expect(() => createHttpRoadmapTransport({ url, token: "server" })).toThrow(),
  );
  it.each([
    new Response("PRIVATE_PROVIDER_CANARY", { status: 500 }),
    new Response("not-json"),
    new Response("x".repeat(12001)),
    new Response("😀".repeat(12001)),
  ])("redacts failed/malformed/oversized provider replies", async (response) => {
    const generate = createHttpRoadmapTransport({
      url: "https://approved.example/roadmap",
      token: "SERVER_SECRET",
      fetch: vi.fn<typeof fetch>().mockResolvedValue(response),
    });
    await expect(generate(request, new AbortController().signal)).rejects.toThrow(
      "Generation is unavailable.",
    );
  });
  it("redacts network exception messages", async () => {
    const generate = createHttpRoadmapTransport({
      url: "https://approved.example/roadmap",
      token: "SERVER_SECRET",
      fetch: vi.fn<typeof fetch>().mockRejectedValue(Error("PRIVATE_PROVIDER_CANARY")),
    });
    await expect(generate(request, new AbortController().signal)).rejects.toThrow(
      "Generation is unavailable.",
    );
  });
});
