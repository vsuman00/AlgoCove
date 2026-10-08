import { learningError } from "../../../apps/web/src/mastery/learning-http";
import { afterEach, expect, it, vi } from "vitest";
const runtime = vi.hoisted(() => ({ getPracticeRuntime: vi.fn() }));
vi.mock("../../../apps/web/src/practice/runtime", () => runtime);
const { GET } = await import("../../../apps/web/app/api/practice/problems/[problemId]/route");
afterEach(() => vi.resetAllMocks());
const request = () => new Request("http://localhost/api/practice/problems/arrays-two-pointer");
const params = (problemId = "arrays-two-pointer") => ({ params: Promise.resolve({ problemId }) });

const catalogPool = () => ({
  query: vi.fn().mockResolvedValue({
    rows: [
      {
        problem_id: "pro_dddddddddddddddd",
        problem_version_id: "prb_dddddddddddddddd",
        content_version_id: "cnt_dddddddddddddddd",
        checksum: `sha256:${"d".repeat(64)}`,
        slug: "arrays-two-pointer",
        title: "Reviewed title",
        pattern: null,
        languages: ["python", "javascript", "typescript", "java", "cpp", "c"],
      },
    ],
  }),
});

it("returns only currently published public payloads without requiring a learner session", async () => {
  runtime.getPracticeRuntime.mockReturnValue({
    pool: catalogPool(),
    practice: {
      getPublishedProblem: vi
        .fn()
        .mockResolvedValue({ title: "Reviewed title", statement: "Current published statement" }),
    },
  });
  const response = await GET(request(), params());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toMatchObject({
    problem: { title: "Reviewed title", statement: "Current published statement" },
  });
});

it("withholds retired payloads and rejects unknown or prototype-derived paths", async () => {
  runtime.getPracticeRuntime.mockReturnValue({
    pool: catalogPool(),
    practice: { getPublishedProblem: vi.fn().mockResolvedValue(null) },
  });
  expect((await GET(request(), params())).status).toBe(404);
  runtime.getPracticeRuntime.mockClear();
  for (const slug of ["constructor", "toString", "__proto__"])
    expect((await GET(request(), params(slug))).status).toBe(404);
  expect(runtime.getPracticeRuntime).not.toHaveBeenCalled();
  const pool = catalogPool();
  pool.query.mockResolvedValue({ rows: [] });
  runtime.getPracticeRuntime.mockReturnValue({ pool });
  expect((await GET(request(), params("unknown"))).status).toBe(404);
  expect(pool.query).toHaveBeenCalledOnce();
});

it("reports persistence outages honestly and does not replace them with authored sample text", async () => {
  runtime.getPracticeRuntime.mockReturnValue(null);
  expect((await GET(request(), params())).status).toBe(503);
  runtime.getPracticeRuntime.mockReturnValue({
    pool: catalogPool(),
    practice: {
      getPublishedProblem: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error("private database details"), { code: "ECONNREFUSED" }),
        ),
    },
  });
  const response = await GET(request(), params());
  expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain("private database details");
});

it("correlates a safe server log with its error response without logging raw driver data", async () => {
  const output = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  try {
    const response = learningError(
      request(),
      Object.assign(new Error("postgres://private:password@internal/db"), { code: "ECONNREFUSED" }),
    );
    const body = await response.json();
    const line = String(output.mock.calls[0]?.[0]);
    expect(line).toContain(body.error.traceId);
    expect(line).toContain('"status":503');
    expect(line).not.toMatch(/private|password|internal\/db/);
  } finally {
    output.mockRestore();
  }
});
