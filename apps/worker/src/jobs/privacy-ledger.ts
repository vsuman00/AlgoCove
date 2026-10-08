import { open, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { PrivacyDeletionLedger } from "./privacy.ts";
/** Separate from a database snapshot. A failed fsync blocks primary purge. */
export function localPrivacyDeletionLedger(filename: string): PrivacyDeletionLedger {
  const target = resolve(filename);
  return {
    async append(record) {
      await mkdir(dirname(target), { recursive: true, mode: 0o700 });
      const file = await open(target, "a", 0o600);
      try {
        await file.write(JSON.stringify({ schemaVersion: 1, ...record }) + "\n");
        await file.sync();
      } finally {
        await file.close();
      }
    },
  };
}
