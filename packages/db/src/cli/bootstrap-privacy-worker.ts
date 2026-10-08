import { bootstrapWorkerRole } from "../bootstrap-worker.ts";
import { loadLocalEnvFile, requireEnv } from "./cli-support.ts";
loadLocalEnvFile();
try {
  const worker = new URL(requireEnv("PRIVACY_WORKER_DATABASE_URL"));
  await bootstrapWorkerRole({
    operatorConnectionString: requireEnv("DATABASE_OPERATOR_URL"),
    name: decodeURIComponent(worker.username),
    password: decodeURIComponent(worker.password),
    capability: "privacy",
  });
  process.stdout.write("Dedicated privacy worker role provisioned.\n");
} catch {
  process.stderr.write("Privacy worker provisioning failed; verify operator configuration.\n");
  process.exitCode = 1;
}
