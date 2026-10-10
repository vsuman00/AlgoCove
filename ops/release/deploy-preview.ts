import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const team = "team_LGvZpIlcg4QXoGDvgCh1JX0v";
const project = "prj_y4QC0yhk2h2frXDs8l3H0yn9IjJK";
const token = process.env.VERCEL_TOKEN;
let deploymentId: string | undefined;
let share: string | undefined;
let temporary: string | undefined;

async function api(path: string, method = "GET", body?: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(`https://api.vercel.com${path}?teamId=${team}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? null : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
    redirect: "error",
  });
  if (!response.ok) throw Error("provider_request_rejected");
  return (await response.json()) as Record<string, unknown>;
}

try {
  const [option, sha, ...rest] = process.argv.slice(2);
  if (option !== "--sha" || !sha || !/^[a-f0-9]{40}$/.test(sha) || rest.length || !token)
    throw Error("release_arguments");
  const ci = JSON.parse(await readFile("release-ci.json", "utf8"));
  if (ci.status !== "release_ci_passed" || ci.commitSha !== sha) throw Error("ci_receipt");
  const created = await api("/v13/deployments", "POST", {
    name: "algocove",
    project,
    gitSource: { type: "github", repoId: "1374184319", ref: "main", sha },
    gitMetadata: { commitSha: sha, commitRef: "main", ci: true, dirty: false },
  });
  if (typeof created.id !== "string" || !created.id.startsWith("dpl_"))
    throw Error("deployment_id");
  deploymentId = created.id;
  if (created.target === "production") {
    await api(`/v12/deployments/${deploymentId}/cancel`, "PATCH");
    throw Error("unexpected_production_target");
  }
  let deployment = created;
  const deadline = Date.now() + 15 * 60_000;
  while (deployment.readyState !== "READY") {
    if (["ERROR", "CANCELED"].includes(String(deployment.readyState)) || Date.now() >= deadline)
      throw Error("build_not_ready");
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    deployment = await api(`/v13/deployments/${deploymentId}`);
  }
  const meta = deployment.meta as Record<string, unknown> | undefined;
  const url = deployment.url;
  if (
    deployment.target === "production" ||
    meta?.githubCommitSha !== sha ||
    typeof url !== "string" ||
    !/^algocove-[a-z0-9]+-vsuman00s-projects\.vercel\.app$/.test(url)
  )
    throw Error("deployment_identity");
  const access = await api(`/aliases/${deploymentId}/protection-bypass`, "PATCH", { ttl: 600 });
  const links = Object.keys((access.protectionBypass ?? {}) as Record<string, unknown>);
  if (links.length !== 1) throw Error("ambiguous_temporary_access");
  share = links[0];
  temporary = await mkdtemp(join(tmpdir(), "algocove-release-"));
  const cookieJar = join(temporary, "cookies");
  await writeFile(cookieJar, "", { mode: 0o600 });
  const accessRequest = spawnSync(
    "curl",
    [
      "--fail",
      "--silent",
      "--show-error",
      "--location",
      "--max-time",
      "30",
      "--cookie-jar",
      cookieJar,
      `https://${url}/?_vercel_share=${encodeURIComponent(share!)}`,
    ],
    { stdio: "ignore" },
  );
  if (accessRequest.status !== 0) throw Error("protected_access");
  const checks: Record<string, string> = {};
  for (const [path, expected] of [
    ["health", "live"],
    ["readiness", "ready"],
  ]) {
    const result = spawnSync(
      "curl",
      [
        "--fail",
        "--silent",
        "--show-error",
        "--max-time",
        "30",
        "--cookie",
        cookieJar,
        `https://${url}/api/${path}`,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    if (result.status !== 0) throw Error("smoke_http");
    const payload = JSON.parse(result.stdout);
    if (payload.status !== expected || (path === "readiness" && payload.checks?.database !== "ok"))
      throw Error("smoke_admission");
    checks[path!] = payload.status;
  }
  await writeFile(
    "release-receipt.json",
    JSON.stringify(
      { commitSha: sha, deploymentId, target: "preview", url: `https://${url}`, ci, checks },
      null,
      2,
    ),
  );
} catch {
  process.stderr.write('{"status":"preview_release_rejected"}\n');
  process.exitCode = 1;
} finally {
  if (share && deploymentId) {
    try {
      await api(`/aliases/${deploymentId}/protection-bypass`, "PATCH", {
        revoke: { regenerate: false, secret: share },
      });
    } catch {
      process.stderr.write('{"status":"temporary_access_revocation_failed"}\n');
      process.exitCode = 1;
    }
  }
  if (temporary) await rm(temporary, { recursive: true, force: true });
}
