import { describe, expect, it } from "vitest";
import { admitCiRevision, REQUIRED_CI_JOBS } from "../../../ops/release/ci-admission";
const sha = "a".repeat(40);
const run = () => ({
  headSha: sha,
  status: "completed",
  conclusion: "success",
  jobs: REQUIRED_CI_JOBS.map((name) => ({ name, status: "completed", conclusion: "success" })),
});
describe("exact revision release gate", () => {
  it("admits a completed exact-source run with every mandatory job", () =>
    expect(() => admitCiRevision(sha, run())).not.toThrow());
  it("rejects passing evidence from another revision", () =>
    expect(() => admitCiRevision("b".repeat(40), run())).toThrow());
  it.each(["failure", "skipped", "cancelled", "neutral", "timed_out", ""])(
    "rejects required job conclusion %s despite a green run summary",
    (conclusion) => {
      const candidate = run();
      candidate.jobs[1]!.conclusion = conclusion;
      expect(() => admitCiRevision(sha, candidate)).toThrow();
    },
  );
  it("rejects missing, duplicated and still-running jobs", () => {
    const candidate = run();
    candidate.jobs.pop();
    expect(() => admitCiRevision(sha, candidate)).toThrow();
    const duplicate = run();
    duplicate.jobs.push(duplicate.jobs[0]!);
    expect(() => admitCiRevision(sha, duplicate)).toThrow();
    const pending = run();
    pending.jobs[0]!.status = "in_progress";
    expect(() => admitCiRevision(sha, pending)).toThrow();
  });
  it("rejects a pending or failed aggregate even if job records appear green", () => {
    expect(() => admitCiRevision(sha, { ...run(), status: "in_progress" })).toThrow();
    expect(() => admitCiRevision(sha, { ...run(), conclusion: "failure" })).toThrow();
  });
});
