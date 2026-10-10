export type AbuseOutcome = {
  ready: boolean;
  exitCode: number | null;
  timedOut: boolean;
  overflow: boolean;
  residue: boolean;
  output: string;
};

/** A bootstrap failure is never evidence that learner abuse was bounded. */
export function abuseOutcomePassed(expectation: string, outcome: AbuseOutcome): boolean {
  if (!outcome.ready || outcome.residue) return false;
  if (expectation === "safe_probe")
    return outcome.exitCode === 0 && !outcome.timedOut && !outcome.overflow;
  if (expectation === "bounded_limit")
    return (
      !outcome.timedOut &&
      !outcome.overflow &&
      (outcome.exitCode === 137 ||
        (outcome.exitCode === 0 && outcome.output.includes("MEMORY_LIMIT=ENFORCED")))
    );
  return expectation === "control_plane" && (outcome.timedOut || outcome.overflow);
}
