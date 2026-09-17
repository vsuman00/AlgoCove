import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = JSON.parse(
  readFileSync(path.join(root, "tests/sandbox-security/abuse-manifest.json"), "utf8"),
) as {
  schemaVersion: number;
  target: string;
  maxOutputBytes: number;
  maxDurationMs: number;
  fixtures: Array<{
    id: string;
    threat: string;
    terminalExpectation: string;
    maxDurationMs: number;
  }>;
};

describe("sandbox abuse fixture contract", () => {
  it("covers every bounded Task 24 threat with conservative limits", () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.target).toBe("algocove/execution-python:2026-09-17");
    expect(manifest.maxOutputBytes).toBeLessThanOrEqual(16_384);
    expect(manifest.maxDurationMs).toBeLessThanOrEqual(5_000);

    const threats = manifest.fixtures.map((fixture) => fixture.threat);
    expect(threats).toEqual([
      "escape",
      "egress",
      "metadata",
      "fork-thread-bomb",
      "memory-flood",
      "cpu-flood",
      "disk-flood",
      "output-flood",
      "path-traversal",
      "symlink",
      "residue",
      "signal",
      "cancellation",
      "teardown",
    ]);
    expect(new Set(manifest.fixtures.map((fixture) => fixture.id)).size).toBe(
      manifest.fixtures.length,
    );
    for (const fixture of manifest.fixtures) {
      expect(fixture.terminalExpectation.length).toBeGreaterThan(0);
      expect(fixture.maxDurationMs).toBeLessThanOrEqual(manifest.maxDurationMs);
    }
  });
});
