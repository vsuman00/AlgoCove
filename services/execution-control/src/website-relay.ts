import { randomBytes, timingSafeEqual } from "node:crypto";
import type {
  Instant,
  LanguageManifestId,
  OpaqueId,
  ProblemLanguage,
  ProblemVersionId,
} from "@algocove/domain";
import { sha256Digest, type VerificationKey } from "@algocove/execution-contracts";
import { createExecutionDispatchMessage, type ExecutionDispatchMessage } from "./relay.ts";

export type WebsiteExecutionRun = {
  readonly runId: OpaqueId<"codeRun">;
  readonly learnerId: OpaqueId<"learner">;
  readonly attemptId: OpaqueId<"attempt">;
  readonly problemVersionId: ProblemVersionId;
  readonly manifestId: LanguageManifestId;
  readonly language: ProblemLanguage;
  readonly mode: "run" | "submit";
  readonly sourceChecksum: string;
  readonly sourceLength: number;
  readonly requestedAt: Instant;
};

export type IsolatedSourceHost = {
  /** The isolated host owns durable admission and deduplication before execution. */
  dispatch(input: {
    readonly message: ExecutionDispatchMessage;
    readonly source: string;
  }): Promise<{ readonly runId: WebsiteExecutionRun["runId"]; readonly replayed: boolean }>;
  cancel(input: {
    readonly runId: WebsiteExecutionRun["runId"];
    readonly reason: "learner" | "system" | "timeout";
  }): Promise<void>;
};

export type WebsiteRelayOptions = {
  /** Resolve only reviewed manifests, fixtures, image digests and server-owned quotas. */
  readonly prepareDescriptor: (
    run: WebsiteExecutionRun,
    eventId: OpaqueId<"event">,
  ) => ExecutionDispatchMessage;
  readonly verificationKeys: ReadonlyMap<string, VerificationKey>;
  readonly host: IsolatedSourceHost;
  readonly now: () => string;
  readonly maxPreparations?: number;
};

type DispatchReceipt = { readonly runId: WebsiteExecutionRun["runId"]; readonly replayed: boolean };
type Preparation = {
  readonly identity: string;
  readonly run: WebsiteExecutionRun;
  readonly message: ExecutionDispatchMessage;
  readonly response: {
    readonly runId: WebsiteExecutionRun["runId"];
    readonly dispatchToken: string;
    readonly outbox: {
      readonly eventId: OpaqueId<"event">;
      readonly aggregateId: WebsiteExecutionRun["attemptId"];
      readonly topic: "execution.run.requested";
      readonly occurredAt: string;
      readonly payload: ExecutionDispatchMessage;
    };
  };
  cancelled: boolean;
  dispatch?: Promise<DispatchReceipt>;
  receipt?: DispatchReceipt;
};

export type WebsiteExecutionRelay = {
  prepare(run: WebsiteExecutionRun, eventId: OpaqueId<"event">): Preparation["response"];
  dispatch(
    runId: WebsiteExecutionRun["runId"],
    token: string,
    source: string,
  ): Promise<DispatchReceipt>;
  cancel(
    runId: WebsiteExecutionRun["runId"],
    reason: "learner" | "system" | "timeout",
  ): Promise<void>;
};

/** Process-local source handoff. Raw source is never retained in preparations or journals. */
export function createWebsiteExecutionRelay(options: WebsiteRelayOptions): WebsiteExecutionRelay {
  const maximum = options.maxPreparations ?? 100;
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 1000)
    throw new Error("Invalid preparation capacity.");
  const preparations = new Map<string, Preparation>();
  const cancelledRuns = new Set<string>();
  return {
    prepare(run: WebsiteExecutionRun, eventId: OpaqueId<"event">) {
      if (cancelledRuns.has(run.runId)) throw new Error("Run preparation unavailable.");
      const now = options.now();
      for (const [key, preparation] of preparations) {
        if (
          !preparation.cancelled &&
          (preparation.dispatch === undefined || preparation.receipt !== undefined) &&
          Date.parse(preparation.message.descriptor.payload.expiresAt) <= Date.parse(now)
        )
          preparations.delete(key);
      }
      const identity = JSON.stringify({ run, eventId });
      const previous = preparations.get(run.runId);
      if (previous !== undefined) {
        if (previous.identity !== identity) throw new Error("Run preparation conflict.");
        return previous.response;
      }
      if (preparations.size >= maximum) throw new Error("Preparation capacity reached.");
      if (!Number.isSafeInteger(run.sourceLength) || run.sourceLength < 0)
        throw new Error("Invalid source length.");
      const candidate = options.prepareDescriptor(run, eventId);
      const verified = createExecutionDispatchMessage({
        ...candidate,
        // Signing can cross a millisecond boundary. Verify after issuance.
        now: options.now(),
        verificationKeys: options.verificationKeys,
      });
      if (!verified.ok) throw new Error("Invalid server descriptor.");
      const message = verified.value;
      const descriptor = message.descriptor.payload;
      if (
        descriptor.runId !== run.runId ||
        descriptor.attemptId !== run.attemptId ||
        descriptor.problemVersionId !== run.problemVersionId ||
        descriptor.language !== run.language ||
        descriptor.sourceDigest !== run.sourceChecksum ||
        run.sourceLength > descriptor.limits.sourceLimitBytes
      )
        throw new Error("Server descriptor does not match the run.");
      const response = {
        runId: run.runId,
        dispatchToken: randomBytes(32).toString("hex"),
        outbox: {
          eventId,
          aggregateId: run.attemptId,
          topic: message.topic,
          occurredAt: now,
          payload: message,
        },
      };
      preparations.set(run.runId, {
        identity,
        run: structuredClone(run),
        message,
        response,
        cancelled: false,
      });
      return response;
    },
    async dispatch(
      runId: WebsiteExecutionRun["runId"],
      token: string,
      source: string,
    ): Promise<DispatchReceipt> {
      const preparation = preparations.get(runId);
      if (
        preparation === undefined ||
        preparation.cancelled ||
        Date.parse(options.now()) >= Date.parse(preparation.message.descriptor.payload.expiresAt)
      )
        throw new Error("Run preparation unavailable.");
      const actual = Buffer.from(token);
      const expected = Buffer.from(preparation.response.dispatchToken);
      if (
        actual.length !== expected.length ||
        !timingSafeEqual(actual, expected) ||
        Buffer.byteLength(source) !== preparation.run.sourceLength ||
        sha256Digest(source) !== preparation.run.sourceChecksum
      )
        throw new Error("Run source or token mismatch.");
      if (preparation.receipt !== undefined) return { ...preparation.receipt, replayed: true };
      // Retain a failed promise too: an uncertain dispatch must never launch a replacement.
      preparation.dispatch ??= Promise.resolve()
        .then(() => options.host.dispatch({ message: preparation.message, source }))
        .then((receipt) => {
          if (receipt.runId !== runId || typeof receipt.replayed !== "boolean")
            throw new Error("Isolated host returned an invalid receipt.");
          preparation.receipt = receipt;
          return receipt;
        });
      return preparation.dispatch;
    },
    async cancel(runId: WebsiteExecutionRun["runId"], reason: "learner" | "system" | "timeout") {
      if (!cancelledRuns.has(runId) && cancelledRuns.size >= maximum)
        throw new Error("Cancellation capacity reached.");
      cancelledRuns.add(runId);
      const preparation = preparations.get(runId);
      if (preparation !== undefined) preparation.cancelled = true;
      await options.host.cancel({ runId, reason });
    },
  };
}
