import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ExecutionJournal, ExecutionJournalRecord } from "./types.ts";

/** Local control metadata only. Learner source must never be written to this database. */
export function createSqliteExecutionJournal(path: string): ExecutionJournal & { close(): void } {
  if (!path || path === ":memory:") throw new Error("A durable journal file path is required.");
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const database = new DatabaseSync(path);
  chmodSync(path, 0o600);
  database.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;");
  database.exec(`CREATE TABLE IF NOT EXISTS execution_journal (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL UNIQUE,
    dispatch_key TEXT NOT NULL UNIQUE,
    record_json TEXT NOT NULL
  )`);
  const get = database.prepare("SELECT record_json FROM execution_journal WHERE run_id = ?");
  const list = database.prepare("SELECT record_json FROM execution_journal ORDER BY sequence");
  const save = database.prepare(`INSERT INTO execution_journal (run_id, dispatch_key, record_json)
    VALUES (?, ?, ?)
    ON CONFLICT(run_id) DO UPDATE SET
      dispatch_key = excluded.dispatch_key,
      record_json = excluded.record_json`);
  return {
    get(runId) {
      const row = get.get(runId as string) as { record_json: string } | undefined;
      return row === undefined
        ? undefined
        : (JSON.parse(row.record_json) as ExecutionJournalRecord);
    },
    list() {
      return (list.all() as { record_json: string }[]).map(
        (row) => JSON.parse(row.record_json) as ExecutionJournalRecord,
      );
    },
    save(record) {
      const json = JSON.stringify(record);
      if (/(?:"source"|"sourceCode"|"learnerSource")\s*:/.test(json)) {
        throw new Error("Execution journal cannot contain learner source.");
      }
      save.run(record.descriptor.payload.runId as string, record.dispatchKey, json);
    },
    close() {
      database.close();
    },
  };
}
