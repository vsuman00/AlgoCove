import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalWebEnv } from "../apps/web/local-env.ts";

loadLocalWebEnv();

const webDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../apps/web");
const next = path.join(webDirectory, "node_modules/next/dist/bin/next");
const result = spawnSync(process.execPath, [next, "build", "--webpack"], {
  cwd: webDirectory,
  env: process.env,
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
