import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { formatId, type Result } from "@algocove/domain";
import { generateSigningKeyPair, sha256Digest } from "@algocove/execution-contracts";
import { createContainerDescriptorPolicy } from "../../services/execution-host/src/container-problem.ts";
import {
  createGvisorRunner,
  type DockerCommand,
} from "../../services/execution-host/src/docker-runner.ts";
import { createLocalSourceHost } from "../../services/execution-host/src/local-host.ts";
import { createWebsiteExecutionRelay } from "@algocove/execution-control";
import { verifyCommittedExecutionResult } from "../../apps/web/src/adapters/execution-result-verifier";

const must = <T>(v: Result<T, unknown>): T => {
  if (!v.ok) throw new Error("Invalid fixture");
  return v.value;
};
const key = generateSigningKeyPair("local-test");
const keys = new Map([
  [key.keyId, { keyId: key.keyId, publicKey: key.publicKey, status: "active" as const }],
]);
const image = `sha256:${"f".repeat(64)}`;
const images = {
  python: image,
  javascript: image,
  typescript: image,
  java: image,
  c: image,
  cpp: image,
};
const source = "def max_area(h): return 0";
const request = {
  runId: must(formatId("codeRun", "aaaaaaaaaaaaaaaa")),
  attemptId: must(formatId("attempt", "bbbbbbbbbbbbbbbb")),
  learnerId: must(formatId("learner", "cccccccccccccccc")),
  problemVersionId: must(formatId("problemVersion", "dddddddddddddddd")),
  manifestId: must(formatId("languageManifest", "aaaaaaaaaaaaaaaa")),
  language: "python" as const,
  mode: "run" as const,
  sourceChecksum: sha256Digest(source),
  sourceLength: source.length,
  requestedAt: must((await import("@algocove/domain")).parseInstant(new Date().toISOString())),
};
const message = () =>
  createContainerDescriptorPolicy(key, images, () => new Date().toISOString())(
    request,
    "evt_eeeeeeeeeeeeeeee",
  );

