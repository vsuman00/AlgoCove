import { afterEach, expect, it, vi } from "vitest";
import { dependencyUnavailableError } from "@algocove/application";
import { learningError } from "../../../apps/web/src/mastery/learning-http";

afterEach(() => vi.restoreAllMocks());

it("emits only safe runtime error telemetry when companion requests contain private query/body data", async () => {
  const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  const privateMarker = "private_learner_source_and_reasoning";
  const request = new Request(
    `http://localhost/api/practice/external-companion?source=${privateMarker}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-trace-id": "req_aaaaaaaaaaaaaaaa" },
      body: JSON.stringify({ source: privateMarker, answers: { invariant: privateMarker } }),
    },
  );
  const response = learningError(request, dependencyUnavailableError(privateMarker));
  expect(response.status).toBe(503);
  expect(write).toHaveBeenCalledTimes(1);
  const line = String(write.mock.calls[0]?.[0]);
  const event = JSON.parse(line.slice("[api] ".length));
  expect(Object.keys(event).sort()).toEqual([
    "category",
    "code",
    "event",
    "retryable",
    "status",
    "traceId",
  ]);
  expect(event).toMatchObject({
    event: "request_failed",
    status: 503,
    traceId: "req_aaaaaaaaaaaaaaaa",
  });
  expect(line).not.toContain(privateMarker);
  expect(line).not.toContain("external-companion");
  expect(line).not.toContain("answers");
  expect(response.headers.get("cache-control")).toBe("no-store");
});
