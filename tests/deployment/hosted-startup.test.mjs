import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { setTimeout as pause } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../../", import.meta.url));
const web = fileURLToPath(new URL("../../apps/web/", import.meta.url));
const base = { PATH: process.env.PATH, NODE_ENV: "production", DEPLOYMENT_ENVIRONMENT: "local" };

async function availablePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const closed = once(child, "close");
  child.kill("SIGTERM");
  await Promise.race([closed, pause(2000)]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await closed;
  }
}

async function serve(t, environment) {
  const port = await availablePort();
  const child = spawn(
    process.execPath,
    [
      fileURLToPath(new URL("../../apps/web/node_modules/next/dist/bin/next", import.meta.url)),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { cwd: web, env: { ...base, ...environment }, stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  child.stdout.on("data", (data) => {
    output += data;
  });
  child.stderr.on("data", (data) => {
    output += data;
  });
  t.after(() => stop(child));
  for (let retry = 0; retry < 100; retry++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: AbortSignal.timeout(1000),
      });
      const body = await response.text();
      await stop(child);
      return { status: response.status, body, output };
    } catch {
      if (child.exitCode !== null)
        throw new Error("Production server exited before HTTP smoke check");
      await pause(100);
    }
  }
  throw new Error("Production server did not answer the bounded HTTP smoke check");
}

test("built local web still serves dependency-free liveness", async (t) => {
  const result = await serve(t, {});
  assert.equal(result.status, 200);
  assert.equal(JSON.parse(result.body).status, "live");
});

test("built hosted web refuses unsafe initialization without secret leakage", async (t) => {
  const canary = "private-startup-canary-not-for-logs";
  const result = await serve(t, {
    DEPLOYMENT_ENVIRONMENT: "staging",
    DATABASE_OPERATOR_URL: `postgres://owner:${canary}@db/staging`,
  });
  assert.equal(result.status, 500);
  assert.ok(result.output.includes("privileged credentials must not enter"));
  assert.ok(!result.body.includes(canary));
  assert.ok(!result.output.includes(canary));
});

test("staging CLI distinguishes configuration-only admission from database qualification", async (t) => {
  const child = spawn(
    process.execPath,
    ["ops/environments/staging/preflight.ts", "--configuration-only"],
    {
      cwd: root,
      env: {
        ...base,
        DEPLOYMENT_ENVIRONMENT: "staging",
        SERVICE_NAME: "algocove-web",
        APP_ORIGIN: "https://staging.algocove.example",
        DATABASE_URL:
          "postgres://runtime:synthetic-password@db.algocove.example/staging?sslmode=verify-full",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_synthetic",
        CLERK_SECRET_KEY: "sk_test_synthetic",
        TELEMETRY_CORRELATION_KEY: "synthetic-correlation-key-for-tests-only",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  t.after(() => stop(child));
  let output = "";
  child.stdout.on("data", (data) => {
    output += data;
  });
  const [code] = await once(child, "close");
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(output), { status: "configuration_passed", databaseChecked: false });
});
