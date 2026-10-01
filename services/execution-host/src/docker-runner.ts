import { spawn } from "node:child_process";
import {
  sha256Digest,
  type RunDescriptor,
  type TerminalCategory,
} from "@algocove/execution-contracts";
import {
  CONTAINER_FIXTURES,
  CONTAINER_FIXTURE_DIGEST,
  CONTAINER_PROBLEM,
  containerHarness,
  containerManifestDigest,
} from "./container-problem.ts";

export type CommandOutcome = {
  code: number;
  stdout: string;
  stderr: string;
  exceeded?: "time" | "output";
};
export type DockerCommand = (
  args: readonly string[],
  options?: { input?: string; timeoutMs?: number; outputLimitBytes?: number; signal?: AbortSignal },
) => Promise<CommandOutcome>;
export type HostVerdict = {
  category: TerminalCategory;
  phase: "compile" | "run";
  teardownConfirmed: boolean;
};

/** No shell, inherited application secrets, unlimited output or unbounded wait. */
export const dockerCommand: DockerCommand = (args, options = {}) =>
  new Promise((resolve) => {
    const child = spawn("docker", [...args], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        NODE_ENV: "development",
        PATH: process.env.PATH,
        DOCKER_HOST: process.env.DOCKER_HOST ?? "unix:///var/run/docker.sock",
        HOME: process.env.HOME,
      },
    });
    let stdout = "",
      stderr = "",
      bytes = 0;
    let exceeded: "time" | "output" | undefined;
    const kill = () => child.kill("SIGKILL");
    const timer = setTimeout(() => {
      exceeded = "time";
      kill();
    }, options.timeoutMs ?? 10000);
    const collect = (chunk: Buffer, output: "stdout" | "stderr") => {
      bytes += chunk.length;
      if (bytes > (options.outputLimitBytes ?? 65536)) {
        exceeded = "output";
        kill();
        return;
      }
      if (output === "stdout") stdout += chunk.toString();
      else stderr += chunk.toString();
    };
    child.stdout.on("data", (data: Buffer) => collect(data, "stdout"));
    child.stderr.on("data", (data: Buffer) => collect(data, "stderr"));
    child.stdin.on("error", () => {});
    child.stdin.end(options.input ?? "");
    options.signal?.addEventListener("abort", kill, { once: true });
    if (options.signal?.aborted) kill();
    let settled = false;
    const finish = (code: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", kill);
      resolve({ code, stdout, stderr, ...(exceeded === undefined ? {} : { exceeded }) });
    };
    child.on("error", () => finish(125));
    child.on("close", (code) => finish(code ?? 125));
  });

