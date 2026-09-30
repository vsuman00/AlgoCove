import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { parseContentChecksum, parseId, parseInstant, PROBLEM_LANGUAGES } from "@algocove/domain";
import type { WebsiteExecutionRelay, WebsiteExecutionRun } from "./website-relay.ts";

/** Website-facing relay API, restricted to a local server caller with an internal token. */
export async function startLoopbackWebsiteExecutionRelay(
  relay: WebsiteExecutionRelay,
  token: string,
  port = 0,
): Promise<{ baseUrl: string; close(): Promise<void> }> {
  if (token.length < 16 || token.length > 4096 || /\s/.test(token))
    throw new Error("Invalid relay token.");
  const expectedToken = Buffer.from(`Bearer ${token}`);
  const server = createServer(async (request, response) => {
    const send = (status: number, body: unknown) => {
      response.writeHead(status, {
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      response.end(JSON.stringify(body));
    };
    const path = request.url ?? "";
    const route = /^\/v1\/runs\/([^/]+)\/(dispatch|cancel)$/.exec(path);
    if (request.method !== "POST" || (path !== "/v1/runs/prepare" && route === null)) {
      send(404, { error: "not_found" });
      return;
    }
    const auth = Buffer.from(request.headers.authorization ?? "");
    if (auth.length !== expectedToken.length || !timingSafeEqual(auth, expectedToken)) {
      send(401, { error: "internal_auth_failed" });
      return;
    }
    try {
      const body = await readBody(request, route?.[2] === "dispatch" ? 6_400_000 : 65_536);
      if (path === "/v1/runs/prepare") {
        exactKeys(body, ["eventId", "run"]);
        const event = parseId("event", body.eventId);
        if (!event.ok) throw new Error("Invalid event.");
        send(200, relay.prepare(parseRun(body.run), event.value));
        return;
      }
      const run = parseId("codeRun", route?.[1]);
      if (!run.ok || body.runId !== run.value) throw new Error("Run mismatch.");
      if (route?.[2] === "dispatch") {
        exactKeys(body, ["runId", "source", "dispatchToken"]);
        if (
          typeof body.source !== "string" ||
          Buffer.byteLength(body.source) > 1_048_576 ||
          typeof body.dispatchToken !== "string" ||
          body.dispatchToken.length !== 64
        )
          throw new Error("Invalid source dispatch.");
        send(200, await relay.dispatch(run.value, body.dispatchToken, body.source));
      } else {
        exactKeys(body, ["runId", "reason"]);
        if (body.reason !== "learner" && body.reason !== "system" && body.reason !== "timeout")
          throw new Error("Invalid cancellation.");
        await relay.cancel(run.value, body.reason);
        send(200, { runId: run.value });
      }
    } catch {
      send(400, { error: "execution_relay_request_failed" });
    }
  });
  server.requestTimeout = 5_000;
  server.headersTimeout = 5_000;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}/`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

async function readBody(
  request: IncomingMessage,
  maximum: number,
): Promise<Record<string, unknown>> {
  if (request.headers["content-type"]?.split(";")[0] !== "application/json")
    throw new Error("JSON required.");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > maximum) throw new Error("Request too large.");
    chunks.push(bytes);
  }
  const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!isRecord(body)) throw new Error("Object required.");
  return body;
}

function parseRun(value: unknown): WebsiteExecutionRun {
  if (!isRecord(value)) throw new Error("Run required.");
  exactKeys(value, [
    "runId",
    "learnerId",
    "attemptId",
    "problemVersionId",
    "manifestId",
    "language",
    "mode",
    "sourceChecksum",
    "sourceLength",
    "requestedAt",
  ]);
  const runId = parseId("codeRun", value.runId);
  const learnerId = parseId("learner", value.learnerId);
  const attemptId = parseId("attempt", value.attemptId);
  const problemVersionId = parseId("problemVersion", value.problemVersionId);
  const manifestId = parseId("languageManifest", value.manifestId);
  const checksum = parseContentChecksum(value.sourceChecksum);
  const requestedAt = parseInstant(value.requestedAt);
  if (
    !runId.ok ||
    !learnerId.ok ||
    !attemptId.ok ||
    !problemVersionId.ok ||
    !manifestId.ok ||
    !checksum.ok ||
    !requestedAt.ok ||
    !PROBLEM_LANGUAGES.includes(value.language as WebsiteExecutionRun["language"]) ||
    (value.mode !== "run" && value.mode !== "submit") ||
    typeof value.sourceLength !== "number" ||
    !Number.isSafeInteger(value.sourceLength) ||
    value.sourceLength < 0 ||
    value.sourceLength > 1_048_576
  )
    throw new Error("Invalid run metadata.");
  return {
    runId: runId.value,
    learnerId: learnerId.value,
    attemptId: attemptId.value,
    problemVersionId: problemVersionId.value,
    manifestId: manifestId.value,
    language: value.language as WebsiteExecutionRun["language"],
    mode: value.mode,
    sourceChecksum: checksum.value,
    sourceLength: value.sourceLength,
    requestedAt: requestedAt.value,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): void {
  if (
    Object.keys(value).length !== keys.length ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    throw new Error("Unknown relay field.");
}
