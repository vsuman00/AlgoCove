import type { ExecutionDispatchSink } from "./outbox-relay.ts";

export type LocalExecutionControlSinkOptions = {
  readonly endpoint: string;
  readonly token: string;
  readonly now?: () => string;
  readonly fetch?: typeof fetch;
};

/** Delivers the application outbox to local control; acknowledgement requires a correlated receipt. */
export function createLocalExecutionControlSink(
  options: LocalExecutionControlSinkOptions,
): ExecutionDispatchSink {
  const endpoint = new URL(options.endpoint);
  if (
    endpoint.protocol !== "http:" ||
    endpoint.hostname !== "127.0.0.1" ||
    endpoint.pathname !== "/internal/execution/control" ||
    endpoint.username !== "" ||
    endpoint.password !== "" ||
    endpoint.search !== "" ||
    endpoint.hash !== ""
  )
    throw new Error("Local execution control requires its loopback control endpoint.");
  if (options.token.length < 16 || options.token.length > 4096 || /\s/.test(options.token)) {
    throw new Error("Local execution control requires a bounded internal token.");
  }
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const clock = options.now ?? (() => new Date().toISOString());
  return {
    async deliver(message): Promise<void> {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          principal: "application-relay",
          operation: {
            kind: "admit",
            dispatchKey: message.dispatchKey,
            descriptor: message.descriptor,
            quota: message.quota,
            now: clock(),
          },
        }),
        redirect: "error",
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) throw new Error("Local execution admission failed.");
      const result = (await response.json()) as { ok?: unknown; value?: Record<string, unknown> };
      const receipt = result?.value;
      if (
        result?.ok !== true ||
        receipt === undefined ||
        receipt === null ||
        receipt.runId !== message.descriptor.payload.runId ||
        receipt.quotaKey !== message.quota.quotaKey ||
        receipt.profileId !== message.quota.profileId ||
        typeof receipt.replayed !== "boolean" ||
        !Number.isSafeInteger(receipt.leaseEpoch) ||
        (receipt.leaseEpoch as number) < message.descriptor.payload.leaseEpoch ||
        ![
          "queued",
          "leased",
          "running",
          "cancellation_requested",
          "awaiting_teardown",
          "orphaned",
          "terminal",
        ].includes(receipt.state as string) ||
        (receipt.replayed === false && receipt.state !== "queued")
      )
        throw new Error("Local execution admission receipt does not match the dispatch.");
    },
  };
}