export function createGvisorRunner(
  images: Readonly<Record<RunDescriptor["language"], string>>,
  command: DockerCommand = dockerCommand,
) {
  let quarantined = false;
  return async (
    descriptor: RunDescriptor,
    source: string,
    signal: AbortSignal,
  ): Promise<HostVerdict> => {
    const infrastructure: HostVerdict = {
      category: "infrastructure_error",
      phase: "run",
      teardownConfirmed: true,
    };
    if (
      quarantined ||
      descriptor.problemVersionId !== CONTAINER_PROBLEM ||
      descriptor.manifestDigest !== containerManifestDigest(descriptor.language) ||
      descriptor.fixtureDigest !== CONTAINER_FIXTURE_DIGEST ||
      sha256Digest(source) !== descriptor.sourceDigest ||
      Buffer.byteLength(source) > descriptor.limits.sourceLimitBytes ||
      !images[descriptor.language].endsWith(descriptor.runtimeImageDigest)
    )
      return infrastructure;
    const name = `algocove-local-${descriptor.runId}`;
    const harness = containerHarness(descriptor.language, source);
    let verdict: HostVerdict = infrastructure;
    let created = false;
    const execute = async (): Promise<HostVerdict> => {
      if (signal.aborted) return { ...infrastructure, category: "cancelled" };
      created = true;
      const create = await command(
        [
          "run",
          "-d",
          "--name",
          name,
          "--label",
          "algocove.local-execution=true",
          "--runtime=runsc",
          "--network=none",
          "--read-only",
          "--user=65532:65532",
          "--cap-drop=ALL",
          "--security-opt=no-new-privileges",
          `--memory=${descriptor.limits.memoryLimitMb}m`,
          `--memory-swap=${descriptor.limits.memoryLimitMb}m`,
          `--pids-limit=${descriptor.limits.pidLimit}`,
          `--cpus=${descriptor.limits.cpuLimitMillis / 1000}`,
          "--tmpfs=/work:rw,exec,nosuid,nodev,size=32m,mode=1777",
          "--tmpfs=/tmp:rw,nosuid,nodev,size=64m,mode=1777",
          images[descriptor.language],
          "sh",
          "-c",
          "mkdir -p /work/algocove-output /tmp/algocove-output; exec sleep 120",
        ],
        { signal },
      );
      // A failed/lost create response may still leave a sandbox. Always inspect teardown.
      if (create.code !== 0) return infrastructure;
      const write = await command(["exec", "-i", name, "sh", "-c", `cat > ${harness.file}`], {
        input: harness.source,
        signal,
      });
      if (write.code !== 0) return infrastructure;
      const compileDeadline = Date.now() + descriptor.limits.compileTimeoutMs;
      const resourceOutcome = async (outcome: CommandOutcome): Promise<TerminalCategory | null> => {
        if (outcome.exceeded !== undefined || outcome.code === 137) return "limits";
        if (outcome.code === 0) return null;
        // Docker may report a lost Sentry RPC as exit 128 after a cgroup OOM.
        // Classify from host evidence, never from learner-controlled stderr.
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const state = await command(["inspect", "--format", "{{json .State}}", name]);
          if (state.code !== 0) return "infrastructure_error";
          try {
            const parsed = JSON.parse(state.stdout) as { OOMKilled?: boolean; Running?: boolean };
            if (parsed.OOMKilled === true) return "limits";
            if (parsed.Running === false || [125, 126, 127].includes(outcome.code))
              return "infrastructure_error";
          } catch {
            return "infrastructure_error";
          }
          if (outcome.code !== 128) break;
          // The daemon records the kernel OOM event asynchronously after RPC EOF.
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        return null;
      };
      for (const compile of harness.compile) {
        const outcome = await command(["exec", name, ...compile], {
          timeoutMs: Math.max(1, compileDeadline - Date.now()),
          outputLimitBytes: descriptor.limits.outputLimitBytes,
          signal,
        });
        if (signal.aborted) {
          verdict = { ...infrastructure, category: "cancelled", phase: "compile" };
          return verdict;
        }
        const resource = await resourceOutcome(outcome);
        if (resource !== null) {
          verdict = { ...infrastructure, category: resource, phase: "compile" };
          return verdict;
        }
        if (outcome.code !== 0) {
          verdict = {
            ...infrastructure,
            category:
              outcome.code === 125 || outcome.code === 126
                ? "infrastructure_error"
                : descriptor.language === "typescript"
                  ? "type_error"
                  : "compile_error",
            phase: "compile",
          };
          return verdict;
        }
      }
      const runDeadline = Date.now() + descriptor.limits.runTimeoutMs;
      for (const fixture of CONTAINER_FIXTURES) {
        const outcome = await command(["exec", "-i", name, ...harness.run], {
          input: `${fixture.heights.length}\n${fixture.heights.join(" ")}\n`,
          timeoutMs: Math.max(1, runDeadline - Date.now()),
          outputLimitBytes: descriptor.limits.outputLimitBytes,
          signal,
        });
        const resource = await resourceOutcome(outcome);
        const category: TerminalCategory = signal.aborted
          ? "cancelled"
          : resource !== null
            ? resource
            : outcome.code === 125 || outcome.code === 126
              ? "infrastructure_error"
              : outcome.code !== 0
                ? "runtime_error"
                : outcome.stdout.trim() !== String(fixture.expected)
                  ? "wrong_answer"
                  : "pass";
        verdict = { ...infrastructure, category };
        if (category !== "pass") return verdict;
      }
      return verdict;
    };
    try {
      verdict = await execute();
    } catch {
      verdict = infrastructure;
    } finally {
      if (created) {
        await command(["rm", "-f", name]).catch(() => undefined);
        const residue = await command(["ps", "-aq", "--filter", `name=^/${name}$`]).catch(
          () => null,
        );
        if (residue === null || residue.code !== 0 || residue.stdout.trim() !== "") {
          quarantined = true;
          verdict.category = "infrastructure_error";
          verdict.teardownConfirmed = false;
        }
      }
    }
    return verdict;
  };
}
