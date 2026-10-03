import { createServer, type Socket } from "node:net";
import { expect, it } from "vitest";
import { probeDatabase } from "@algocove/db";

it("bounds a database handshake that accepts TCP but never responds", async () => {
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("TCP listener unavailable");
  try {
    const started = Date.now();
    const result = await probeDatabase({
      connectionString: `postgres://runtime@127.0.0.1:${address.port}/algocove`,
      applicationName: "connect-deadline-check",
      maxConnections: 1,
      statementTimeoutMs: 200,
    });
    expect(result).toMatchObject({ ok: false, reason: "unreachable" });
    expect(Date.now() - started).toBeLessThan(2_000);
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
