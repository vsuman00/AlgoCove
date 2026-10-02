"use client";
import { useEffect, useState, type ReactElement } from "react";
import type { ReviewQueueItem, ProgressSnapshot } from "@algocove/application";
import type { NextAction, projectConsistency } from "@algocove/domain";

async function read<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "Sign in to view your private learning record."
        : "Learning service unavailable. Refresh to retry.",
    );
  return response.json() as Promise<T>;
}
function useLearning<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    void read<T>(url)
      .then((value) => {
        if (active) {
          setData(value);
          setError(null);
        }
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [url, refresh]);
  return {
    data,
    error,
    reload: () => {
      setError(null);
      setRefresh((n) => n + 1);
    },
  };
}
export function NextLearningAction(): ReactElement {
  const { data, error, reload } = useLearning<{
    action: NextAction;
    alternatives: NextAction[];
    asOf: string;
    policyVersion: number;
  }>("/api/learner-home");
  return (
    <section className="ac-profile-strip" aria-labelledby="next-learning-title">
      <h2 id="next-learning-title">Your next step</h2>
      {error ? (
        <div>
          <p role="status">{error}</p>
          <button className="ac-small-button" type="button" onClick={reload}>
            Try again
          </button>
        </div>
      ) : data === null ? (
        <p role="status">Finding your next step…</p>
      ) : (
        <>
          <h3>{data.action.title}</h3>
          <ul>
            {data.action.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <a className="ac-button ac-button--primary" href={data.action.href}>
            Continue
          </a>
          {data.alternatives.length > 0 && (
            <details>
              <summary>Other options</summary>
              <ul>
                {data.alternatives.map((action) => (
                  <li key={action.href}>
                    <a href={action.href}>{action.title}</a>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <small>Updated {new Date(data.asOf).toLocaleString()}</small>
        </>
      )}
    </section>
  );
}
function ReviewCard({ item, reload }: { item: ReviewQueueItem; reload: () => void }): ReactElement {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [confidence, setConfidence] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const actionable = ["due", "deferred"].includes(item.status);
  const due = actionable && ["due", "overdue"].includes(item.timing);
  const date = (value: string) =>
    new Intl.DateTimeFormat(undefined, {
      timeZone: item.timezone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  async function command(body: unknown) {
    setBusy(true);
    try {
      const receipt = await read<{ correct?: boolean; status: string }>("/api/review", body);
      setMessage(
        receipt.status === "deferred"
          ? "Review deferred. Your history is preserved."
          : receipt.status === "projection_pending"
            ? "Answers saved. Progress update is pending."
            : receipt.correct
              ? "Structured checks passed. Review recorded."
              : "Review recorded. Keep practicing this pattern.",
      );
      reload();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="ac-capability-card">
      <h2>{item.exercise?.title ?? "Review exercise unavailable"}</h2>
      <p>
        {item.status === "completed"
          ? "Completed"
          : item.status === "awaiting_projection"
            ? "Answers saved · progress pending"
            : item.timing === "overdue"
              ? "Overdue · catch up when ready"
              : item.timing === "upcoming"
                ? "Upcoming"
                : "Due"}
      </p>
      <p>
        Window: {date(item.dueStart)} – {date(item.dueEnd)} ({item.timezone})
      </p>
      {due && item.exercise && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void command({
              action: "answer",
              reviewId: item.reviewId,
              exerciseId: item.exercise!.exerciseId,
              answers,
              confidence: confidence || null,
            });
          }}
        >
          {item.exercise.questions.map((question) => (
            <fieldset key={question.id}>
              <legend>{question.prompt}</legend>
              {question.options.map((option) => (
                <label className="ac-learning-option" key={option.value}>
                  <input
                    required
                    type="radio"
                    name={`${item.reviewId}-${question.id}`}
                    value={option.value}
                    checked={answers[question.id] === option.value}
                    onChange={() => setAnswers({ ...answers, [question.id]: option.value })}
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
          ))}
          <label>
            Confidence (optional, self-reported)
            <select value={confidence} onChange={(event) => setConfidence(event.target.value)}>
              <option value="">Prefer not to say</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <button className="ac-small-button" disabled={busy} type="submit">
            Record review
          </button>
        </form>
      )}
      {actionable && (
        <button
          className="ac-small-button"
          disabled={busy}
          onClick={() =>
            void command({
              action: "defer",
              reviewId: item.reviewId,
              until: new Date(Date.now() + 86400000).toISOString(),
            })
          }
        >
          Defer for 24 hours
        </button>
      )}
      <p role="status">{message}</p>
      {!item.exercise && (
        <p>Content is currently unavailable. Your due item remains recoverable.</p>
      )}
    </article>
  );
}
export function ReviewExperience(): ReactElement {
  const { data, error, reload } = useLearning<{
    reviews: ReviewQueueItem[];
    asOf: string;
    policyVersion: number;
  }>("/api/review");
  return (
    <main className="ac-home-main" id="main-content" tabIndex={-1}>
      <h1>Your reviews</h1>
      <p>
        Review windows use elapsed UTC days and appear in your profile timezone. Overdue items
        remain available; catching up preserves your history.
      </p>
      {error ? (
        <div>
          <p role="status">{error}</p>
          <button className="ac-small-button" type="button" onClick={reload}>
            Try again
          </button>
        </div>
      ) : data === null ? (
        <p role="status">Loading reviews…</p>
      ) : (
        <>
          <p>Updated {new Date(data.asOf).toLocaleString()}</p>
          {data.reviews.length === 0 ? (
            <p>
              No reviews yet. Complete a checked practice attempt to schedule your first review.
            </p>
          ) : (
            data.reviews.map((item) => (
              <ReviewCard item={item} key={item.reviewId} reload={reload} />
            ))
          )}
        </>
      )}
    </main>
  );
}
type Progress = ProgressSnapshot & { consistency: ReturnType<typeof projectConsistency> };
export function HomeLearningSummary(): ReactElement {
  const { data, error, reload } = useLearning<Progress>("/api/progress");
  return (
    <section className="ac-learning-summary" aria-labelledby="learning-summary-title">
      <header>
        <p className="ac-eyebrow">Your learning record</p>
        <h2 id="learning-summary-title">A little practice, lasting progress.</h2>
        <p>Your checked learning, study habits and personal reports stay separate.</p>
      </header>
      {error ? (
        <div className="ac-profile-strip">
          <p role="status">{error}</p>
          <button type="button" className="ac-small-button" onClick={reload}>
            Retry learning record
          </button>
        </div>
      ) : data === null ? (
        <p role="status">Loading your learning record…</p>
      ) : (
        <>
          <div className="ac-learning-grid">
            <article>
              <p className="ac-eyebrow">Checked learning</p>
              <h3>{data.mastery.length} concepts with evidence</h3>
              <p>
                {data.pendingConcepts.length > 0
                  ? `${data.pendingConcepts.length} concept updates are pending.`
                  : data.mastery.length === 0
                    ? "Your first checked practice will begin this record."
                    : "See the evidence and practice history behind each concept."}
              </p>
              <a href="/progress">Explore progress</a>
            </article>
            <article>
              <p className="ac-eyebrow">Spaced review</p>
              <h3>{data.reviewHealth.due + data.reviewHealth.overdue} reviews to revisit</h3>
              <p>
                {data.reviewHealth.overdue} overdue · {data.reviewHealth.completed} completed
              </p>
              <a href="/review">Open your reviews</a>
            </article>
            <article>
              <p className="ac-eyebrow">Study rhythm</p>
              <h3>{data.consistency.currentStreak} consecutive active days</h3>
              <p>
                {data.consistency.activeDays} active days · {data.consistency.longestStreak} longest
                streak
              </p>
              <a href="/progress">View study history</a>
            </article>
            <article>
              <p className="ac-eyebrow">Your plan</p>
              <h3>
                {data.planAdherence.status === "no_accepted_plan"
                  ? "Find your next milestones"
                  : "Keep your schedule in view"}
              </h3>
              <p>
                {data.planAdherence.totalDue === null
                  ? "Choose a pace and review your proposed schedule."
                  : `${data.planAdherence.completedOnTime ?? 0} of ${data.planAdherence.totalDue} due activities completed on time.`}
              </p>
              <a href="/plan">Open planning</a>
            </article>
            <article>
              <p className="ac-eyebrow">Confidence</p>
              <h3>{data.calibration.length} confidence observations</h3>
              <p>Compare your own confidence with checked outcomes.</p>
              <a href="/progress">Review calibration</a>
            </article>
            <article>
              <p className="ac-eyebrow">External practice</p>
              <h3>{data.externalPractice.completed} reported completions</h3>
              <p>Practice elsewhere stays in your personal journal.</p>
              <a href="/progress">Open practice journal</a>
            </article>
          </div>
          <p className="ac-summary-updated">
            Updated {new Date(data.asOf).toLocaleString()} · {data.timezone}
          </p>
        </>
      )}
    </section>
  );
}
export function ProgressExperience(): ReactElement {
  const { data, error, reload } = useLearning<Progress>("/api/progress");
  const [message, setMessage] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  async function command(url: string, body: unknown) {
    setBusy(true);
    try {
      await read(url, body);
      setMessage("Saved to your learning history.");
      reload();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="ac-home-main" id="main-content" tabIndex={-1}>
      <h1>Your progress</h1>
      <p>Checked learning, your own reports, and study habits each have their own record.</p>
      {error ? (
        <div>
          <p role="status">{error}</p>
          <button className="ac-small-button" type="button" onClick={reload}>
            Try again
          </button>
        </div>
      ) : data === null ? (
        <p role="status">Loading progress…</p>
      ) : (
        <>
          <p>
            Updated {new Date(data.asOf).toLocaleString()} · {data.timezone}
          </p>
          <section className="ac-profile-strip">
            <h2>Internal mastery</h2>
            {data.pendingConcepts.length > 0 && (
              <p role="status">
                Checked activity is saved. Progress updates for {data.pendingConcepts.length}{" "}
                concepts are pending.
              </p>
            )}
            {data.mastery.length === 0 ? (
              <p>No checked concept evidence yet.</p>
            ) : (
              data.mastery.map((item) => (
                <article key={item.projection.conceptId}>
                  <h3>{item.title}</h3>
                  <p>
                    {item.status === "projection_pending"
                      ? "Progress update pending"
                      : item.projection.band.replaceAll("_", " ")}
                  </p>
                  <p>
                    {item.projection.evidenceCount} observations · Last practiced{" "}
                    {item.projection.lastPracticed ?? "Not yet"}
                  </p>
                  <ul>
                    {item.projection.reasonCodes.map((code) => (
                      <li key={code}>{code.replaceAll("_", " ")}</li>
                    ))}
                  </ul>
                  <p>
                    Language execution:{" "}
                    {Object.entries(item.projection.languageProficiency)
                      .map(
                        ([language, stats]) =>
                          `${language}: ${stats.observedPasses} checked passes`,
                      )
                      .join("; ") || "No code execution evidence"}
                  </p>
                </article>
              ))
            )}
          </section>
          <section className="ac-profile-strip">
            <h2>Review health</h2>
            <p>
              {data.reviewHealth.due} due · {data.reviewHealth.overdue} overdue ·{" "}
              {data.reviewHealth.deferred} deferred · {data.reviewHealth.completed} completed ·{" "}
              {data.reviewHealth.pending} pending
            </p>
            <a href="/review">Open reviews</a>
          </section>

          <section className="ac-profile-strip">
            <h2>Study consistency</h2>
            <p>
              {data.consistency.currentStreak} current consecutive active days ·{" "}
              {data.consistency.longestStreak} longest · {data.consistency.activeDays} active days
              in {data.timezone}
            </p>
            <p>
              A checked code assessment, saved structured explanation check, or answered review
              counts, including an incorrect answer. One day counts once. Review-only days count.
              There are no automatic rest or grace days. Prospective pauses bridge gaps without
              adding active days. External reports do not count. Timezone changes apply to new
              records; past dated activity keeps its captured timezone.
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void command("/api/progress/pause", {
                  startDay: start,
                  endDay: end,
                  timezone: data.timezone,
                });
              }}
            >
              <h3>Schedule a study pause</h3>
              <label>
                First day
                <input
                  type="date"
                  required
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label>
                Last day
                <input type="date" required value={end} onChange={(e) => setEnd(e.target.value)} />
              </label>
              <button className="ac-small-button" disabled={busy} type="submit">
                Save pause
              </button>
            </form>
            {data.pauses.map((pause) => (
              <p key={`${pause.timezone}-${pause.startDay}-${pause.endDay}`}>
                {pause.startDay} – {pause.endDay} ({pause.timezone})
              </p>
            ))}
          </section>
          <section className="ac-profile-strip">
            <h2>Confidence calibration</h2>
            <p>
              Confidence is self-reported. Outcomes below were checked with a reviewed rubric or
              code tests. No calibrated ability score is inferred.
            </p>
            {data.calibration.length === 0 ? (
              <p>No confidence observations yet.</p>
            ) : (
              <ul>
                {data.calibration.map((item, index) => (
                  <li key={`${item.observedAt}-${index}`}>
                    {item.confidence} confidence ·{" "}
                    {item.correct ? "checked correct" : "checked incorrect"} ·{" "}
                    {new Date(item.observedAt).toLocaleString()}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="ac-profile-strip">
            <h2>External practice journal</h2>
            <p>
              Self-reported: {data.externalPractice.completed} completed references ·{" "}
              {data.externalPractice.requested} handoff requests. These reports do not establish
              verified mastery or study streaks.
            </p>
            {data.externalPractice.references.length === 0 ? (
              <p>No reviewed outbound references available.</p>
            ) : (
              data.externalPractice.references.map((ref) => (
                <article key={ref.referenceId}>
                  <h3>{ref.title}</h3>
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      void command("/api/progress/external", {
                        referenceId: ref.referenceId,
                        kind: "handoff_requested",
                        idempotencyKey: crypto.randomUUID(),
                      })
                    }
                  >
                    Open external practice (new tab)
                  </a>
                  {(["completed", "corrected"] as const).map((kind) => (
                    <button
                      className="ac-small-button"
                      disabled={busy}
                      key={kind}
                      onClick={() =>
                        void command("/api/progress/external", {
                          referenceId: ref.referenceId,
                          kind,
                          idempotencyKey: crypto.randomUUID(),
                        })
                      }
                    >
                      {kind === "completed" ? "Report completed" : "Correct my completion report"}
                    </button>
                  ))}
                </article>
              ))
            )}
          </section>
          <section className="ac-profile-strip">
            <h2>Plan adherence</h2>
            <p>
              {data.planAdherence.status === "no_accepted_plan"
                ? "No accepted plan is present. Completion and on-time adherence are not calculated."
                : `${data.planAdherence.completedOnTime} on-time learner check-ins across ${data.planAdherence.totalDue} due activities. Historical versions and paused obligations are accounted for separately from mastery.`}
            </p>
            <a href="/plan">Review your roadmap</a>
            <p>
              {data.completedSessions} completed learning sessions, recorded separately from plan
              adherence.
            </p>
          </section>
          <p role="status">{message}</p>
        </>
      )}
    </main>
  );
}
