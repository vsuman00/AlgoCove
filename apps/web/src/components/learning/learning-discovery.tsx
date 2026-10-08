"use client";
import { useEffect, useState } from "react";
import { useBrowserLocation, replaceBrowserQuery } from "../../auth/browser-location";
import type { ReactElement } from "react";
import Link from "next/link";
import { PROBLEM_LANGUAGES } from "@algocove/domain";
import type { PublishedProblemSummary } from "@algocove/application";
type Sheet = { id: string; title: string; total: number; internal: number };
type Entry = {
  referenceId: string;
  ordinal: number;
  title: string;
  attribution: string;
  canonicalIdentity: string;
  solveUrl: string | null;
  internalSlug: string | null;
  availability: string;
  mappingKind: string | null;
  mappingRationale: string | null;
};
export default function LearningDiscovery({
  kind = "problems",
  pattern,
  sheetId,
}: {
  kind?: "problems" | "sheets";
  pattern?: string;
  sheetId?: string;
}): ReactElement {
  const [progress, setProgress] = useState<
    Record<string, { selfReport: string; hasSubmittedAttempt: boolean }>
  >({});
  const [progressStatus, setProgressStatus] = useState("");
  const location = useBrowserLocation(),
    query = new URL(location, "https://algocove.local").searchParams;
  const search = (query.get("search") ?? "").slice(0, 100),
    language = PROBLEM_LANGUAGES.includes(
      query.get("language") as (typeof PROBLEM_LANGUAGES)[number],
    )
      ? (query.get("language") ?? "")
      : "",
    after = query.get("after");
  function updateQuery(key: string, value: string | null) {
    const q = new URLSearchParams(query);
    if (value) q.set(key, value);
    else q.delete(key);
    if (key !== "after") q.delete("after");
    setStatus("Loading reviewed availability…");
    setItems([]);
    replaceBrowserQuery(q);
  }
  const setSearch = (v: string) => updateQuery("search", v),
    setLanguage = (v: string) => updateQuery("language", v),
    setAfter = (v: string | null) => updateQuery("after", v);
  const [next, setNext] = useState<string | null>(null),
    [items, setItems] = useState<(PublishedProblemSummary | Sheet | Entry)[]>([]),
    [status, setStatus] = useState("Loading reviewed availability…"),
    [refresh, setRefresh] = useState(0),
    [title, setTitle] = useState(
      sheetId
        ? "Curated sheet"
        : kind === "sheets"
          ? "Curated sheets"
          : pattern
            ? `${pattern.replaceAll("-", " ")} learning`
            : "Learn",
    );
  useEffect(() => {
    const c = new AbortController(),
      q = new URLSearchParams({ limit: "20", search });
    if (after) q.set("after", after);
    if (pattern) q.set("pattern", pattern);
    if (language && kind === "problems") q.set("language", language);
    if (sheetId) q.set("id", sheetId);

    void fetch(`/api/learning/${kind}?${q}`, { cache: "no-store", signal: c.signal })
      .then(async (r) => {
        if (!r.ok)
          throw Error("Discovery is unavailable. Retry when the content service reconnects.");
        return r.json();
      })
      .then((d) => {
        if (c.signal.aborted) return;
        setItems(d.items);
        setNext(d.nextAfter ?? null);
        if (d.collection) setTitle(d.collection.title);
        setStatus(
          d.items.length
            ? d.truncated
              ? "Showing the first 500 ordered entries."
              : "Reviewed published availability. Collection membership is separate from completion."
            : "No reviewed items match these filters.",
        );
      })
      .catch((e) => {
        if (!c.signal.aborted) {
          setNext(null);
          setItems([]);
          setStatus(e instanceof Error ? e.message : "Unavailable");
        }
      });
    return () => c.abort();
  }, [search, language, after, pattern, sheetId, kind, refresh]);
  async function loadProgress() {
    setProgressStatus("Loading private progress…");
    try {
      const r = await fetch(
        `/api/learning/sheet-progress?id=${encodeURIComponent(sheetId ?? "")}`,
        { cache: "no-store" },
      );
      if (!r.ok)
        throw Error(
          r.status === 401
            ? "Sign in to view your private progress."
            : "Private progress is unavailable. Retry later.",
        );
      const d = await r.json();
      setProgress(
        Object.fromEntries(
          d.items.map(
            (x: {
              canonicalIdentity: string;
              selfReport: string;
              hasSubmittedAttempt: boolean;
            }) => [x.canonicalIdentity, x],
          ),
        ),
      );
      setProgressStatus(
        "One progress state per canonical destination. Self-reports and submitted attempts are distinct from mastery.",
      );
    } catch (e) {
      setProgressStatus(e instanceof Error ? e.message : "Unavailable");
    }
  }
  return (
    <main id="main-content" tabIndex={-1} className="ac-home-main">
      <h1>{title}</h1>
      <nav aria-label="Learning discovery">
        <Link href="/learn">All learning</Link>
        {" · "}
        <Link href="/sheets">Curated sheets</Link>
        {" · "}
        <Link href="/plan">Planning</Link>
      </nav>
      {!sheetId && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAfter(null);
            setRefresh((n) => n + 1);
          }}
        >
          <label>
            Search
            <input
              name="search"
              maxLength={100}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
            />
          </label>
          {kind === "problems" && (
            <label htmlFor="catalog-language">
              Language
              <select
                id="catalog-language"
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                }}
              >
                <option value="">All languages</option>
                {PROBLEM_LANGUAGES.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
          )}
          <button type="submit" className="ac-small-button">
            Search
          </button>
        </form>
      )}
      <p role="status">{status}</p>
      <button className="ac-small-button" onClick={() => setRefresh((n) => n + 1)}>
        Refresh availability
      </button>
      {sheetId && (
        <>
          <button className="ac-small-button" onClick={() => void loadProgress()}>
            Load my private progress
          </button>
          <p role="status">{progressStatus}</p>
        </>
      )}
      <div className="ac-learning-grid">
        {items.map((item) =>
          "slug" in item ? (
            <article className="ac-panel" key={item.slug}>
              <h2>{item.title}</h2>
              {item.pattern && (
                <Link href={`/learn/topics/${item.pattern}`}>
                  {item.pattern.replaceAll("-", " ")}
                </Link>
              )}
              <p>{item.languages.join(", ")}</p>
              <Link href={`/learn/lessons/${item.slug}`}>Read concept lesson</Link>
              {" · "}
              <Link href={`/learn/${item.slug}${language ? `?language=${language}` : ""}`}>
                Start guided learning
              </Link>
            </article>
          ) : "ordinal" in item ? (
            <article className="ac-panel" key={`${item.ordinal}:${item.referenceId}`}>
              <h2>
                {item.ordinal}. {item.title}
              </h2>
              <p>{item.availability.replaceAll("_", " ")}</p>
              {progress[item.canonicalIdentity] && (
                <p>
                  Self-report: {progress[item.canonicalIdentity]!.selfReport}. Internal attempt:{" "}
                  {progress[item.canonicalIdentity]!.hasSubmittedAttempt
                    ? "submitted"
                    : "no submitted attempt"}
                  .
                </p>
              )}
              {item.internalSlug && (
                <Link
                  href={`/learn/${item.internalSlug}?returnTo=${encodeURIComponent(`/sheets/${sheetId}`)}`}
                >
                  Open mapped internal learning
                </Link>
              )}
              {item.mappingKind && (
                <p>
                  {item.mappingKind.replaceAll("_", " ")}: {item.mappingRationale}
                </p>
              )}
              {item.solveUrl && (
                <p>
                  <a href={item.solveUrl} target="_blank" rel="noopener noreferrer">
                    External solve (new tab)
                  </a>
                </p>
              )}
              <p>{item.attribution}</p>
              <p>Opening a link does not record readiness, completion, or mastery.</p>
            </article>
          ) : (
            <article className="ac-panel" key={item.id}>
              <h2>{item.title}</h2>
              <p>
                {item.internal} internal mappings · {item.total} distinct destinations
              </p>
              <Link href={`/sheets/${item.id}`}>Open sheet</Link>
            </article>
          ),
        )}
      </div>
      {after && (
        <button className="ac-small-button" onClick={() => setAfter(null)}>
          First page
        </button>
      )}
      {next && (
        <button className="ac-small-button" onClick={() => setAfter(next)}>
          Next page
        </button>
      )}
    </main>
  );
}
