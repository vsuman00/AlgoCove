import { CHUNK_POLICY_VERSION } from "@algocove/content";
import { fixtureEmbeddingPort } from "@algocove/retrieval";
import { createContentJobConsumers } from "./content-jobs.ts";
import { randomBytes } from "node:crypto";
import {
  createActor,
  createRequestContext,
  createSystemClock,
  type IdGenerator,
} from "@algocove/application";
import { formatId, parseId, parseRole } from "@algocove/domain";
import {
  createPool,
  PostgresOutboxRelayRepository,
  PostgresWorkerEffectsRepository,
  PostgresWorkerOperationsRepository,
} from "@algocove/db";
import { createWorkerJobHandlers } from "./job-handlers.ts";
import { WorkerJobRelay } from "./job-relay.ts";

const usage =
  "worker consume [limit] | inspect <actorId> [limit] | enqueue <actorId> <reconcile|retention> [limit] | replay <actorId> <eventId> <expectedAttempts> <reason> | index <actorId> <contentVersionId> <derive|embed>";
function bounded(value: string | undefined, fallback: number, max: number): number {
  const n = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || n > max) throw Error("Invalid command bound.");
  return n;
}
async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (command === "--help" || command === undefined) {
    process.stdout.write(usage + "\n");
    return;
  }
  if (!["consume", "inspect", "enqueue", "replay", "index"].includes(command))
    throw Error("Unsupported worker command.");
  try {
    process.loadEnvFile();
  } catch {
    /* Operators may supply environment directly. */
  }
  const url =
    process.env[command === "consume" ? "WORKER_DATABASE_URL" : "WORKER_OPERATIONS_DATABASE_URL"];
  if (!url?.trim()) throw Error("Worker database connection is required.");
  const retention = process.env.WORKER_RETENTION_ENABLED ?? "false";
  if (retention !== "true" && retention !== "false") throw Error("Invalid retention flag.");
  const content = process.env.WORKER_CONTENT_ENABLED ?? "false";
  const embedding = process.env.WORKER_EMBEDDING_MODE ?? "disabled";
  if (
    !["true", "false"].includes(content) ||
    !["disabled", "fixture"].includes(embedding) ||
    (embedding === "fixture" &&
      (content !== "true" || !["development", "test"].includes(process.env.NODE_ENV ?? ""))) ||
    (content === "true" && retention === "true")
  )
    throw Error("Invalid content worker configuration.");
  const pool = createPool({
    connectionString: url,
    applicationName: "algocove-worker",
    maxConnections: 2,
    statementTimeoutMs: 2000,
  });
  const clock = createSystemClock();
  const ids: IdGenerator = {
    generate(kind) {
      const result = formatId(kind, randomBytes(20).toString("hex"));
      if (!result.ok) throw Error("Identifier generation failed.");
      return result.value;
    },
  };
  try {
    if (command === "consume") {
      if (args.length > 1) throw Error("Invalid consumer arguments.");
      const limit = bounded(args[0], 100, 1000),
        relayId = "worker-" + randomBytes(12).toString("hex");
      const registry = createWorkerJobHandlers({
        effects: new PostgresWorkerEffectsRepository(pool),
        relayId,
        clock,
        enableRetention: retention === "true",
        ...(content === "true"
          ? {
              modules: createContentJobConsumers({
                pool,
                relayId,
                clock,
                fixtureEmbeddings: embedding === "fixture",
              }),
            }
          : {}),
      });
      const relay = new WorkerJobRelay(new PostgresOutboxRelayRepository(pool), registry, {
        relayId,
        clock,
      });
      let stopped = false;
      const stop = () => {
        stopped = true;
      };
      process.on("SIGTERM", stop);
      process.on("SIGINT", stop);
      try {
        for (let n = 0; n < limit && !stopped; n++) {
          await pool.query(
            "INSERT INTO platform.service_heartbeat(service,observed_at) VALUES('content-worker',clock_timestamp()) ON CONFLICT(service) DO UPDATE SET observed_at=EXCLUDED.observed_at",
          );
          const result = await relay.pumpOnce();
          process.stdout.write(JSON.stringify(result) + "\n");
          if (result.kind === "idle") break;
        }
      } finally {
        process.off("SIGTERM", stop);
        process.off("SIGINT", stop);
      }
      return;
    }
    const actor = parseId("learner", args[0]);
    if (!actor.ok) throw Error("Valid operator actor identity required.");
    const grant = await pool.query<{ role: string }>(
      "SELECT role FROM platform.role_grant WHERE learner_id=$1 AND revoked_at IS NULL",
      [actor.value],
    );
    const roles = grant.rows.map((row) => {
      const role = parseRole(row.role);
      if (!role.ok) throw Error("Invalid stored role.");
      return role.value;
    });
    const context = createRequestContext({
      actor: createActor({ userId: actor.value, sessionId: ids.generate("session"), roles }),
      clock,
      ids,
      serviceName: "algocove-worker-operations",
    });
    const operations = new PostgresWorkerOperationsRepository(pool);
    if (command === "index") {
      const version = parseId("contentVersion", args[1]);
      if (args.length !== 3 || !version.ok || !["derive", "embed"].includes(args[2] ?? ""))
        throw Error("Invalid content indexing arguments.");
      if (args[2] === "embed" && embedding !== "fixture")
        throw Error("An explicitly configured embedding consumer is required.");
      const source = await pool.query<{ checksum: string }>(
        "SELECT checksum FROM content.content_version WHERE content_version_id=$1",
        [version.value],
      );
      if (!source.rows[0]) throw Error("Content unavailable.");
      const eventId = await operations.registerDerivation(context, {
        contentVersionId: version.value,
        sourceChecksum: source.rows[0].checksum,
        policyVersion:
          args[2] === "derive"
            ? CHUNK_POLICY_VERSION
            : fixtureEmbeddingPort.configuration.policyVersion,
        topic:
          args[2] === "derive" ? "content.derivation.requested" : "content.embedding.requested",
      });
      process.stdout.write(JSON.stringify({ kind: "enqueued", eventId }) + "\n");
    } else if (command === "inspect") {
      if (args.length > 2) throw Error("Invalid inspection arguments.");
      process.stdout.write(
        JSON.stringify(await operations.inspect(context, bounded(args[1], 100, 500))) + "\n",
      );
    } else if (command === "enqueue") {
      if (args.length < 2 || args.length > 3 || !["reconcile", "retention"].includes(args[1] ?? ""))
        throw Error("Invalid maintenance arguments.");
      const privacy = args[1] === "retention";
      const eventId = await operations.enqueue(
        context,
        privacy ? "privacy.retention.requested" : "platform.reconciliation.requested",
        {
          schemaVersion: 1,
          scope: privacy ? "expired_drafts" : "outbox_and_derivations",
          limit: bounded(args[2], 100, 500),
        },
      );
      process.stdout.write(JSON.stringify({ kind: "enqueued", eventId }) + "\n");
    } else {
      if (args.length !== 4) throw Error("Invalid replay arguments.");
      await operations.replay(context, {
        eventId: args[1]!,
        expectedAttempts: bounded(args[2], 0, 2147483647),
        reason: args[3]!,
      });
      process.stdout.write(JSON.stringify({ kind: "replayed", eventId: args[1] }) + "\n");
    }
  } finally {
    await pool.end();
  }
}
await main().catch((error) => {
  // Never log arbitrary database/provider errors, connection strings or payloads.
  const known =
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    ["forbidden", "invalid_request", "version_conflict", "not_found"].includes(error.code)
      ? error.code
      : "command_failed";
  process.stderr.write(JSON.stringify({ event: "worker.command_failed", code: known }) + "\n");
  process.exitCode = 1;
});
