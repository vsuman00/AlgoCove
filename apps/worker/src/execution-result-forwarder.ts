import { err } from "@algocove/domain";
import type { SignedExecutionResult } from "@algocove/execution-contracts";
import {
  controlFailure,
  type ControlResult,
  type ExecutionControlResponse,
  type ExecutionControlServer,
  type LifecycleReceipt,
} from "@algocove/execution-control";

export type ExecutionResultSink = {
  /** The sink must deliver only after execution-control has committed terminal state. */
  readonly deliver: (result: SignedExecutionResult) => Promise<void>;
};

export type HttpExecutionResultSinkOptions = {
  readonly endpoint: string;
  readonly token: string;
  readonly fetch?: typeof fetch;
};

/** Adapter for the authenticated web callback; it carries only the signed result envelope. */
export function createHttpExecutionResultSink(
  options: HttpExecutionResultSinkOptions,
): ExecutionResultSink {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("Worker result callback requires fetch.");
  return {
    async deliver(result): Promise<void> {
      const response = await fetchImpl(options.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ result }),
      });
      if (!response.ok)
        throw new Error(`Execution result callback failed with ${response.status}.`);
    },
  };
}

export type WorkerResultInput = {
  readonly token: string;
  readonly workerId: string;
  readonly runId: SignedExecutionResult["payload"]["runId"];
  readonly leaseEpoch: number;
  readonly result: SignedExecutionResult;
  readonly now: string;
};

/**
 * Verify, teardown, and forward one worker result in that order. A retry after
 * a sink timeout observes the already-terminal control record and forwards the
 * same signed result again; it never creates a second terminal effect.
 */
export async function forwardExecutionResult(
  server: ExecutionControlServer,
  sink: ExecutionResultSink,
  input: WorkerResultInput,
): Promise<ControlResult<ExecutionControlResponse>> {
  const recorded = await server.handle({
    source: "internal",
    principal: "execution-worker",
    token: input.token,
    operation: { kind: "record_result", result: input.result, now: input.now },
  });
  if (!recorded.ok) return recorded;

  const recordedReceipt = lifecycleReceipt(recorded.value);
  if (recordedReceipt === null) {
    return err(
      controlFailure("invalid_state", "Execution-control did not return a lifecycle receipt."),
    );
  }
  if (recordedReceipt.state === "terminal") {
    await deliverTerminal(sink, recordedReceipt);
    return recorded;
  }

  const confirmed = await server.handle({
    source: "internal",
    principal: "execution-worker",
    token: input.token,
    operation: {
      kind: "confirm_teardown",
      runId: input.runId,
      workerId: input.workerId,
      leaseEpoch: input.leaseEpoch,
      now: input.now,
    },
  });
  if (!confirmed.ok) return confirmed;
  const confirmedReceipt = lifecycleReceipt(confirmed.value);
  if (confirmedReceipt === null) {
    return err(controlFailure("invalid_state", "Execution-control did not return terminal state."));
  }
  await deliverTerminal(sink, confirmedReceipt);
  return confirmed;
}

export async function forwardTeardownFailure(
  server: ExecutionControlServer,
  sink: ExecutionResultSink,
  input: Omit<WorkerResultInput, "result">,
): Promise<ControlResult<ExecutionControlResponse>> {
  const response = await server.handle({
    source: "internal",
    principal: "execution-worker",
    token: input.token,
    operation: {
      kind: "teardown_failed",
      runId: input.runId,
      workerId: input.workerId,
      leaseEpoch: input.leaseEpoch,
      now: input.now,
    },
  });
  if (!response.ok) return response;
  const receipt = lifecycleReceipt(response.value);
  if (receipt === null) {
    return err(controlFailure("invalid_state", "Execution-control did not return teardown state."));
  }
  await deliverTerminal(sink, receipt);
  return response;
}

async function deliverTerminal(
  sink: ExecutionResultSink,
  receipt: LifecycleReceipt,
): Promise<void> {
  if (receipt.terminalResult === undefined) {
    throw new Error("Execution-control terminal receipt is missing its signed result.");
  }
  await sink.deliver(receipt.terminalResult);
}

function lifecycleReceipt(value: ExecutionControlResponse): LifecycleReceipt | null {
  return value !== null && "state" in value && "leaseEpoch" in value
    ? (value as LifecycleReceipt)
    : null;
}
