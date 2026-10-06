import { bootstrapWorkerRole } from "../bootstrap-worker.ts";
try {
  process.loadEnvFile();
} catch {
  /* Environment may be provided by operator. */
}
try {
  const url = process.env.DATABASE_ADMIN_URL,
    worker = process.env.WORKER_DATABASE_URL;
  if (!url || !worker) throw Error("Migration and worker connection configuration required.");
  const parsed = new URL(worker);
  await bootstrapWorkerRole({
    operatorConnectionString: url,
    name: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    capability: process.env.WORKER_CONTENT_ENABLED === "true" ? "content_indexing" : "maintenance",
  });
  process.stdout.write("Dedicated worker role provisioned.\n");
} catch {
  process.stderr.write(
    "Worker role provisioning failed; check operator configuration and role existence.\n",
  );
  process.exitCode = 1;
}
