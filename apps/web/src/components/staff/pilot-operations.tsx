"use client";
import { useEffect, useState, type ReactElement } from "react";
import Link from "next/link";
import type { PilotBundle } from "@algocove/content/pilot";
import PilotTraceRenderer from "../practice/pilot-trace-renderer";
const kinds = ["technical", "pedagogical", "accessibility", "rights", "trace", "conformance"];
type RecordView = {
  versionId: string;
  slug: string;
  pattern: string;
  checksum: string;
  status: string;
  bundle: PilotBundle;
  reviews: { kind: string; reviewerId: string; decision: string; notes: string }[];
};
export default function PilotOperations(): ReactElement {
  const [authorized, setAuthorized] = useState(false);
  const [records, setRecords] = useState<RecordView[]>([]),
    [status, setStatus] = useState("Loading governed pilot drafts…"),
    [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    void fetch("/api/admin/pilot", { cache: "no-store", signal: c.signal })
      .then(async (r) => {
        if (!r.ok)
          throw Error(
            r.status === 401
              ? "Sign in to review pilot content."
              : r.status === 403
                ? "An active content role is required."
                : "Pilot content is unavailable.",
          );
        const data = await r.json();
        if (!c.signal.aborted) {
          setAuthorized(true);
          setRecords(data.records);
          setStatus("Draft content requires independent reviews before publication.");
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) {
          setAuthorized(false);
          setRecords([]);
          setStatus(e instanceof Error ? e.message : "Unavailable");
        }
      });
    return () => c.abort();
  }, [refresh]);
  const send = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/pilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok)
        throw Error(
          "Decision was not recorded. Check your role, independence and current checksum.",
        );
      setStatus(
        "Command recorded. Publication still requires all reviews and a separate publisher.",
      );
      setRefresh((n) => n + 1);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Unavailable");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main id="main-content" tabIndex={-1} className="ac-home-main ac-content-operations">
      <h1>Pilot content review</h1>
      <p role="status">{status}</p>
      <label>
        Import original bundle or collection JSON
        <input
          type="file"
          accept="application/json,.json"
          disabled={busy || !authorized}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > 60000) {
              setStatus("Bundle exceeds the bounded import size.");
              return;
            }
            void f.text().then((t) => {
              try {
                const bundle = JSON.parse(t);
                void send({
                  command: Array.isArray(bundle.entries) ? "collection" : "import",
                  bundle,
                });
              } catch {
                setStatus("Choose a valid JSON bundle.");
              }
            });
            e.target.value = "";
          }}
        />
      </label>
      {records.map((r) => (
        <article className="ac-panel" key={r.versionId}>
          <h2>{r.bundle.title}</h2>
          <p>
            {r.status} · {r.pattern} · {r.bundle.version}
          </p>
          <p>
            Checksum: <code style={{ overflowWrap: "anywhere" }}>{r.checksum}</code>
          </p>
          <p>{r.bundle.statement}</p>
          <details>
            <summary>Complete private review packet</summary>
            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {JSON.stringify(r.bundle, null, 2)}
            </pre>
          </details>
          <PilotTraceRenderer
            trace={{
              schemaVersion: 2,
              provenance: "authored_reference",
              pattern: r.bundle.pattern,
              ...r.bundle.trace,
            }}
          />
          <h3>Recorded reviews</h3>
          <ul>
            {r.reviews.map((v, i) => (
              <li key={i}>
                {v.kind}: {v.decision} by {v.reviewerId} — {v.notes}
              </li>
            ))}
          </ul>
          {r.status === "draft" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                void send({
                  command: "review",
                  versionId: r.versionId,
                  checksum: r.checksum,
                  kind: data.get("kind"),
                  decision: data.get("decision"),
                  notes: data.get("notes"),
                });
              }}
            >
              <label>
                Review kind
                <select name="kind">
                  {kinds.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </label>
              <label>
                Decision
                <select name="decision">
                  <option>approved</option>
                  <option>rejected</option>
                </select>
              </label>
              <label>
                Review evidence and notes
                <textarea name="notes" required maxLength={2000} />
              </label>
              <button disabled={busy}>Record independent review</button>
            </form>
          )}
          <p>
            <Link href={`/admin/content/${r.versionId}`}>
              Open standard technical/pedagogical validation and publication
            </Link>
          </p>
        </article>
      ))}
    </main>
  );
}
