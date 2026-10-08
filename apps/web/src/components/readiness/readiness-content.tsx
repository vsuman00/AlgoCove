"use client";
import DestinationReconciliation from "../staff/destination-reconciliation";
import { useState, type ReactElement } from "react";
export default function ReadinessContent(): ReactElement {
  const [command, setCommand] = useState(""),
    [records, setRecords] = useState<{
      rubrics: Record<string, unknown>[];
      references: Record<string, unknown>[];
    } | null>(null),
    [status, setStatus] = useState("Load content with an authorized staff session."),
    [busy, setBusy] = useState(false);
  async function load(): Promise<void> {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/readiness", { cache: "no-store" });
      if (!r.ok) throw Error();
      const loaded = await r.json();
      setRecords(loaded);
      if (command === "") setCommand(JSON.stringify(loaded.draftTemplate, null, 2));
      setStatus("Current preparation policies and references loaded.");
    } catch {
      setStatus("Content unavailable or staff access denied. Retry after signing in.");
    } finally {
      setBusy(false);
    }
  }
  async function send(body: unknown): Promise<void> {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const e = await r.json();
        setStatus(e.error?.message ?? "Command rejected.");
        return;
      }
      await load();
      setStatus("Content command recorded.");
    } catch {
      setStatus(
        "Command could not be recorded. Reload to inspect its current state before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main
      className="ac-home-main ac-content-operations ac-readiness-operations"
      id="main-content"
      tabIndex={-1}
    >
      <h1>External preparation content</h1>
      <DestinationReconciliation />
      <p>
        Author original questions and a reviewed mapping. Separate technical, pedagogical and
        publishing identities are required. Learner pages never receive answer keys.
      </p>
      <button type="button" className="ac-small-button" disabled={busy} onClick={() => void load()}>
        Load policies and references
      </button>
      <p role="status">{status}</p>
      <label>
        Preparation or reference command (JSON)
        <textarea rows={18} value={command} onChange={(e) => setCommand(e.target.value)} />
      </label>
      <button
        type="button"
        className="ac-small-button"
        disabled={busy}
        onClick={() => {
          try {
            void send(JSON.parse(command));
          } catch {
            setStatus("Enter valid JSON.");
          }
        }}
      >
        Record content command
      </button>
      <p>
        Reference commands: create_reference with provider, externalKey, title, canonicalUrl and
        attribution; review_reference with referenceId and reviewed, unavailable or blocked status.
      </p>
      {records && (
        <>
          <h2>References</h2>
          <ul>
            {records.references.map((r) => (
              <li key={String(r.external_reference_id)}>
                {String(r.title)} — {String(r.external_reference_id)} — {String(r.url_status)}
              </li>
            ))}
          </ul>
          <h2>Rubrics</h2>
          {records.rubrics.map((r) => (
            <article key={`${r.rubric_id}:${r.version}`}>
              <h3>
                {String(r.rubric_id)} version {String(r.version)}
              </h3>
              <p>Status: {String(r.status)}</p>
              <details>
                <summary>Inspect authored payload and review identities</summary>
                <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {JSON.stringify(r, null, 2)}
                </pre>
              </details>
              {["technical_review", "pedagogical_review", "publish", "retire"].map((action) => (
                <button
                  key={action}
                  className="ac-small-button"
                  type="button"
                  disabled={busy}
                  onClick={() => void send({ action, rubricId: r.rubric_id, version: r.version })}
                >
                  {action.replaceAll("_", " ")}
                </button>
              ))}
            </article>
          ))}
        </>
      )}
    </main>
  );
}
