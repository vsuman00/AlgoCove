import { mkdir, open, readFile } from "node:fs/promises";
import { createDiscoveryProvider } from "./discovery-provider.ts";
import { runDiscovery } from "./discovery.ts";
import { evaluateSandboxCapability } from "./sandbox-capability.ts";

// Standalone operator command; never imported by the web app or an automatic CI job.
if (process.argv.slice(2).join(" ") !== "--synthetic-discovery") {
  process.stderr.write(
    "Usage: node ops/environments/vercel-hobby/run-discovery.ts --synthetic-discovery\n",
  );
  process.exitCode = 1;
} else {
  const controller = new AbortController();
  const cancel = (): void => controller.abort();
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  const deadline = setTimeout(cancel, 45_000);
  const directory = new URL("../../../.tmp/vercel-discovery/", import.meta.url);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const file = await open(new URL(`${crypto.randomUUID()}.jsonl`, directory), "wx", 0o600);
  async function record(value: unknown): Promise<void> {
    await file.write(`${JSON.stringify(value)}\n`);
    await file.sync();
  }
  try {
    const receipt = await runDiscovery(
      createDiscoveryProvider(process.env.VERCEL_TOKEN ?? ""),
      {
        normal: await readFile(
          new URL("../../../spikes/execution-sandbox/vercel-capability-probe.py", import.meta.url),
        ),
        containment: await readFile(
          new URL("../../../spikes/execution-sandbox/vercel-containment-probe.py", import.meta.url),
        ),
      },
      async (sessionId) =>
        record({ status: "created", sessionId, checkedAt: new Date().toISOString() }),
      controller.signal,
    );
    const profiles = JSON.parse(
      await readFile(
        new URL("../../../services/execution-images/profiles.json", import.meta.url),
        "utf8",
      ),
    ) as { profiles: { id: string; toolchain: string }[] };
    const pythonVersion =
      profiles.profiles
        .find((profile) => profile.id === "python")
        ?.toolchain.replace("Python ", "") ?? "invalid";
    const result = {
      ...receipt,
      assessment: evaluateSandboxCapability(receipt.normalObservation, {
        pythonVersion,
        maxMemoryBytes: 128 * 1024 * 1024,
        maxPids: 8,
      }),
      checkedAt: new Date().toISOString(),
    };
    await record(result);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    // Discovery completion is deliberately distinct from execution qualification.
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const known = new Set([
      "provider_token_required",
      "unexpected_provider_scope",
      "invalid_provider_response",
      "hobby_plan_required",
      "discovery_identity_mismatch",
      "discovery_command_failed",
      "discovery_output_invalid",
      "discovery_stop_unconfirmed",
    ]);
    const reason =
      known.has(code) || /^(team|project)_read_http_[1-5][0-9]{2}$/.test(code)
        ? code
        : "discovery_failed";
    const failure = { status: "discovery_failed", reason, checkedAt: new Date().toISOString() };
    await record(failure);
    process.stderr.write(`${JSON.stringify(failure)}\n`);
    process.exitCode = 1;
  } finally {
    clearTimeout(deadline);
    process.removeListener("SIGINT", cancel);
    process.removeListener("SIGTERM", cancel);
    await file.close();
  }
}
