import { spawnSync } from "node:child_process";

const audit = spawnSync("pnpm", ["audit", "--json"], {
  encoding: "utf8",
  maxBuffer: 4 * 1024 * 1024,
});

if (audit.error) throw audit.error;

let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  const detail = (audit.stderr || audit.stdout || "no output").trim().slice(0, 240);
  throw new Error(
    "Full dependency audit did not return JSON (exit " + audit.status + "): " + detail,
  );
}

if (report.error) {
  throw new Error(
    "Full dependency audit could not read the dependency lockfile: " +
      (report.error.code ?? "unknown") +
      ". Use the pnpm version declared in package.json.",
  );
}

const advisories = Object.values(report.advisories ?? {});
if (advisories.length === 0 && audit.status === 0) {
  process.stdout.write("Full dependency audit passed with no advisories.\n");
  process.exit(0);
}

const advisory = advisories[0];
const findings = Array.isArray(advisory?.findings) ? advisory.findings : [];
const finding = findings[0];
const vulnerabilityCounts = report.metadata?.vulnerabilities ?? {};
const expectedOnlyFinding =
  audit.status === 1 &&
  advisories.length === 1 &&
  advisory?.github_advisory_id === "GHSA-vfj7-8cjw-p6xm" &&
  advisory.module_name === "braces" &&
  advisory.severity === "high" &&
  advisory.patched_versions === null &&
  advisory.patched_versions_unpublished === true &&
  findings.length === 1 &&
  finding?.version === "3.0.3" &&
  finding.dev === true &&
  finding.optional === false &&
  finding.bundled === false &&
  finding.paths.length === 1 &&
  finding.paths[0] ===
    ".>eslint-config-next>@next/eslint-plugin-next>fast-glob>micromatch>braces" &&
  vulnerabilityCounts.info === 0 &&
  vulnerabilityCounts.low === 0 &&
  vulnerabilityCounts.moderate === 0 &&
  vulnerabilityCounts.high === 1 &&
  vulnerabilityCounts.critical === 0;

if (!expectedOnlyFinding) {
  process.stderr.write(audit.stdout);
  throw new Error(
    "Full dependency audit failed with exit " +
      audit.status +
      "; only the documented development-only GHSA-vfj7-8cjw-p6xm finding is currently expected.",
  );
}

process.stderr.write(
  "::warning title=Unpatched development-only dependency advisory::Full audit reports GHSA-vfj7-8cjw-p6xm in braces@3.0.3 through eslint-config-next. The finding is dev-only, has no published patch, and is excluded from the blocking production dependency audit. See docs/architecture/phase7-production-ui-evidence-2026-10-03.md.\n",
);
