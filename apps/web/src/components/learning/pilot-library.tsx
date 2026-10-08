"use client";
import { useEffect, useState, type ReactElement } from "react";
import Link from "next/link";
type Item = {
  pattern: string;
  slug: string;
  title: string;
  status: string;
  href: string | null;
  external: {
    title: string;
    url: string;
    attribution: string;
    relation: string;
    rationale: string;
  } | null;
};
export default function PilotLibrary(): ReactElement {
  const [items, setItems] = useState<Item[]>([]),
    [status, setStatus] = useState("Loading reviewed pilot availability…"),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    void fetch("/api/practice/pilot", { cache: "no-store", signal: c.signal })
      .then(async (r) => {
        if (!r.ok)
          throw Error(
            "Pilot availability is unavailable. Retry when the content service reconnects.",
          );
        const data = await r.json();
        if (!c.signal.aborted) {
          setItems(data.items);
          setStatus(data.coverage);
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) {
          setItems([]);
          setStatus(e instanceof Error ? e.message : "Unavailable");
        }
      });
    return () => c.abort();
  }, [refresh]);
  return (
    <main id="main-content" tabIndex={-1} className="ac-home-main">
      <h1>Pilot curriculum</h1>
      <p role="status">{status}</p>
      <button className="ac-small-button" onClick={() => setRefresh((n) => n + 1)}>
        Refresh availability
      </button>
      <div className="ac-learning-grid">
        {items.map((item) => (
          <article className="ac-panel" key={item.slug}>
            <h2>{item.title}</h2>
            <p>
              {item.pattern.replaceAll("-", " ")} · {item.status.replaceAll("_", " ")}
            </p>
            {item.href ? (
              <Link href={item.href}>Start guided learning</Link>
            ) : (
              <p>Reviewed internal learning is unavailable.</p>
            )}
            {item.external ? (
              <>
                <p>
                  {item.external.relation.replaceAll("_", " ")}: {item.external.rationale}
                </p>
                <a href={item.external.url} target="_blank" rel="noopener noreferrer">
                  {item.external.title} (external, new tab)
                </a>
                <p>{item.external.attribution}</p>
                <p>
                  Complete the owned preparation gate before recording an external handoff. Opening
                  a public link does not establish readiness or mastery.
                </p>
              </>
            ) : (
              <p>No manually reviewed outbound mapping is available.</p>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
