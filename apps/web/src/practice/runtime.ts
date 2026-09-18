import { loadConfigFromProcess } from "@algocove/config";
import type { ExecutionRelay } from "@algocove/application";
import {
  createPool,
  PostgresDraftRepository,
  PostgresHintRepository,
  PostgresPseudocodeRepository,
  PostgresPracticeRepository,
} from "@algocove/db";
import type { Pool } from "pg";
import { createHttpExecutionRelay } from "../adapters/execution-client";

export type PracticeRuntime = {
  readonly pool: Pool;
  readonly practice: PostgresPracticeRepository;
  readonly drafts: PostgresDraftRepository;
  readonly pseudocode: PostgresPseudocodeRepository;
  readonly hints: PostgresHintRepository;
  /** Null until the approved isolated execution relay is configured. */
  readonly executionRelay: ExecutionRelay | null;
};

let runtime: PracticeRuntime | undefined;

export function getPracticeRuntime(): PracticeRuntime | null {
  if (runtime !== undefined) return runtime;
  if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL.trim() === "") {
    return null;
  }

  const config = loadConfigFromProcess({
    ...process.env,
    SERVICE_NAME: process.env.SERVICE_NAME ?? "algocove-web",
    APP_ORIGIN: process.env.APP_ORIGIN ?? "http://localhost:3000",
  });
  const connectionString = config.database.runtimeUrl?.reveal();
  if (connectionString === undefined) return null;

  const pool = createPool({
    connectionString,
    applicationName: config.serviceName,
    maxConnections: config.database.poolMax,
    statementTimeoutMs: config.database.statementTimeoutMs,
  });
  const relayUrl = config.execution.relayUrl;
  const relayToken = config.execution.relayToken?.reveal();
  const executionRelay: ExecutionRelay | null =
    config.features.execution && relayUrl !== null && relayToken !== undefined
      ? createHttpExecutionRelay({ baseUrl: relayUrl, token: relayToken })
      : null;

  runtime = {
    pool,
    practice: new PostgresPracticeRepository(pool),
    drafts: new PostgresDraftRepository(pool),
    pseudocode: new PostgresPseudocodeRepository(pool),
    hints: new PostgresHintRepository(pool),
    executionRelay,
  };
  return runtime;
}
