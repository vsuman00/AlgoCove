"use client";
import type { ReactElement } from "react";
import { useState } from "react";
type Row = {
  referenceId: string;
  title: string;
  sourceUrl: string;
  version: number;
  reason: string;
};
export default function DestinationReconciliation(): ReactElement {
  const [rows, setRows] = useState<Row[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/learning-release?destinations=pending", {
        cache: "no-store",
      });
      if (!r.ok) throw Error("Destination review requires an active staff role.");
      setRows(await r.json());
      setMessage(
        "Ambiguous links require an independent technical reviewer. Source URLs and memberships are retained.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unavailable");
    } finally {
      setBusy(false);
    }
  }
  async function save(row: Row, form: HTMLFormElement) {
    setBusy(true);
    try {
      const data = new FormData(form);
      const r = await fetch("/api/admin/learning-release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: "reconcile",
          referenceId: row.referenceId,
          expectedVersion: row.version,
          solveUrl: data.get("solveUrl"),
          notes: data.get("notes"),
        }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw Error(d.error?.message ?? "Reconciliation was not saved. Reload its source version.");
      }
      setRows((x) => x.filter((r) => r.referenceId !== row.referenceId));
      setMessage("Independent destination decision saved to audit history.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unavailable");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="ac-panel">
      <h2>Canonical destination reconciliation</h2>
      <button className="ac-small-button" disabled={busy} onClick={() => void load()}>
        Load pending destinations
      </button>
      <p role="status">{message}</p>
      {rows.map((r) => (
        <form
          key={r.referenceId}
          onSubmit={(e) => {
            e.preventDefault();
            void save(r, e.currentTarget);
          }}
        >
          <h3>{r.title}</h3>
          <p>Source: {r.sourceUrl}</p>
          <p>{r.reason.replaceAll("_", " ")}</p>
          <label>
            Reviewed solve URL
            <input name="solveUrl" type="url" required maxLength={2048} />
          </label>
          <label>
            Reconciliation notes
            <textarea name="notes" required maxLength={1600} />
          </label>
          <button className="ac-small-button" disabled={busy}>
            Save independent mapping
          </button>
        </form>
      ))}
    </section>
  );
}
