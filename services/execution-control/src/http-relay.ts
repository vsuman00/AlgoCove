import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { ExecutionControlServer } from "./server.ts";
import type { InternalOperation, InternalPrincipal } from "./types.ts";

const MAX_REQUEST_BYTES = 256 * 1024;
const PRINCIPALS = new Set<InternalPrincipal>([
  "application-relay",
  "execution-worker",
  "execution-operator",
]);
const OPERATIONS = new Set<InternalOperation["kind"]>([
  "admit",
  "lease_next",
  "mark_running",
  "heartbeat",
  "worker_lost",
  "record_result",
  "confirm_teardown",
  "teardown_failed",
  "cancel",
  "reconcile",
]);

/** Internal control transport. It binds only to loopback and accepts no learner source. */
export async function startLoopbackExecutionRelay(
  control: ExecutionControlServer,
  port = 0,
): Promise<{ url: string; close(): Promise<void> }> {
  const server: Server = createServer(async (request, response) => {
    const send = (status: number, value: unknown) => {
      response.writeHead(status, {
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      response.end(JSON.stringify(value));
    };
    if (request.method !== "POST" || request.url !== "/internal/execution/control") {
      send(404, { error: "not_found" });
      return;
    }
    const auth = request.headers.authorization;
    if (auth === undefined || !/^Bearer [^\s]+$/.test(auth)) {
      send(401, { error: "internal_auth_failed" });
      return;
    }
    let body = "";
    try {
      for await (const chunk of request) {
        body += chunk.toString("utf8");
        if (Buffer.byteLength(body) > MAX_REQUEST_BYTES) {
          send(413, { error: "request_too_large" });
          return;
        }
      }
      const parsed = JSON.parse(body) as { principal?: unknown; operation?: unknown };
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        !PRINCIPALS.has(parsed.principal as InternalPrincipal) ||
        typeof parsed.operation !== "object" ||
        parsed.operation === null ||
        !OPERATIONS.has(
          (parsed.operation as { kind?: unknown }).kind as InternalOperation["kind"],
        ) ||
        /"(?:source|sourceCode|learnerSource)"\s*:/.test(body)
      ) {
        send(400, { error: "invalid_request" });
        return;
      }
      try {
        const result = await control.handle({
          source: "internal",
          principal: parsed.principal as InternalPrincipal,
          token: auth.slice(7),
          operation: parsed.operation as InternalOperation,
        });
        send(result.ok ? 200 : result.error.code === "internal_auth_failed" ? 401 : 400, result);
      } catch {
        send(503, { error: "control_unavailable" });
      }
    } catch {
      send(400, { error: "invalid_request" });
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${address.port}/internal/execution/control`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}
