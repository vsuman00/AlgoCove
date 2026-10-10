import { describe, expect, it } from "vitest";
import { abuseOutcomePassed, type AbuseOutcome } from "../../sandbox-security/outcome.ts";
const outcome = (): AbuseOutcome => ({
  ready: true,
  exitCode: 0,
  timedOut: false,
  overflow: false,
  residue: false,
  output: "SAFE",
});
describe("sandbox assurance distinguishes startup from execution", () => {
  it("admits completed probes after readiness", () =>
    expect(abuseOutcomePassed("safe_probe", outcome())).toBe(true));
  it.each(["safe_probe", "bounded_limit", "control_plane"])(
    "never admits an unstarted %s fixture",
    (expectation) => {
      expect(
        abuseOutcomePassed(expectation, {
          ...outcome(),
          ready: false,
          timedOut: true,
          overflow: true,
          exitCode: 137,
        }),
      ).toBe(false);
    },
  );
  it("requires actual execution deadline/output enforcement for control cases", () => {
    expect(abuseOutcomePassed("control_plane", outcome())).toBe(false);
    expect(
      abuseOutcomePassed("control_plane", { ...outcome(), timedOut: true, exitCode: null }),
    ).toBe(true);
  });
  it("rejects ordinary failures and escaped successful allocation as memory enforcement", () => {
    for (const exitCode of [1, 2, 125, 126, 127, null])
      expect(abuseOutcomePassed("bounded_limit", { ...outcome(), exitCode })).toBe(false);
    expect(abuseOutcomePassed("bounded_limit", { ...outcome(), exitCode: 137 })).toBe(true);
    expect(
      abuseOutcomePassed("bounded_limit", { ...outcome(), output: "MEMORY_LIMIT=ENFORCED" }),
    ).toBe(true);
  });
  it("rejects timeout/overflow of safe probes and any residue", () => {
    expect(abuseOutcomePassed("safe_probe", { ...outcome(), timedOut: true })).toBe(false);
    expect(abuseOutcomePassed("safe_probe", { ...outcome(), overflow: true })).toBe(false);
    expect(
      abuseOutcomePassed("control_plane", { ...outcome(), timedOut: true, residue: true }),
    ).toBe(false);
  });
});
