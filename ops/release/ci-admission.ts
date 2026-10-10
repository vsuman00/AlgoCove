export const REQUIRED_CI_JOBS = [
  "Quality gates",
  "Execution contract and sandbox gates",
  "Stronger runtime sandbox spike",
] as const;

export type CiRun = {
  readonly headSha: string;
  readonly status: string;
  readonly conclusion: string;
  readonly jobs: readonly {
    readonly name: string;
    readonly status: string;
    readonly conclusion: string;
  }[];
};

/** A skipped, cancelled, pending, stale or partially successful run cannot release. */
export function admitCiRevision(sha: string, run: CiRun): void {
  if (
    !/^[a-f0-9]{40}$/.test(sha) ||
    run.headSha !== sha ||
    run.status !== "completed" ||
    run.conclusion !== "success"
  )
    throw new Error("release_ci_revision_rejected");
  for (const name of REQUIRED_CI_JOBS) {
    const jobs = run.jobs.filter((job) => job.name === name);
    if (jobs.length !== 1 || jobs[0]?.status !== "completed" || jobs[0]?.conclusion !== "success")
      throw new Error("release_ci_job_rejected");
  }
}
