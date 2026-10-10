import { z } from "zod";
import { hobbyTarget } from "./account.ts";
import { sandboxObservationSchema } from "./sandbox-capability.ts";

// Immutable provider image for synthetic diagnostics only; not an approved learner runtime.
export const discoveryImage =
  "vercel/sandbox/universal@sha256:c77f7436b9bc0a8b01ef7b09dbcea2de6a18a9fe2aafa89996d2da193da72cf0";
export const discoveryPolicy = {
  projectId: hobbyTarget.projectId,
  teamId: hobbyTarget.teamId,
  image: discoveryImage,
  region: hobbyTarget.region,
  failoverRegions: [],
  resources: { vcpus: 1 },
  timeout: 60_000,
  persistent: false,
  networkPolicy: "deny-all",
  ports: [],
  env: {},
} as const;

const containment = z
  .object({
    dockerInstalled: z.boolean(),
    mountNamespaceAvailable: z.boolean(),
    networkNamespaceAvailable: z.boolean(),
    privilegeDropAvailable: z.boolean(),
    childCgroupMemoryWritable: z.boolean(),
    childCgroupPidsWritable: z.boolean(),
    childCgroupCpuWritable: z.boolean(),
    childCgroupRemoved: z.boolean(),
    parentControllersRestored: z.boolean(),
  })
  .strict();

export type DiscoverySession = {
  sessionId: string;
  image: string;
  region: string;
  upload: (
    files: readonly { path: string; content: Buffer }[],
    signal: AbortSignal,
  ) => Promise<void>;
  run: (
    path: string,
    sudo: boolean,
    signal: AbortSignal,
  ) => Promise<{ exitCode: number; stdout: string }>;
  stop: () => Promise<{ status: string }>;
};
export type DiscoveryProvider = {
  qualify: () => Promise<void>;
  create: (signal: AbortSignal) => Promise<DiscoverySession>;
};

export type DiscoveryReceipt = {
  sessionId: string;
  image: string;
  region: string;
  status: "stopped";
  productionQualified: false;
  containment: z.infer<typeof containment>;
  normalObservation: z.infer<typeof sandboxObservationSchema>;
};

/** One fixed diagnostic VM; never accepts source, commands, ports, env or resource overrides. */
export async function runDiscovery(
  provider: DiscoveryProvider,
  fixtures: { normal: Buffer; containment: Buffer },
  recordStarted: (sessionId: string) => Promise<void>,
  signal: AbortSignal,
): Promise<DiscoveryReceipt> {
  signal.throwIfAborted();
  await provider.qualify();
  signal.throwIfAborted();
  const session = await provider.create(signal);
  async function inspect(): Promise<DiscoveryReceipt> {
    // Persist the safe ID before any command so an operator can reconcile a failed stop.
    await recordStarted(session.sessionId);
    signal.throwIfAborted();
    if (session.image !== discoveryImage || session.region !== hobbyTarget.region)
      throw Error("discovery_identity_mismatch");
    await session.upload(
      [
        { path: "/vercel/algocove-normal.py", content: fixtures.normal },
        { path: "/vercel/algocove-containment.py", content: fixtures.containment },
      ],
      signal,
    );
    const normal = await session.run("/vercel/algocove-normal.py", false, signal);
    signal.throwIfAborted();
    const primitive = await session.run("/vercel/algocove-containment.py", true, signal);
    signal.throwIfAborted();
    if (normal.exitCode !== 0 || primitive.exitCode !== 0) throw Error("discovery_command_failed");
    if (Buffer.byteLength(normal.stdout) > 4096 || Buffer.byteLength(primitive.stdout) > 4096)
      throw Error("discovery_output_invalid");
    const primitives = containment.safeParse(JSON.parse(primitive.stdout));
    const normalObservation = sandboxObservationSchema.safeParse(JSON.parse(normal.stdout));
    if (!primitives.success || !normalObservation.success) throw Error("discovery_output_invalid");
    return {
      sessionId: session.sessionId,
      image: session.image,
      region: session.region,
      status: "stopped",
      productionQualified: false,
      containment: primitives.data,
      normalObservation: normalObservation.data,
    };
  }
  const outcome = await inspect().then(
    (receipt) => ({ ok: true as const, receipt }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  // Cleanup must not inherit cancellation. A lost acknowledgement is retried once.
  let stopped = false;
  for (let attempt = 0; attempt < 2 && !stopped; attempt++) {
    try {
      stopped = (await session.stop()).status === "stopped";
    } catch {
      /* retry */
    }
  }
  if (!stopped) throw Error("discovery_stop_unconfirmed");
  if (!outcome.ok) throw outcome.error;
  return outcome.receipt;
}
