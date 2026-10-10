import { afterEach, describe, expect, it, vi } from "vitest";

const sha = "a".repeat(40);
const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdtemp: vi.fn(),
  rm: vi.fn(),
  spawnSync: vi.fn(),
}));
vi.mock("node:fs/promises", () => mocks);
vi.mock("node:child_process", () => ({ spawnSync: mocks.spawnSync }));
const initialArgs = [...process.argv];
const initialExitCode = process.exitCode;

afterEach(() => {
  process.argv = initialArgs;
  process.exitCode = initialExitCode;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

async function prepare() {
  vi.resetModules();
  process.argv = ["node", "deploy-preview.ts", "--sha", sha];
  process.exitCode = undefined;
  vi.stubEnv("VERCEL_TOKEN", "credential-canary-private");
  mocks.readFile.mockResolvedValue(JSON.stringify({ status: "release_ci_passed", commitSha: sha }));
  mocks.mkdtemp.mockResolvedValue("/private/release-fixture");
  mocks.writeFile.mockResolvedValue(undefined);
  mocks.rm.mockResolvedValue(undefined);
  return vi.spyOn(process.stderr, "write").mockReturnValue(true);
}

describe("Preview release safety", () => {
  it("cancels an unexpected production target before smoke or artifact admission", async () => {
    await prepare();
    const fetch = vi.spyOn(globalThis, "fetch");
    fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "dpl_fixture", target: "production" })),
    );
    fetch.mockResolvedValueOnce(new Response("{}"));
    await import("../../../ops/release/deploy-preview.ts");
    expect(process.exitCode).toBe(1);
    expect(String(fetch.mock.calls[1]?.[0])).toContain("/cancel?");
    expect(mocks.spawnSync).not.toHaveBeenCalled();
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

  it("rejects a mismatched source identity without accessing the application", async () => {
    await prepare();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "dpl_fixture",
          target: null,
          readyState: "READY",
          url: "algocove-fixture-vsuman00s-projects.vercel.app",
          meta: { githubCommitSha: "b".repeat(40) },
        }),
      ),
    );
    await import("../../../ops/release/deploy-preview.ts");
    expect(process.exitCode).toBe(1);
    expect(mocks.spawnSync).not.toHaveBeenCalled();
  });

  it("redacts provider rejection bodies and credentials", async () => {
    const stderr = await prepare();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("credential-canary-private", { status: 403 }),
    );
    await import("../../../ops/release/deploy-preview.ts");
    expect(stderr.mock.calls.flat().join(" ")).toBe('{"status":"preview_release_rejected"}\n');
    expect(process.exitCode).toBe(1);
  });
});