describe("local isolated source host", () => {
  it("uses host OOM evidence for lost runtime RPCs instead of trusting stderr", async () => {
    let inspections = 0;
    const command: DockerCommand = async (args) => {
      if (args[0] === "inspect")
        return {
          code: 0,
          stdout: JSON.stringify({ Running: true, OOMKilled: ++inspections > 1 }),
          stderr: "",
        };
      if (args[0] === "exec" && args.includes("/work/fixture.py") && !args.includes("py_compile"))
        return { code: 128, stdout: "", stderr: "untrusted diagnostic" };
      return { code: 0, stdout: "", stderr: "" };
    };
    expect(
      await createGvisorRunner(images, command)(
        message().descriptor.payload,
        source,
        new AbortController().signal,
      ),
    ).toMatchObject({ category: "limits", teardownConfirmed: true });
    expect(inspections).toBe(2);
  });
  it("applies one shared runtime deadline across all judged fixtures", async () => {
    const timeouts: number[] = [];
    let fixtureIndex = 0;
    const command: DockerCommand = async (args, options) => {
      if (args[0] === "exec" && args.includes("/work/fixture.py") && !args.includes("py_compile")) {
        timeouts.push(options?.timeoutMs ?? -1);
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { code: 0, stdout: ["0", "49", "8"][fixtureIndex++] ?? "", stderr: "" };
      }
      return { code: 0, stdout: "", stderr: "" };
    };
    const descriptor = message().descriptor.payload;
    const verdict = await createGvisorRunner(images, command)(
      descriptor,
      source,
      new AbortController().signal,
    );

    expect(verdict).toMatchObject({ category: "pass", teardownConfirmed: true });
    expect(timeouts).toHaveLength(3);
    expect(
      timeouts.every((timeout) => timeout > 0 && timeout <= descriptor.limits.runTimeoutMs),
    ).toBe(true);
    expect(timeouts[1]).toBeLessThan(timeouts[0]!);
    expect(timeouts[2]).toBeLessThan(timeouts[1]!);
  });
  it("verifies a freshly signed descriptor after its issue time", () => {
    let time = Date.now();
    const now = () => new Date(time++).toISOString();
    const relay = createWebsiteExecutionRelay({
      now,
      verificationKeys: keys,
      prepareDescriptor: createContainerDescriptorPolicy(key, images, now),
      host: {
        dispatch: async () => ({ runId: request.runId, replayed: false }),
        cancel: async () => {},
      },
    });
    expect(relay.prepare(request, must(formatId("event", "eeeeeeeeeeeeeeee"))).runId).toBe(
      request.runId,
    );
  });
  it("waits for ephemeral source when the descriptor outbox wins the admission race", async () => {
    const directory = mkdtempSync(join(tmpdir(), "algocove-handoff-test-"));
    const runner = vi.fn(async () => ({
      category: "pass" as const,
      phase: "run" as const,
      teardownConfirmed: true,
    }));
    const host = await createLocalSourceHost({
      journalPath: join(directory, "host.sqlite"),
      key,
      verificationKeys: keys,
      images,
      runner,
      deliver: async () => {},
    });
    try {
      const dispatch = message();
      expect(
        host.control.admit({
          dispatchKey: dispatch.dispatchKey,
          descriptor: dispatch.descriptor,
          quota: dispatch.quota,
          now: new Date().toISOString(),
        }).ok,
      ).toBe(true);
      await host.drain();
      expect(runner).not.toHaveBeenCalled();
      expect((await host.dispatch({ message: dispatch, source })).replayed).toBe(true);
      await host.drain();
      expect(runner).toHaveBeenCalledTimes(1);
    } finally {
      await host.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("enforces runsc and host judging, and overrides a pass if teardown cannot be confirmed", async () => {
    let executions = 0;
    const command: DockerCommand = vi.fn(async (args) => {
      if (args[0] === "ps") return { code: 0, stdout: "residue", stderr: "" };
      if (args.includes("/work/fixture.py") && args[0] === "exec" && !args.includes("py_compile"))
        return { code: 0, stdout: ["0", "49", "8"][executions++] ?? "", stderr: "" };
      return { code: 0, stdout: "", stderr: "" };
    });
    const runner = createGvisorRunner(images, command);
    expect(
      await runner(message().descriptor.payload, source, new AbortController().signal),
    ).toMatchObject({ category: "infrastructure_error", teardownConfirmed: false });
    expect(command).toHaveBeenCalledWith(
      expect.arrayContaining([
        "--runtime=runsc",
        "--network=none",
        "--read-only",
        "--pids-limit=128",
        "--memory=256m",
      ]),
      expect.anything(),
    );
    const calls = vi.mocked(command).mock.calls.length;
    await runner(message().descriptor.payload, source, new AbortController().signal);
    expect(vi.mocked(command).mock.calls).toHaveLength(calls);
  });

  it("durably deduplicates admission, retries callback after restart and rejects forged results", async () => {
    const directory = mkdtempSync(join(tmpdir(), "algocove-host-test-"));
    const journalPath = join(directory, "host.sqlite");
    const runner = vi.fn(async () => ({
      category: "pass" as const,
      phase: "run" as const,
      teardownConfirmed: true,
    }));
    const fail = vi.fn(async () => {
      throw new Error("lost callback");
    });
    const received: Parameters<typeof verifyCommittedExecutionResult>[0][] = [];
    let host = await createLocalSourceHost({
      journalPath,
      key,
      verificationKeys: keys,
      images,
      runner,
      deliver: fail,
    });
    try {
      const dispatch = message();
      await host.dispatch({ message: dispatch, source });
      await host.drain();
      expect((await host.dispatch({ message: dispatch, source })).replayed).toBe(true);
      await host.drain();
      expect(runner).toHaveBeenCalledTimes(1);
      await host.close();
      host = await createLocalSourceHost({
        journalPath,
        key,
        verificationKeys: keys,
        images,
        runner,
        deliver: async (result) => {
          received.push(result);
        },
      });
      await host.drain();
      expect(received).toHaveLength(1);
      const result = received[0]!;
      const run = {
        ...request,
        terminalResultId: null,
        terminalCategory: null,
        classification: null,
        completedAt: null,
      };
      expect(
        verifyCommittedExecutionResult(result, dispatch, run, keys, new Date().toISOString())
          .terminalCategory,
      ).toBe("pass");
      expect(() =>
        verifyCommittedExecutionResult(
          { ...result, signature: "forged" },
          dispatch,
          run,
          keys,
          new Date().toISOString(),
        ),
      ).toThrow();
      expect(() =>
        verifyCommittedExecutionResult(
          result,
          { ...dispatch, dispatchKey: "other" },
          run,
          keys,
          new Date().toISOString(),
        ),
      ).toThrow();
      expect(runner).toHaveBeenCalledTimes(1);
    } finally {
      await host.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("retains cancel-before-admission across host restarts", async () => {
    const directory = mkdtempSync(join(tmpdir(), "algocove-cancel-test-"));
    const options = {
      journalPath: join(directory, "host.sqlite"),
      key,
      verificationKeys: keys,
      images,
      runner: vi.fn(async () => ({
        category: "pass" as const,
        phase: "run" as const,
        teardownConfirmed: true,
      })),
      deliver: async () => {},
    };
    let host = await createLocalSourceHost(options);
    try {
      await host.cancel({ runId: request.runId, reason: "learner" });
      await host.close();
      host = await createLocalSourceHost(options);
      await expect(host.dispatch({ message: message(), source })).rejects.toThrow("cancelled");
      expect(options.runner).not.toHaveBeenCalled();
    } finally {
      await host.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("waits for active teardown before acknowledging privacy cancellation", async () => {
    const directory = mkdtempSync(join(tmpdir(), "algocove-privacy-cancel-"));
    let started!: () => void, finish!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const ended = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const host = await createLocalSourceHost({
      journalPath: join(directory, "host.sqlite"),
      key,
      verificationKeys: keys,
      images,
      runner: async (_descriptor, _source, signal) => {
        started();
        await ended;
        expect(signal.aborted).toBe(true);
        return { category: "pass", phase: "run", teardownConfirmed: true };
      },
      deliver: async () => {},
    });
    try {
      await host.dispatch({ message: message(), source });
      await ready;
      let acknowledged = false;
      const cancelled = host.cancel({ runId: request.runId, reason: "system" }).then(() => {
        acknowledged = true;
      });
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(acknowledged).toBe(false);
      finish();
      await cancelled;
      expect(acknowledged).toBe(true);
      await host.drain();
    } finally {
      finish();
      await host.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("refuses privacy cancellation acknowledgement when teardown is unconfirmed, including after restart", async () => {
    const directory = mkdtempSync(join(tmpdir(), "algocove-privacy-teardown-"));
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const options = {
      journalPath: join(directory, "host.sqlite"),
      key,
      verificationKeys: keys,
      images,
      runner: async () => {
        started();
        return {
          category: "infrastructure_error" as const,
          phase: "run" as const,
          teardownConfirmed: false,
        };
      },
      deliver: async () => {},
    };
    let host = await createLocalSourceHost(options);
    try {
      await host.dispatch({ message: message(), source });
      await ready;
      await host.drain();
      await expect(host.cancel({ runId: request.runId, reason: "system" })).rejects.toThrow(
        "unconfirmed",
      );
      await host.close();
      host = await createLocalSourceHost(options);
      await expect(host.cancel({ runId: request.runId, reason: "system" })).rejects.toThrow(
        "unconfirmed",
      );
    } finally {
      await host.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
