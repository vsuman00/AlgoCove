export function stableSha256(value: unknown): string;
export function normalizeCandidateOutput(value: string): string;
export function judgeOutput(
  candidateOutput: string,
  expectedOutput: string,
): {
  category: "passed" | "learner_failed";
  normalizedOutput: string;
  diagnosticCode: string | null;
};
