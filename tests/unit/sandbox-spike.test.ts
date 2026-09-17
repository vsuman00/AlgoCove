import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const spike = readFileSync(path.join(root, "spikes/execution-sandbox/run-spike.mjs"), "utf8");

describe("sandbox-selection spike runtime contract", () => {
  it("requires an explicitly selected Docker runtime for candidate evidence", () => {
    expect(spike).toContain("ALGO_COVE_DOCKER_RUNTIME");
    expect(spike).toContain("--runtime=${requestedRuntime}");
    expect(spike).toContain("Requested Docker runtime");
    expect(spike).toContain("security-owner approval is still required");
    expect(spike).toContain("if (!normalPassed || !hostilePassed || !concurrencyPassed)");
  });
});
