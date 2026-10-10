import { describe, expect, it, vi } from "vitest";
import {
  discoveryImage,
  discoveryPolicy,
  runDiscovery,
  type DiscoverySession,
} from "../../../ops/environments/vercel-hobby/discovery.ts";

const primitives = {
  dockerInstalled: false,
  mountNamespaceAvailable: true,
  networkNamespaceAvailable: true,
  privilegeDropAvailable: true,
  childCgroupMemoryWritable: true,
  childCgroupPidsWritable: true,
  childCgroupCpuWritable: true,
  childCgroupRemoved: true,
  parentControllersRestored: true,
};
const observation = {
  normal: true,
  pythonVersion: "3.14.4",
  uid: 1000,
  externalBlocked: true,
  metadataBlocked: true,
  credentialEnvAbsent: true,
  dockerSocketAbsent: true,
  memoryMax: "2147483648",
  pidsMax: "max",
  sudoAvailable: true,
};
function setup() {
  const run = vi.fn(async (_path: string, sudo: boolean) => ({
    exitCode: 0,
    stdout: JSON.stringify(sudo ? primitives : observation),
  }));
  const session: DiscoverySession = {
    sessionId: "sbx_fixture",
    image: discoveryImage,
    region: "sin1",
    upload: vi.fn(async () => {}),
    run,
    stop: vi.fn(async () => ({ status: "stopped" })),
  };
  const provider = { qualify: vi.fn(async () => {}), create: vi.fn(async () => session) };
  const started = vi.fn(async () => {});
  const fixtures = {
    normal: Buffer.from("fixed-normal"),
    containment: Buffer.from("fixed-trusted-diagnostic"),
  };
  const controller = new AbortController();
  return { provider, session, started, fixtures, controller, run };
}
describe("opt-in managed discovery lifecycle", () => {
  it("creates no resource when the Hobby account check fails", async () => {
    const f = setup();
    f.provider.qualify.mockRejectedValue(Error("team_read_http_403"));
    await expect(
      runDiscovery(f.provider, f.fixtures, f.started, f.controller.signal),
    ).rejects.toThrow("team_read_http_403");
    expect(f.provider.create).not.toHaveBeenCalled();
  });
  it("uses a secret-free immutable Singapore diagnostic policy", () => {
    expect(discoveryPolicy).toMatchObject({
      image: discoveryImage,
      region: "sin1",
      networkPolicy: "deny-all",
      env: {},
      ports: [],
      failoverRegions: [],
      timeout: 60000,
      persistent: false,
      resources: { vcpus: 1 },
    });
  });
  it("records identity before upload and confirms disposal before returning a receipt", async () => {
    const f = setup();
    const result = await runDiscovery(f.provider, f.fixtures, f.started, f.controller.signal);
    expect(f.started.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(f.session.upload).mock.invocationCallOrder[0]!,
    );
    expect(f.run.mock.calls.map((call) => call[1])).toEqual([false, true]);
    expect(f.session.stop).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      status: "stopped",
      productionQualified: false,
      containment: primitives,
    });
  });
  it.each(["record", "identity", "upload", "command", "parse"])(
    "stops after a %s failure",
    async (stage) => {
      const f = setup();
      if (stage === "record") f.started.mockRejectedValue(Error("disk failed"));
      if (stage === "identity") f.session.image = "mutable:latest";
      if (stage === "upload") vi.mocked(f.session.upload).mockRejectedValue(Error("upload failed"));
      if (stage === "command") f.run.mockRejectedValue(Error("command failed"));
      if (stage === "parse") f.run.mockResolvedValue({ exitCode: 0, stdout: "not json" });
      await expect(
        runDiscovery(f.provider, f.fixtures, f.started, f.controller.signal),
      ).rejects.toThrow();
      expect(f.session.stop).toHaveBeenCalledOnce();
    },
  );
  it("stops when cancellation arrives while creation completes", async () => {
    const f = setup();
    f.provider.create.mockImplementation(async () => {
      f.controller.abort();
      return f.session;
    });
    await expect(
      runDiscovery(f.provider, f.fixtures, f.started, f.controller.signal),
    ).rejects.toThrow();
    expect(f.session.upload).not.toHaveBeenCalled();
    expect(f.session.stop).toHaveBeenCalledOnce();
  });
  it("retries a lost stop acknowledgement independently of cancellation", async () => {
    const f = setup();
    vi.mocked(f.session.stop).mockRejectedValueOnce(Error("lost acknowledgement"));
    await expect(
      runDiscovery(f.provider, f.fixtures, f.started, f.controller.signal),
    ).resolves.toMatchObject({ status: "stopped" });
    expect(f.session.stop).toHaveBeenCalledTimes(2);
  });
  it("does not return a successful receipt when disposal is unconfirmed", async () => {
    const f = setup();
    vi.mocked(f.session.stop).mockResolvedValue({ status: "stopping" });
    await expect(
      runDiscovery(f.provider, f.fixtures, f.started, f.controller.signal),
    ).rejects.toThrow("discovery_stop_unconfirmed");
    expect(f.session.stop).toHaveBeenCalledTimes(2);
  });
  it.each(["extra", "oversized", "nonzero"])(
    "rejects %s diagnostic output and still disposes",
    async (kind) => {
      const f = setup();
      if (kind === "extra")
        f.run.mockResolvedValue({
          exitCode: 0,
          stdout: JSON.stringify({ ...observation, secret: "PRIVATE_CANARY" }),
        });
      if (kind === "oversized") f.run.mockResolvedValue({ exitCode: 0, stdout: "x".repeat(4097) });
      if (kind === "nonzero")
        f.run.mockResolvedValue({ exitCode: 1, stdout: JSON.stringify(observation) });
      await expect(
        runDiscovery(f.provider, f.fixtures, f.started, f.controller.signal),
      ).rejects.toThrow(/discovery_(output_invalid|command_failed)/);
      expect(f.session.stop).toHaveBeenCalledOnce();
    },
  );
});
