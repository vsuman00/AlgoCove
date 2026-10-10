import { execFileSync } from "node:child_process";
import { admitCiRevision, REQUIRED_CI_JOBS, type CiRun } from "./ci-admission.ts";

try {
  const [option, sha, ...rest] = process.argv.slice(2);
  if (option !== "--sha" || !sha || !/^[a-f0-9]{40}$/.test(sha) || rest.length)
    throw Error("arguments");
  const repository = "vsuman00/AlgoCove";
  const runs = JSON.parse(
    execFileSync(
      "gh",
      [
        "run",
        "list",
        "--repo",
        repository,
        "--workflow",
        "ci.yml",
        "--commit",
        sha,
        "--limit",
        "100",
        "--json",
        "databaseId,headSha,status,conclusion",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ),
  ) as (CiRun & { databaseId: number })[];
  const latest = runs[0];
  if (!latest || !Number.isSafeInteger(latest.databaseId)) throw Error("missing_run");
  const run = JSON.parse(
    execFileSync(
      "gh",
      [
        "run",
        "view",
        String(latest.databaseId),
        "--repo",
        repository,
        "--json",
        "headSha,status,conclusion,jobs",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ),
  ) as CiRun;
  admitCiRevision(sha, run);
  process.stdout.write(
    JSON.stringify({
      status: "release_ci_passed",
      repository,
      commitSha: sha,
      ciRunId: latest.databaseId,
      requiredJobs: REQUIRED_CI_JOBS,
    }) + "\n",
  );
} catch {
  process.stderr.write('{"status":"release_ci_rejected"}\n');
  process.exitCode = 1;
}
