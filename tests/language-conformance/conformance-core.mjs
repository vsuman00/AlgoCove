import { createHash } from "node:crypto";

export function stableSha256(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

export function normalizeCandidateOutput(value) {
  const normalized = value.replaceAll("\r\n", "\n").normalize("NFC").trimEnd();
  return normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized;
}

export function judgeOutput(candidateOutput, expectedOutput) {
  const normalized = normalizeCandidateOutput(candidateOutput);
  return normalized === expectedOutput.normalize("NFC")
    ? { category: "passed", normalizedOutput: normalized, diagnosticCode: null }
    : {
        category: "learner_failed",
        normalizedOutput: normalized.slice(0, 512),
        diagnosticCode: normalized.includes("|") ? "wrong_answer" : "malformed_output",
      };
}

export function buildLineage({ manifest, fixture, language, imageDigest }) {
  return {
    problemVersionId: manifest.problemVersionId,
    manifestDigest: stableSha256(manifest),
    fixtureDigest: stableSha256(fixture),
    fixtureId: fixture.fixtureId,
    language,
    harnessVersion: manifest.harnessVersion,
    policyVersion: manifest.policyVersion,
    runtimeImageDigest: imageDigest,
  };
}
