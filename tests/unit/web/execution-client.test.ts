import { describe, expect, it, vi } from "vitest";
import { formatId, parseInstant, type Result } from "@algocove/domain";
import { sha256Digest } from "@algocove/execution-contracts";
import { createHttpExecutionRelay } from "../../../apps/web/src/adapters/execution-client";

const source = "function solve(input) { return input; }";
const runId = must(formatId("codeRun", "aaaaaaaaaaaaaaaa"));
const attemptId = must(formatId("attempt", "bbbbbbbbbbbbbbbb"));
const learnerId = must(formatId("learner", "cccccccccccccccc"));
const problemVersionId = must(formatId("problemVersion", "dddddddddddddddd"));
const manifestId = must(formatId("languageManifest", "eeeeeeeeeeeeeeee"));
const eventId = must(formatId("event", "ffffffffffffffff"));
const requestedAt = must(parseInstant("2026-09-18T10:00:00.000Z"));

function must<T, F>(result: Result<T, F>): T {
  if (!result.ok) throw new Error("Invalid execution-client fixture.");
  return result.value;
}

function run() {
  return {
    runId,
    learnerId,
    attemptId,
    mode: "run" as const,
    problemVersionId,
    manifestId,
    language: "javascript" as const,
    sourceChecksum: sha256Digest(source),
    sourceLength: Buffer.byteLength(source, "utf8"),
    requestedAt,
  };
}

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function preparationResponse(overrides: Record<string, unknown> = {}) {
  return {
    runId,
    outbox: {
      eventId,
      topic: "execution.run.requested",
      aggregateId: attemptId,
      occurredAt: requestedAt,
      payload: {
        topic: "execution.run.requested",
        dispatchKey: "dispatch-key",
        descriptor: {
          algorithm: "ed25519",
          keyId: "execution-key",
          payload: {
            runId,
            attemptId,
            problemVersionId,
            language: "javascript",
            sourceDigest: sha256Digest(source),
          },
          signature: "signature",
        },
        quota: { quotaKey: `learner:${learnerId}`, profileId: "javascript", maxConcurrent: 1 },
      },
    },
    dispatchToken: "dispatch-token",
    ...overrides,
  };
}

describe("HTTP execution relay adapter", () => {
  it("keeps preparation descriptor-only and sends source only on dispatch", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(preparationResponse()))
      .mockResolvedValueOnce(response({ runId, replayed: false }))
      .mockResolvedValueOnce(response(null, 204));
    const relay = createHttpExecutionRelay({
      baseUrl: "https://execution-relay.example/",
      token: "relay-token-2026-example",
      fetch: fetchMock as unknown as typeof fetch,
    });

    const preparation = await relay.prepare({ run: run(), source, eventId });
    const prepareBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(prepareBody).not.toHaveProperty("source");
    expect(prepareBody.run.sourceChecksum).toBe(sha256Digest(source));
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer relay-token-2026-example",
    });
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);

    await expect(relay.dispatch({ run: run(), source, preparation })).resolves.toEqual({
      runId,
      replayed: false,
    });
    const dispatchBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(dispatchBody).toMatchObject({ runId, source, dispatchToken: "dispatch-token" });

    await expect(relay.cancel({ runId, reason: "learner" })).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("rejects source mismatches before making an internal request", async () => {
    const fetchMock = vi.fn();
    const relay = createHttpExecutionRelay({
      baseUrl: "https://execution-relay.example",
      token: "relay-token-2026-example",
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(
      relay.prepare({ run: run(), source: source.toUpperCase(), eventId }),
    ).rejects.toThrow(/checksum does not match/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a relay response that tries to persist raw source material", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response(
        preparationResponse({
          outbox: {
            ...preparationResponse().outbox,
            payload: {
              ...preparationResponse().outbox.payload,
              source: "must-not-persist",
            },
          },
        }),
      ),
    );
    const relay = createHttpExecutionRelay({
      baseUrl: "https://execution-relay.example",
      token: "relay-token-2026-example",
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(relay.prepare({ run: run(), source, eventId })).rejects.toThrow(/descriptor-only/);
  });

  it("rejects a preparation for another event before the outbox can be saved", async () => {
    const prepared = preparationResponse();
    const fetchMock = vi.fn().mockResolvedValue(
      response({
        ...prepared,
        outbox: {
          ...prepared.outbox,
          eventId: must(formatId("event", "1111111111111111")),
        },
      }),
    );
    const relay = createHttpExecutionRelay({
      baseUrl: "https://execution-relay.example",
      token: "relay-token-2026-example",
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(relay.prepare({ run: run(), source, eventId })).rejects.toThrow(
      /outbox is invalid/,
    );
  });

  it("rejects a preparation receipt that labels the dispatch token for another run", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response({
        ...preparationResponse(),
        runId: must(formatId("codeRun", "1111111111111111")),
      }),
    );
    const relay = createHttpExecutionRelay({
      baseUrl: "https://execution-relay.example",
      token: "relay-token-2026-example",
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(relay.prepare({ run: run(), source, eventId })).rejects.toThrow(/not run-bound/);
  });

  it.each([
    ["source digest", { sourceDigest: sha256Digest("different source") }],
    ["problem version", { problemVersionId: must(formatId("problemVersion", "1111111111111111")) }],
    ["language", { language: "python" }],
  ])("rejects a descriptor with a mismatched %s", async (_field, mismatch) => {
    const prepared = preparationResponse();
    const descriptor = prepared.outbox.payload.descriptor;
    const fetchMock = vi.fn().mockResolvedValue(
      response({
        ...prepared,
        outbox: {
          ...prepared.outbox,
          payload: {
            ...prepared.outbox.payload,
            descriptor: {
              ...descriptor,
              payload: { ...descriptor.payload, ...mismatch },
            },
          },
        },
      }),
    );
    const relay = createHttpExecutionRelay({
      baseUrl: "https://execution-relay.example",
      token: "relay-token-2026-example",
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(relay.prepare({ run: run(), source, eventId })).rejects.toThrow(/run-bound/);
  });
});
