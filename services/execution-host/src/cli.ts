import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { randomBytes } from "node:crypto";
import {
  generateSigningKeyPair,
  importSigningKeyPair,
  type VerificationKey,
} from "@algocove/execution-contracts";
import {
  createWebsiteExecutionRelay,
  startLoopbackWebsiteExecutionRelay,
  startLoopbackExecutionRelay,
  createExecutionControlServer,
  createInternalAuthenticator,
} from "@algocove/execution-control";
import { createContainerDescriptorPolicy } from "./container-problem.ts";
import { createLocalSourceHost } from "./local-host.ts";
import { dockerCommand } from "./docker-runner.ts";
import { PROBLEM_LANGUAGES, type ProblemLanguage } from "@algocove/domain";

if (process.platform !== "linux" || process.env.ALGO_COVE_LOCAL_EXECUTION !== "1")
  throw new Error("Explicit local Linux execution opt-in required.");
for (const name of ["DATABASE_URL", "DATABASE_ADMIN_URL", "CLERK_SECRET_KEY", "OPENAI_API_KEY"])
  if (process.env[name])
    throw new Error("Application credentials must not enter the isolated host.");
const callbackUrl = new URL(
  process.env.LOCAL_RESULT_CALLBACK_URL ?? "http://127.0.0.1:3301/api/internal/practice/results",
);
if (
  callbackUrl.protocol !== "http:" ||
  !["127.0.0.1", "host.lima.internal"].includes(callbackUrl.hostname) ||
  callbackUrl.pathname !== "/api/internal/practice/results" ||
  callbackUrl.username ||
  callbackUrl.password ||
  callbackUrl.search ||
  callbackUrl.hash
)
  throw new Error("Local callback URL required.");
const callbackToken = process.env.LOCAL_RESULT_CALLBACK_TOKEN;
if (callbackToken === undefined || callbackToken.length < 32)
  throw new Error("Local callback token required.");
const directory = resolve(process.env.LOCAL_EXECUTION_STATE_DIR ?? ".tmp/execution-host");
mkdirSync(directory, { recursive: true, mode: 0o700 });
const keyFile = join(directory, "key.local.json");
if (!existsSync(keyFile)) {
  const generated = generateSigningKeyPair("local-f5-v1");
  writeFileSync(
    keyFile,
    JSON.stringify({
      keyId: generated.keyId,
      privateKey: generated.privateKey.export({ type: "pkcs8", format: "pem" }),
      publicKey: generated.publicKey.export({ type: "spki", format: "pem" }),
      relayToken: randomBytes(32).toString("hex"),
    }),
    { mode: 0o600 },
  );
}
const saved = JSON.parse(readFileSync(keyFile, "utf8")) as {
  keyId: string;
  privateKey: string;
  publicKey: string;
  relayToken: string;
};
const key = importSigningKeyPair(saved.keyId, saved.privateKey, saved.publicKey);
const verificationKeys = new Map<string, VerificationKey>([
  [key.keyId, { keyId: key.keyId, publicKey: key.publicKey, status: "active" }],
]);
const imageFile = process.env.LOCAL_EXECUTION_IMAGES_FILE;
if (imageFile === undefined) throw new Error("Reviewed immutable image mapping required.");
const images = JSON.parse(readFileSync(imageFile, "utf8")) as Record<ProblemLanguage, string>;
for (const language of PROBLEM_LANGUAGES)
  if (
    typeof images[language] !== "string" ||
    !/^(?:[a-z0-9./:_-]+@)?sha256:[a-f0-9]{64}$/.test(images[language])
  )
    throw new Error("Immutable image mapping invalid.");
const runtime = await dockerCommand(["info", "--format", "{{json .Runtimes}}"]);
if (runtime.code !== 0 || !("runsc" in JSON.parse(runtime.stdout)))
  throw new Error("Approved runsc runtime unavailable.");
const host = await createLocalSourceHost({
  journalPath: join(directory, "journal.sqlite"),
  key,
  verificationKeys,
  images,
  deliver: async (result) => {
    const response = await fetch(callbackUrl, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${callbackToken}` },
      body: JSON.stringify({ result }),
    });
    if (!response.ok) {
      let code = "unknown";
      try {
        const body: unknown = await response.json();
        if (
          typeof body === "object" &&
          body !== null &&
          "error" in body &&
          typeof body.error === "object" &&
          body.error !== null &&
          "code" in body.error &&
          typeof body.error.code === "string"
        )
          code = body.error.code;
      } catch {
        /* Status and a generic code are sufficient for safe operational diagnosis. */
      }
      throw new Error("Local result callback failed: HTTP " + response.status + ", code=" + code);
    }
  },
});
const relay = createWebsiteExecutionRelay({
  host,
  verificationKeys,
  prepareDescriptor: createContainerDescriptorPolicy(key, images, () => new Date().toISOString()),
  now: () => new Date().toISOString(),
});
const transport = await startLoopbackWebsiteExecutionRelay(
  relay,
  saved.relayToken,
  Number(process.env.LOCAL_EXECUTION_PORT ?? 3302),
);
const internalTransport = await startLoopbackExecutionRelay(
  createExecutionControlServer(
    host.control,
    createInternalAuthenticator({
      "application-relay": saved.relayToken,
      "execution-worker": randomBytes(32).toString("hex"),
      "execution-operator": randomBytes(32).toString("hex"),
    }),
  ),
  Number(process.env.LOCAL_EXECUTION_CONTROL_PORT ?? 3303),
);
writeFileSync(
  join(directory, "connection.local.json"),
  JSON.stringify({
    relayUrl: transport.baseUrl,
    relayToken: saved.relayToken,
    verificationKeys: JSON.stringify([{ keyId: key.keyId, publicKey: saved.publicKey }]),
    internalRelayUrl: internalTransport.url,
  }),
  { mode: 0o600 },
);
process.stdout.write(
  `Local gVisor host ready on ${transport.baseUrl}; connection file written with private permissions.\n`,
);
const close = async () => {
  await transport.close();
  await internalTransport.close();
  await host.close();
  process.exit(0);
};
process.once("SIGTERM", () => {
  void close();
});
process.once("SIGINT", () => {
  void close();
});
