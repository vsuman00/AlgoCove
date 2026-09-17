import { describe, expect, it } from "vitest";
import { judgeOutput, stableSha256 } from "../language-conformance/conformance-core.mjs";

describe("trusted language-conformance judge", () => {
  it("normalizes UTF-8 line endings and NFC labels without accepting extra output", () => {
    expect(judgeOutput("0,1|e\u0301\r\n", "0,1|é")).toMatchObject({
      category: "passed",
      diagnosticCode: null,
    });
    expect(judgeOutput("0,1|é\nextra", "0,1|é")).toMatchObject({
      category: "learner_failed",
      diagnosticCode: "wrong_answer",
    });
  });

  it("rejects a candidate verdict and an expected-value spoof", () => {
    expect(judgeOutput("PASS\n", "none|no-match")).toMatchObject({
      category: "learner_failed",
      diagnosticCode: "malformed_output",
    });
    expect(judgeOutput("0,1|no-match\n", "none|no-match")).toMatchObject({
      category: "learner_failed",
      diagnosticCode: "wrong_answer",
    });
  });

  it("produces stable checksums for manifest lineage", () => {
    expect(stableSha256({ fixtureId: "pair-sum-small", version: 1 })).toBe(
      "sha256:de79eda5929a5955e152258bb5c5934f03fc5819fd3a54c0ec17e4c6f8b47ea3",
    );
  });
});
