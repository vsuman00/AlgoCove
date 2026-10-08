import { afterEach, expect, it, vi } from "vitest";
const runtime = vi.hoisted(() => ({ getPracticeRuntime: vi.fn() }));
vi.mock("../../../apps/web/src/practice/runtime", () => runtime);
const { GET } = await import("../../../apps/web/app/api/learning/problems/route");
afterEach(() => vi.resetAllMocks());
const call = (query = "") => GET(new Request(`http://localhost/api/learning/problems${query}`));
it("serves bounded public catalog summaries with no private cache", async () => {
  const pool = {
    query: vi.fn().mockResolvedValue({
      rows: [
        {
          problem_id: "pro_1111111111111111",
          problem_version_id: "prb_1111111111111111",
          content_version_id: "cnt_1111111111111111",
          checksum: `sha256:${"1".repeat(64)}`,
          slug: "matching-readings",
          title: "Matching readings",
          pattern: "arrays-hashing",
          languages: ["python", "javascript", "typescript", "java", "cpp", "c"],
          author_payload: { solution: "private" },
        },
      ],
    }),
  };
  runtime.getPracticeRuntime.mockReturnValue({ pool });
  const response = await call("?limit=1&search=Matching&language=python");
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const data = await response.json();
  expect(data.items).toHaveLength(1);
  expect(JSON.stringify(data)).not.toMatch(/author_payload|solution|private/);
  expect(pool.query.mock.calls[0]?.[1]).toEqual([null, "Matching", null, "python", 2]);
});
it("rejects duplicate, unknown and prototype filter names", async () => {
  const pool = { query: vi.fn() };
  runtime.getPracticeRuntime.mockReturnValue({ pool });
  for (const query of [
    "?limit=1&limit=2",
    "?limit=51",
    "?language=ruby",
    "?__proto__=hidden",
    "?solutions=true",
  ]) {
    expect((await call(query)).status).toBe(400);
  }
  expect(pool.query).not.toHaveBeenCalled();
});
it("reports empty catalogs and outages without fabricated entries", async () => {
  runtime.getPracticeRuntime.mockReturnValue({
    pool: { query: vi.fn().mockResolvedValue({ rows: [] }) },
  });
  expect(await (await call()).json()).toEqual({ items: [], nextAfter: null });
  runtime.getPracticeRuntime.mockReturnValue(null);
  expect((await call()).status).toBe(503);
});
