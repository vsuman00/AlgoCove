import type { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { isSerializationFailure } from "./connection.ts";

/**
 * Transaction helper.
 *
 * The rules it enforces come from the architecture's consistency contracts:
 *
 * - work that must be atomic runs inside one transaction; a state change and its
 *   outbox record commit together or not at all;
 * - the transaction is started before any row is locked, so a lock is never held
 *   across a connection checkout (the previous design acquired a lock first);
 * - serialization failures surface as typed errors so a caller can retry with
 *   jitter instead of guessing from a message.
 */

export type IsolationLevel = "read committed" | "repeatable read" | "serializable";

export type TransactionOptions = {
  readonly isolationLevel?: IsolationLevel;
  readonly readOnly?: boolean;
  /** Statement timeout for the whole transaction, in milliseconds. */
  readonly statementTimeoutMs?: number;
};

/** A transaction-scoped query surface. Committing is owned by `withTransaction`. */
export type Transaction = {
  query<TRow extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<TRow>>;
  readonly isolationLevel: IsolationLevel;
  readonly readOnly: boolean;
};

export type TransactionRetryOptions = {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  /** Injected sleep so tests can run retry logic without real waiting. */
  readonly sleep?: (milliseconds: number) => Promise<void>;
  /** Injected jitter source in the range [0, 1). */
  readonly random?: () => number;
};

const DEFAULT_RETRY: TransactionRetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 25,
  sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  random: Math.random,
};

/**
 * Run `work` inside one transaction.
 *
 * A failure rolls back and propagates. Isolation level and read-only intent are
 * declared by the caller, not inferred, because mixing them silently changes
 * concurrency behavior.
 */
export async function withTransaction<TResult>(
  pool: Pool,
  work: (transaction: Transaction) => Promise<TResult>,
  options: TransactionOptions = {},
): Promise<TResult> {
  const isolationLevel = options.isolationLevel ?? "read committed";
  const readOnly = options.readOnly ?? false;
  const client = await pool.connect();
  try {
    await begin(client, isolationLevel, readOnly, options.statementTimeoutMs);
    const transaction: Transaction = {
      query: (text, values) => client.query(text, values as unknown[] | undefined),
      isolationLevel,
      readOnly,
    };
    const result = await work(transaction);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await rollbackQuietly(client);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Run `work` in a transaction, retrying only recognized transient conflicts
 * (serialization failure or deadlock) with bounded attempts and jitter.
 *
 * Non-transient failures and exhausted attempts propagate unchanged, so a caller
 * can never mistake a retry limit for a business outcome.
 */
export async function withRetryableTransaction<TResult>(
  pool: Pool,
  work: (transaction: Transaction) => Promise<TResult>,
  options: TransactionOptions = {},
  retry: TransactionRetryOptions = DEFAULT_RETRY,
): Promise<TResult> {
  const sleep = retry.sleep ?? DEFAULT_RETRY.sleep!;
  const random = retry.random ?? DEFAULT_RETRY.random!;
  let attempt = 1;
  for (;;) {
    try {
      return await withTransaction(pool, work, options);
    } catch (error) {
      if (!isSerializationFailure(error) || attempt >= retry.maxAttempts) {
        throw error;
      }
      const backoff = retry.baseDelayMs * 2 ** (attempt - 1);
      const jittered = Math.round(backoff * (1 + random()));
      await sleep(jittered);
      attempt += 1;
    }
  }
}

async function begin(
  client: PoolClient,
  isolationLevel: IsolationLevel,
  readOnly: boolean,
  statementTimeoutMs: number | undefined,
): Promise<void> {
  if (statementTimeoutMs !== undefined) {
    // Applies to this transaction only; the pool default still protects the rest.
    await client.query(`SET LOCAL statement_timeout = ${Math.trunc(statementTimeoutMs)}`);
  }
  const mode = readOnly ? " READ ONLY" : "";
  await client.query(`BEGIN ISOLATION LEVEL ${isolationLevel.toUpperCase()}${mode}`);
}

async function rollbackQuietly(client: PoolClient): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch {
    // A broken connection already discarded the transaction; the original error
    // is the one worth reporting.
  }
}
