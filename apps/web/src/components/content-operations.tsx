"use client";

import { useEffect, useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { PROBLEM_LANGUAGES } from "@algocove/domain";
import type { ProblemContentVersion, ProblemManifest } from "@algocove/domain";

type RecordView = {
  content: ProblemContentVersion;
  revision: string;
  manifest: ProblemManifest;
  manifestIssue: string | null;
};
type ContentView = {
  records: RecordView[];
  permissions: string[];
  actorId: string;
  references?: readonly { title: string; provider: string; url: string; attribution: string }[];
};
export default function ContentOperations({ id }: { id?: string }): ReactElement {
  const [view, setView] = useState<ContentView | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  const [lastCommand, setLastCommand] = useState<{ input: string; key: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/admin/content${id === undefined ? "" : `?id=${encodeURIComponent(id)}`}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          setStatus(response.status);
          throw new Error(
            response.status === 401
              ? "Sign in to open content operations."
              : response.status === 403
                ? "Your account does not have access to content operations."
                : response.status === 404
                  ? "This content version is unavailable."
                  : "Content could not be loaded. Try again.",
          );
        }
        const data = (await response.json()) as ContentView;
        if (!controller.signal.aborted) {
          setView(data);
          setError("");
          setStatus(200);
        }
      })
      .catch((failure: Error) => {
        if (!controller.signal.aborted) setError(failure.message);
      });
    return () => controller.abort();
  }, [id, refresh]);
  async function command(input: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    const fingerprint = JSON.stringify(input);
    const key = lastCommand?.input === fingerprint ? lastCommand.key : crypto.randomUUID();
    setLastCommand({ input: fingerprint, key });
    try {
      const response = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, idempotencyKey: key }),
      });
      const result = (await response.json()) as {
        content?: ProblemContentVersion;
        error?: { message?: string };
      };
      if (!response.ok)
        throw new Error(result.error?.message ?? "The decision was not saved. Try again.");
      setLastCommand(null);
      if (input.command === "create" && result.content) {
        router.push(`/admin/content/${result.content.contentVersionId}`);
        return;
      }
      setMessage("Saved to the content history.");
      setRefresh((value) => value + 1);
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : "The decision was not saved.");
    } finally {
      setBusy(false);
    }
  }
  const record = id === undefined ? undefined : view?.records[0];
  const publicationBlockers: string[] = [];
  if (record?.content.status === "draft") {
    if (record.manifestIssue) publicationBlockers.push(record.manifestIssue);
    for (const kind of ["technical", "pedagogical"] as const) {
      const review = [...record.content.reviews].reverse().find((item) => item.kind === kind);
      if (review?.decision !== "approved")
        publicationBlockers.push(
          `${kind === "technical" ? "Technical" : "Pedagogical"} approval is required.`,
        );
    }
    if (record.content.validation.status !== "passed")
      publicationBlockers.push("Metadata validation must pass.");
  }
  const can = (permission: string) => view?.permissions.includes(`content.${permission}`) ?? false;
  const run = (body: Record<string, unknown>) =>
    record &&
    void command({
      ...body,
      versionId: record.content.contentVersionId,
      expectedRevision: record.revision,
    });
  return (
    <main className="ac-home-main ac-content-operations" id="main-content" tabIndex={-1}>
      <header>
        <a href={id === undefined ? "/" : "/admin/content"}>
          {id === undefined ? "Back to home" : "Back to content operations"}
        </a>
        <p className="ac-eyebrow">Content operations</p>
        <h1>{record?.content.title ?? "Governed content"}</h1>
        <p>Author, review and maintain versioned learning material.</p>
      </header>
      {error ? (
        <section className="ac-profile-strip" role="status">
          <p>{error}</p>
          {status === 401 ? (
            <a className="ac-button ac-button--primary" href="/sign-in">
              Sign in
            </a>
          ) : (
            status !== 403 && (
              <button
                className="ac-small-button"
                type="button"
                onClick={() => setRefresh((value) => value + 1)}
              >
                Retry content
              </button>
            )
          )}
        </section>
      ) : view === null ? (
        <p role="status">Loading content…</p>
      ) : id === undefined ? (
        <>
          <section className="ac-profile-strip">
            <h2>Content library</h2>
            <p>The latest 200 content versions, newest first.</p>
            {view.records.length === 0 ? (
              <p>No content versions yet.</p>
            ) : (
              <ul className="ac-content-library">
                {view.records.map(({ content }) => (
                  <li key={content.contentVersionId}>
                    <div>
                      <h3>
                        <a href={`/admin/content/${content.contentVersionId}`}>{content.title}</a>
                      </h3>
                      <p>
                        {content.provenance.rightsHolder} · {content.validation.status}
                      </p>
                    </div>
                    <span className="ac-content-status">{content.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {can("author") && (
            <form
              className="ac-profile-strip"
              onSubmit={(event) => {
                event.preventDefault();
                const fields = new FormData(event.currentTarget);
                void command({
                  command: "create",
                  title: fields.get("title"),
                  statement: fields.get("statement"),
                  rightsHolder: fields.get("rightsHolder"),
                  license: fields.get("license"),
                });
              }}
            >
              <h2>Create an original draft</h2>
              <label>
                Title
                <input name="title" required maxLength={200} />
              </label>
              <label>
                Original statement
                <textarea name="statement" required maxLength={20000} rows={8} />
              </label>
              <label>
                Rights holder
                <input name="rightsHolder" required maxLength={200} />
              </label>
              <label>
                License
                <input name="license" required maxLength={160} />
              </label>
              <button className="ac-button ac-button--primary" type="submit" disabled={busy}>
                Create draft
              </button>
            </form>
          )}
        </>
      ) : (
        record && (
          <>
            <section className="ac-profile-strip">
              <h2>Version details</h2>
              <p>
                <b>Status:</b> {record.content.status} · <b>Validation:</b>{" "}
                {record.content.validation.status}
              </p>
              <p>
                {record.content.provenance.kind} · {record.content.provenance.rightsHolder} ·{" "}
                {record.content.provenance.license}
              </p>
              <details>
                <summary>Version identity</summary>
                <p className="ac-content-identity">
                  {record.content.contentVersionId}
                  <br />
                  {record.content.checksum}
                </p>
              </details>
              <h3>Statement</h3>
              <p className="ac-content-statement">
                {record.content.payloadStatus === "tombstoned"
                  ? "Payload unavailable following retirement."
                  : (record.content.statement ?? "This licensed record contains metadata only.")}
              </p>
            </section>
            <section className="ac-profile-strip">
              <h2>Review history</h2>
              {record.content.reviews.length === 0 ? (
                <p>No reviews recorded.</p>
              ) : (
                <ul>
                  {record.content.reviews.map((review) => (
                    <li key={`${review.kind}-${review.reviewerId}`}>
                      <b>{review.kind}:</b> {review.decision} ·{" "}
                      {new Date(review.reviewedAt).toLocaleString()}
                      <p>{review.notes}</p>
                    </li>
                  ))}
                </ul>
              )}
              {record.content.status === "draft" &&
                record.content.authorId !== view.actorId &&
                ["technical", "pedagogical"].map(
                  (kind) =>
                    can(`${kind}_review`) && (
                      <form
                        key={kind}
                        onSubmit={(event) => {
                          event.preventDefault();
                          const fields = new FormData(event.currentTarget);
                          run({
                            command: "review",
                            kind,
                            decision: fields.get("decision"),
                            notes: fields.get("notes") || null,
                          });
                        }}
                      >
                        <h3>{kind === "technical" ? "Technical review" : "Pedagogical review"}</h3>
                        <label>
                          Decision
                          <select name="decision">
                            <option value="approved">Approve</option>
                            <option value="rejected">Reject</option>
                          </select>
                        </label>
                        <label>
                          Review notes
                          <textarea name="notes" maxLength={2000} rows={3} />
                        </label>
                        <button type="submit" disabled={busy} className="ac-small-button">
                          Record {kind} review
                        </button>
                      </form>
                    ),
                )}
            </section>
            <section className="ac-profile-strip">
              <h2>Language contracts</h2>
              <p>
                Publishing preserves the reviewed metadata version. Learner practice also needs a
                reviewed learning bundle and a supported execution contract.
              </p>
              {publicationBlockers.length > 0 && (
                <ul aria-label="Publication blockers">
                  {publicationBlockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              )}
              {record.manifestIssue && <p role="status">{record.manifestIssue}</p>}
              <ul>
                {record.manifest.languages.map((language) => (
                  <li key={language.language}>
                    <b>{language.language}</b> · {language.entrySignature} ·{" "}
                    {language.fixtureIds.length} semantic checks
                  </li>
                ))}
              </ul>
              <p>{record.content.validation.message}</p>
              {record.content.status === "draft" &&
                can("author") &&
                record.content.authorId === view.actorId && (
                  <details>
                    <summary>Edit language contracts</summary>
                    <form
                      key={record.revision}
                      onSubmit={(event) => {
                        event.preventDefault();
                        const fields = new FormData(event.currentTarget);
                        try {
                          const fixtures: unknown = JSON.parse(String(fields.get("fixtures")));
                          run({
                            command: "manifest",
                            fixtures,
                            starters: Object.fromEntries(
                              PROBLEM_LANGUAGES.map((language) => [language, fields.get(language)]),
                            ),
                          });
                        } catch {
                          setMessage(
                            "Semantic checks must be a valid JSON array of fixtureId and semanticKey objects.",
                          );
                        }
                      }}
                    >
                      <p>
                        Changing contracts invalidates earlier reviews and validation. Published
                        contracts cannot be edited.
                      </p>
                      <label>
                        Semantic checks (JSON)
                        <textarea
                          name="fixtures"
                          required
                          rows={4}
                          defaultValue={JSON.stringify(record.manifest.fixtures, null, 2)}
                        />
                      </label>
                      {PROBLEM_LANGUAGES.map((language) => (
                        <label key={language}>
                          {language} starter template
                          <textarea
                            name={language}
                            required
                            rows={4}
                            maxLength={20000}
                            defaultValue={
                              record.manifest.languages.find((item) => item.language === language)
                                ?.starterTemplate ?? ""
                            }
                          />
                        </label>
                      ))}
                      <button className="ac-small-button" type="submit" disabled={busy}>
                        Save language contracts
                      </button>
                    </form>
                  </details>
                )}
              {record.content.status === "draft" && (
                <div className="ac-trace-controls">
                  {can("evaluate") && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run({ command: "validate" })}
                    >
                      Validate metadata
                    </button>
                  )}
                  {can("publish") && (
                    <button
                      type="button"
                      disabled={
                        busy ||
                        publicationBlockers.length > 0 ||
                        record.content.validation.status !== "passed" ||
                        record.content.authorId === view.actorId
                      }
                      onClick={() => run({ command: "publish" })}
                    >
                      Publish version
                    </button>
                  )}
                </div>
              )}
              {record.content.status === "published" && can("publish") && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const fields = new FormData(event.currentTarget);
                    run({ command: "retire", reason: fields.get("reason") });
                  }}
                >
                  <h3>Retire this version</h3>
                  <label>
                    Reason
                    <select name="reason">
                      <option value="retired">Retired</option>
                      <option value="rights_withdrawn">Rights withdrawn</option>
                      <option value="security_tombstone">Security tombstone</option>
                    </select>
                  </label>
                  <p>
                    New practice will stop using this version. Rights withdrawal and security
                    retirement also hide its statement.
                  </p>
                  <button type="submit" disabled={busy} className="ac-small-button">
                    Retire version
                  </button>
                </form>
              )}
            </section>
          </>
        )
      )}
      {!error && view && (
        <section className="ac-profile-strip">
          <h2>Reviewed outbound references</h2>
          {(view.references?.length ?? 0) === 0 ? (
            <p>No reviewed outbound references available.</p>
          ) : (
            <ul>
              {view.references?.map((reference) => (
                <li key={reference.url}>
                  <a href={reference.url} target="_blank" rel="noopener noreferrer">
                    {reference.title} (new tab)
                  </a>
                  <p>
                    {reference.provider} · {reference.attribution}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {message && <p role="status">{message}</p>}
    </main>
  );
}
