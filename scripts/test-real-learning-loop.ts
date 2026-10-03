/** Disposable Linux-only test orchestration. No production authentication seam is enabled. */
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { bootstrapDatabase, createPool, migrate } from "../packages/db/src/index.ts";
import { loadConfig } from "../packages/config/src/index.ts";

if (process.platform !== "linux" || process.env.ALGO_COVE_REAL_LOOP_CI !== "1")
  throw Error("Explicit disposable Linux test opt-in required");
const require = createRequire(import.meta.url);
const suffix = randomUUID().replaceAll("-", "").slice(0, 16);
const directory = resolve(`.tmp/real-loop-${suffix}`);
mkdirSync(directory, { recursive: true, mode: 0o700 });
const database = `algocove_loop_${suffix}`,
  migrationRole = `algocove_loop_m_${suffix}`,
  runtimeRole = `algocove_loop_r_${suffix}`;
const operatorUrl = new URL(
  process.env.DATABASE_TEST_OPERATOR_URL ?? "postgres://postgres:postgres@127.0.0.1:54329/postgres",
);
operatorUrl.pathname = "/postgres";
const target = new URL(operatorUrl);
target.pathname = `/${database}`;
const migrationUrl = new URL(target);
migrationUrl.username = migrationRole;
migrationUrl.password = randomUUID();
const runtimeUrl = new URL(target);
runtimeUrl.username = runtimeRole;
runtimeUrl.password = randomUUID();
const operator = createPool({
  connectionString: operatorUrl.toString(),
  applicationName: "real-loop-test-operator",
  maxConnections: 2,
  statementTimeoutMs: 5000,
});
let web: ChildProcess | undefined;
function stop(child: ChildProcess | undefined): void {
  if (child?.pid && child.exitCode === null) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      /* Already closed. */
    }
  }
}
function runNode(args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolveRun() : reject(Error(`Test command failed (${code})`)),
    );
  });
}
const report = resolve(".tmp/phase7-learning-loop-report.local.json");
try {
  await operator.query(`CREATE DATABASE "${database}"`);
  await bootstrapDatabase({
    operatorConnectionString: target.toString(),
    migrationRole: { name: migrationRole, password: migrationUrl.password },
    runtimeRole: { name: runtimeRole, password: runtimeUrl.password },
  });
  await migrate({
    connectionString: migrationUrl.toString(),
    applicationName: "real-loop-test-migrate",
    logger: { info: () => undefined },
  });
  await runNode(["packages/db/src/cli/seed-practice.ts"], {
    ...process.env,
    DATABASE_ADMIN_URL: migrationUrl.toString(),
    NODE_ENV: "test",
  });
  const profiles = JSON.parse(readFileSync("services/execution-images/profiles.json", "utf8")) as {
    profiles: { image: string; languages: string[] }[];
  };
  const images: Record<string, string> = {};
  for (const profile of profiles.profiles) {
    const digest = execFileSync(
      "docker",
      ["image", "inspect", "--format", "{{.Id}}", profile.image],
      { encoding: "utf8" },
    ).trim();
    if (!/^sha256:[0-9a-f]{64}$/.test(digest)) throw Error("An immutable tested image is required");
    for (const language of profile.languages) images[language] = digest;
  }
  const imageFile = `${directory}/images.local.json`;
  writeFileSync(imageFile, JSON.stringify(images), { mode: 0o600 });
  web = spawn(
    process.execPath,
    [
      require.resolve("next/dist/bin/next", { paths: [resolve("apps/web")] }),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3300",
    ],
    {
      cwd: resolve("apps/web"),
      env: {
        ...process.env,
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
        CLERK_SECRET_KEY: "",
        DATABASE_URL: "",
        EXECUTION_ENABLED: "true",
      },
      stdio: "inherit",
      detached: true,
    },
  );
  const deadline = Date.now() + 30000;
  for (;;) {
    try {
      if (
        (await fetch("http://127.0.0.1:3300/api/health", { signal: AbortSignal.timeout(1000) })).ok
      )
        break;
    } catch {
      /* Startup is bounded. */
    }
    if (Date.now() > deadline || web.exitCode !== null) throw Error("Test website did not start");
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  const testEnvironment: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "test",
    SERVICE_NAME: "algocove-web",
    APP_ORIGIN: "http://127.0.0.1:3300",
    LOCAL_PHASE5_E2E: "1",
    LOCAL_PHASE5_NATIVE_HOST: "1",
    LOCAL_EXECUTION_STATE_DIR: `${directory}/host`,
    LOCAL_EXECUTION_IMAGES_FILE: imageFile,
    LOCAL_PHASE5_REPORT_FILE: report,
    DATABASE_URL: runtimeUrl.toString(),
    DATABASE_ADMIN_URL: undefined,
    DATABASE_OPERATOR_URL: undefined,
  };
  loadConfig(testEnvironment);
  await runNode(
    [
      resolve(require.resolve("vitest/package.json"), "..", "vitest.mjs"),
      "run",
      "--project",
      "integration",
      "tests/integration/local-learning-loop.test.ts",
    ],
    testEnvironment,
  );
} finally {
  stop(web);
  await operator.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
  await operator.query(`DROP ROLE IF EXISTS "${migrationRole}"`);
  await operator.query(`DROP ROLE IF EXISTS "${runtimeRole}"`);
  await operator.end();
  rmSync(directory, { recursive: true, force: true });
}
