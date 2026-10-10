import { Sandbox } from "@vercel/sandbox";
import { inspectHobbyAccount } from "./account.ts";
import { discoveryPolicy, type DiscoveryProvider } from "./discovery.ts";

export function createDiscoveryProvider(token: string): DiscoveryProvider {
  return {
    qualify: async () => {
      await inspectHobbyAccount(token);
    },
    create: async (_signal) => {
      const sandbox = await Sandbox.create({
        ...discoveryPolicy,
        failoverRegions: [],
        ports: [],
        token,
        name: `algocove-synthetic-${crypto.randomUUID()}`,
        tags: { purpose: "synthetic-vh02-discovery" },
        // Creation can lose its acknowledgement; the provider's 60s TTL is the backstop.
        // Keep HTTP deadlines independent so an aborted probe cannot poison stop calls.
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: AbortSignal.any([
              ...(init?.signal ? [init.signal] : []),
              AbortSignal.timeout(15_000),
            ]),
          }),
      });
      return {
        sessionId: sandbox.currentSession().sessionId,
        image: sandbox.image ?? "unknown",
        region: sandbox.currentSession().region,
        upload: async (files, operationSignal) => {
          await sandbox.writeFiles([...files], { signal: operationSignal });
        },
        run: async (path, sudo, operationSignal) => {
          const command = await sandbox.runCommand({
            cmd: "python3",
            args: [path],
            sudo,
            timeoutMs: 15_000,
            signal: operationSignal,
          });
          return {
            exitCode: command.exitCode,
            stdout: await command.stdout({ signal: operationSignal }),
          };
        },
        stop: async () => sandbox.stop({ signal: AbortSignal.timeout(10_000) }),
      };
    },
  };
}
