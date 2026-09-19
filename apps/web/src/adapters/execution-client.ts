import type {
  CodeRunRequest,
  ExecutionRelay,
  ExecutionRelayPreparation,
} from "@algocove/application";
import type { OutboxEvent } from "@algocove/application";
import { parseId, parseInstant } from "@algocove/domain";
import { sha256Digest } from "@algocove/execution-contracts";

const EXECUTION_DISPATCH_TOPIC = "execution.run.requested";
const MAX_RELAY_TOKEN_LENGTH = 4_096;
const RELAY_REQUEST_TIMEOUT_MS = 5_000;
const FORBIDDEN_PAYLOAD_KEY = /^(?:source(?:Text|Code|Material)?|code|pseudocode|keystrokes)$/i;

export type HttpExecutionRelayOptions = {
  readonly baseUrl: string;
  readonly token: string;
  readonly fetch?: typeof fetch;
};

type DispatchPreparation = {
  readonly runId: CodeRunRequest["runId"];
  readonly dispatchToken: string;
};

/**
 * Server-only adapter for the internal execution relay.
 *
 * Preparation sends run metadata and the event identity only. Learner source
 * is checked locally and sent once, ephemerally, to the dispatch endpoint; it
 * is never included in the descriptor-only preparation response or outbox.
 */
export function createHttpExecutionRelay(options: HttpExecutionRelayOptions): ExecutionRelay {
  const baseUrl = parseBaseUrl(options.baseUrl);
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("Execution relay requires a fetch implementation.");
  }
  if (options.token.length < 16 || options.token.length > MAX_RELAY_TOKEN_LENGTH) {
    throw new Error("Execution relay token is outside the bounded length.");
  }

  const request = (path: string, body: unknown): Promise<unknown | null> =>
    postJson(fetchImpl, new URL(path, baseUrl), options.token, body);

  return {
    async prepare(input): Promise<ExecutionRelayPreparation> {
      validateSource(input.run, input.source);
      const response = await request("v1/runs/prepare", {
        eventId: input.eventId,
        run: input.run,
      });
      return {
        outbox: parsePreparation(response, input.run),
        token: parseDispatchPreparation(response, input.run),
      };
    },

    async dispatch(
      input,
    ): Promise<{ readonly runId: CodeRunRequest["runId"]; readonly replayed: boolean }> {
      validateSource(input.run, input.source);
      const preparation = parseDispatchPreparation(input.preparation.token, input.run);
      const response = await request(`v1/runs/${encodeURIComponent(input.run.runId)}/dispatch`, {
        runId: input.run.runId,
        source: input.source,
        dispatchToken: preparation.dispatchToken,
      });
      return parseDispatchReceipt(response, input.run);
    },

    async cancel(input): Promise<void> {
      const response = await request(`v1/runs/${encodeURIComponent(input.runId)}/cancel`, {
        runId: input.runId,
        reason: input.reason,
      });
      if (response === null) return;
      if (!isRecord(response) || response.runId !== input.runId) {
        throw new Error("Execution relay returned an invalid cancellation receipt.");
      }
    },
  };
}

function parseBaseUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value.endsWith("/") ? value : `${value}/`);
  } catch {
    throw new Error("Execution relay URL is invalid.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Execution relay URL must use HTTP or HTTPS.");
  }
  return url;
}

async function postJson(
  fetchImpl: typeof fetch,
  url: URL,
  token: string,
  body: unknown,
): Promise<unknown | null> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(RELAY_REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new Error("Execution relay request failed.");
  }
  if (!response.ok) throw new Error("Execution relay request failed.");
  if (response.status === 204) return null;
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new Error("Execution relay returned invalid JSON.");
  }
}

function validateSource(run: CodeRunRequest, source: string): void {
  if (Buffer.byteLength(source, "utf8") !== run.sourceLength) {
    throw new Error("Execution source length does not match the requested run.");
  }
  if (sha256Digest(source) !== run.sourceChecksum) {
    throw new Error("Execution source checksum does not match the requested run.");
  }
}

function parsePreparation(value: unknown, run: CodeRunRequest): OutboxEvent {
  if (!isRecord(value) || !isRecord(value.outbox)) {
    throw new Error("Execution relay preparation is invalid.");
  }
  const eventId = parseId("event", value.outbox.eventId);
  const occurredAt = parseInstant(value.outbox.occurredAt);
  if (
    !eventId.ok ||
    typeof value.outbox.aggregateId !== "string" ||
    value.outbox.aggregateId !== run.attemptId ||
    value.outbox.topic !== EXECUTION_DISPATCH_TOPIC ||
    !occurredAt.ok ||
    !isRecord(value.outbox.payload)
  ) {
    throw new Error("Execution relay preparation outbox is invalid.");
  }
  const payload = value.outbox.payload;
  const allowedKeys = new Set(["topic", "dispatchKey", "descriptor", "quota"]);
  if (
    Object.keys(payload).some((key) => !allowedKeys.has(key)) ||
    containsForbiddenPayloadKey(payload) ||
    !isRecord(payload.descriptor) ||
    !isRecord(payload.descriptor.payload) ||
    payload.descriptor.payload.runId !== run.runId ||
    payload.descriptor.payload.attemptId !== run.attemptId
  ) {
    throw new Error("Execution relay preparation must be descriptor-only and run-bound.");
  }
  return {
    eventId: eventId.value,
    topic: EXECUTION_DISPATCH_TOPIC,
    aggregateId: run.attemptId,
    payload,
    occurredAt: occurredAt.value,
  };
}

function parseDispatchPreparation(value: unknown, run: CodeRunRequest): DispatchPreparation {
  if (!isRecord(value) || typeof value.dispatchToken !== "string") {
    throw new Error("Execution relay dispatch preparation is invalid.");
  }
  if (
    value.dispatchToken.length === 0 ||
    value.dispatchToken.length > MAX_RELAY_TOKEN_LENGTH ||
    ("runId" in value && value.runId !== run.runId)
  ) {
    throw new Error("Execution relay dispatch preparation is not run-bound.");
  }
  return {
    runId: run.runId,
    dispatchToken: value.dispatchToken,
  };
}

function parseDispatchReceipt(
  value: unknown,
  run: CodeRunRequest,
): { readonly runId: CodeRunRequest["runId"]; readonly replayed: boolean } {
  if (!isRecord(value) || value.runId !== run.runId || typeof value.replayed !== "boolean") {
    throw new Error("Execution relay dispatch receipt is invalid.");
  }
  return { runId: run.runId, replayed: value.replayed };
}

function containsForbiddenPayloadKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenPayloadKey);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(
    ([key, nested]) => FORBIDDEN_PAYLOAD_KEY.test(key) || containsForbiddenPayloadKey(nested),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
