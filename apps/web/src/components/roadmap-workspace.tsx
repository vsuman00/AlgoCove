"use client";
import { useEffect, useRef, useState, type ReactElement } from "react";
import type { PlanSchedule } from "@algocove/domain";
import type { RoadmapView, PlanCandidate, PlanCommand } from "@algocove/application";
async function request<T>(body?: unknown): Promise<T> {
  const response = await fetch("/api/planning/roadmap", {
    cache: "no-store",
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error?.message ?? "Planning unavailable. Reload to retry.");
  return data as T;
}
function PrerequisiteMap({ schedule }: { schedule: PlanSchedule }): ReactElement {
  const units = [
    ...new Map(
      schedule.items.filter((item) => item.kind !== "buffer").map((item) => [item.key, item]),
    ).values(),
  ];
  const titles = new Map(units.map((item) => [item.key, item.title]));
  return (
    <section className="ac-prerequisite-map" aria-label="Learning dependencies">
      <h4>Learning dependencies</h4>
      <ol>
        {units.map((item) => (
          <li key={item.key}>
            <strong>{item.title}</strong>
            <span>
              {item.prerequisites.length
                ? `Builds on: ${item.prerequisites.map((key) => titles.get(key) ?? key.replaceAll("_", " ")).join(", ")}`
                : "Starting point · no prerequisites"}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
export default function RoadmapWorkspace({ revision }: { revision: number }): ReactElement {
  const [view, setView] = useState<RoadmapView | null>(null),
    [candidate, setCandidate] = useState<PlanCandidate | null>(null),
    [scope, setScope] = useState<"reviewed_pilot" | "full_dsa">("reviewed_pilot"),
    [message, setMessage] = useState("Loading schedule…"),
    [busy, setBusy] = useState(false),
    [useProposal, setUseProposal] = useState(false);
  const command = useRef<{ fingerprint: string; key: string } | null>(null);
  useEffect(() => {
    let current = true;
    void request<RoadmapView>()
      .then((value) => {
        if (current) {
          setView(value);
          setCandidate(value.candidates.find((c) => c.status === "valid") ?? null);
          setMessage(
            value.state
              ? "Accepted schedule loaded."
              : "No schedule is active. Build a preview after saving preferences.",
          );
        }
      })
      .catch((e: Error) => {
        if (current) setMessage(e.message);
      });
    return () => {
      current = false;
    };
  }, [revision]);
  async function send(
    action: PlanCommand["action"] | "build",
    extra: Record<string, unknown> = {},
  ) {
    const facts = { action, expectedToken: view?.state?.token ?? null, ...extra },
      fingerprint = JSON.stringify(facts);
    if (command.current?.fingerprint !== fingerprint)
      command.current = { fingerprint, key: crypto.randomUUID() };
    setBusy(true);
    setMessage("Saving planning command…");
    try {
      const value = await request<RoadmapView | PlanCandidate>({
        ...facts,
        idempotencyKey: command.current.key,
      });
      if (action === "build") {
        setCandidate(value as PlanCandidate);
        setMessage(
          (value as PlanCandidate).status === "valid"
            ? "Preview ready. Review the schedule before accepting."
            : "This scope is infeasible. Review the reasons and edit your preferences.",
        );
      } else {
        setView(value as RoadmapView);
        setCandidate(null);
        setMessage(
          action === "accept" ? "Schedule explicitly accepted." : `Plan action saved: ${action}.`,
        );
      }
      command.current = null;
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const state = view?.state,
    events = view?.journal ?? [],
    reversed = new Set(events.filter((e) => e.kind === "reversed").map((e) => e.reversesId)),
    outcomes = events.filter(
      (e) => ["done", "missed"].includes(e.kind) && !reversed.has(e.eventId),
    );
  return (
    <section className="ac-roadmap" aria-labelledby="roadmap-heading">
      <h2 id="roadmap-heading">Your roadmap</h2>
      <p role="status">{message}</p>
      <p>
        Your schedule follows your capacity and prerequisites. Activity check-ins track your study
        habits; checked practice builds your learning record.
      </p>
      <button
        className="ac-small-button"
        disabled={busy}
        onClick={() => {
          void request<RoadmapView>()
            .then((value) => {
              setView(value);
              setCandidate(value.candidates.find((c) => c.status === "valid") ?? null);
              setMessage("Current schedule and previews loaded.");
            })
            .catch((e: Error) => setMessage(e.message));
        }}
      >
        Reload schedule
      </button>
      <fieldset disabled={busy}>
        <legend>Preview scope</legend>
        <label>
          Coverage scope
          <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
            <option value="reviewed_pilot">Two-pointer learning path</option>
            <option value="full_dsa">Comprehensive DSA (requires reviewed breadth)</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={useProposal}
            onChange={(e) => setUseProposal(e.target.checked)}
          />
          Use optional AI sequencing
        </label>
        <p>
          Only schedule constraints are shared. Your goals, role, code and study history are
          excluded. If AI is unavailable, you receive the standard preview.
        </p>
        <button
          className="ac-button ac-button--primary"
          onClick={() => void send("build", { scope, useProposal })}
        >
          {state ? "Preview replan" : "Build schedule preview"}
        </button>
      </fieldset>
      {candidate && (
        <article aria-labelledby="candidate-heading">
          <h3 id="candidate-heading">Schedule preview</h3>
          {candidate.failures.map((f) => (
            <p key={f.code}>
              {f.code}: {f.message} {f.alternatives.join(" ")}
            </p>
          ))}
          {candidate.schedule && (
            <>
              <p>{candidate.schedule.coverage}</p>
              <ul>
                {candidate.schedule.collections.map((c) => (
                  <li key={c.id}>
                    {c.title ?? "Selected collection"}: {c.total} registered entries · {c.supported}{" "}
                    internally supported · {c.externalOnly} external-only · {c.unavailable}{" "}
                    unavailable. External activities are tracked separately from guided practice.
                  </li>
                ))}
              </ul>
              <p>
                {candidate.schedule.preferences.startDay} through{" "}
                {candidate.schedule.preferences.endDay} · {candidate.schedule.preferences.timezone}{" "}
                · {candidate.schedule.preferences.dailyCapacityMinutes} minutes per study day
              </p>
              <ul>
                {candidate.schedule.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
              <p>
                Workload:{" "}
                {candidate.schedule.items
                  .filter((i) => i.kind !== "buffer")
                  .reduce((n, i) => n + i.minutes, 0)}{" "}
                minutes of scheduled work;{" "}
                {candidate.schedule.items
                  .filter((i) => i.kind === "buffer")
                  .reduce((n, i) => n + i.minutes, 0)}{" "}
                minutes reserved for recovery.
              </p>
              {candidate.preview && (
                <p>
                  Changes: {candidate.preview.moved.length} moved ·{" "}
                  {candidate.preview.removed.length} removed · {candidate.preview.added.length}{" "}
                  added · {candidate.preview.retained.length} retained ·{" "}
                  {candidate.preview.blocked.length} blocked.
                </p>
              )}
              <PrerequisiteMap schedule={candidate.schedule} />
              <ul className="ac-schedule-list">
                {candidate.schedule.items.map((i) => (
                  <li key={i.occurrenceId}>
                    {i.day}: {i.title} · {i.minutes} minutes {i.language ? `· ${i.language}` : ""} ·{" "}
                    {i.required ? "required" : "optional / buffer"} ·{" "}
                    {i.reasonCodes.map((code) => code.replaceAll("_", " ")).join(" · ")}
                    {i.frozen ? " · history retained" : ""}
                  </li>
                ))}
              </ul>
              {candidate.schedule.beyondEndReviews.length > 0 && (
                <p>
                  {candidate.schedule.beyondEndReviews.length} review obligations extend beyond this
                  plan. They remain in your review queue.
                </p>
              )}
              <button
                className="ac-button ac-button--primary"
                disabled={busy || candidate.status !== "valid"}
                onClick={() => void send("accept", { candidateId: candidate.candidateId })}
              >
                Accept this schedule
              </button>
            </>
          )}
        </article>
      )}
      {state && (
        <article>
          <h3>Accepted schedule — {state.status}</h3>
          <p>
            Version {state.versionId}. Deadline {state.schedule.preferences.endDay}. Pausing and
            resuming keep this deadline; changes require a new preview and explicit acceptance.
          </p>
          <div>
            {state.status === "active" && (
              <button disabled={busy} onClick={() => void send("pause")}>
                Pause plan
              </button>
            )}
            {state.status === "paused" && (
              <button disabled={busy} onClick={() => void send("resume")}>
                Resume plan
              </button>
            )}
            {["active", "paused"].includes(state.status) && (
              <button disabled={busy} onClick={() => void send("complete")}>
                Complete plan
              </button>
            )}
            {state.status !== "archived" && (
              <button disabled={busy} onClick={() => void send("archive")}>
                Archive plan
              </button>
            )}
          </div>
          <PrerequisiteMap schedule={state.schedule} />
          <ul className="ac-schedule-list">
            {state.schedule.items
              .filter((i) => i.kind !== "buffer")
              .map((i) => {
                const outcome = outcomes.find((e) => e.occurrenceId === i.occurrenceId);
                return (
                  <li key={i.occurrenceId}>
                    <p>
                      {i.day}: {i.title} · {i.minutes} minutes {i.language ? `· ${i.language}` : ""}{" "}
                      {i.frozen ? " · retained history" : ""} · {outcome?.kind ?? "pending"}
                    </p>
                    <a href={i.href}>Open {i.title}</a>
                    {!outcome && ["active", "paused"].includes(state.status) && (
                      <>
                        <button
                          disabled={busy}
                          onClick={() => void send("done", { occurrenceId: i.occurrenceId })}
                        >
                          Check in completed: {i.title}
                        </button>
                        <button
                          disabled={busy || state.status === "paused"}
                          onClick={() => void send("missed", { occurrenceId: i.occurrenceId })}
                        >
                          Record missed: {i.title}
                        </button>
                      </>
                    )}
                    {outcome &&
                      outcome.versionId === state.versionId &&
                      ["active", "paused"].includes(state.status) && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            void send("reverse", {
                              occurrenceId: i.occurrenceId,
                              reversesId: outcome.eventId,
                            })
                          }
                        >
                          Correct check-in: {i.title}
                        </button>
                      )}
                  </li>
                );
              })}
          </ul>
          <p>
            Reviews beyond the end remain visible at <a href="/review">Your reviews</a>. Completion
            is schedule adherence, not a mastery certificate.
          </p>
        </article>
      )}
      {view && view.history.length > 0 && (
        <details>
          <summary>Accepted version history ({view.history.length})</summary>
          <ul>
            {view.history.map((v) => (
              <li key={v.versionId}>
                {v.versionId} · accepted {v.acceptedAt} · {v.schedule.coverage}
              </li>
            ))}
          </ul>
          <p>{view.journal.length} append-only history events retained.</p>
          <ul>
            {outcomes.map((event) => (
              <li key={event.eventId}>
                {event.localDay}: {event.kind} —{" "}
                {view.history
                  .flatMap((v) => v.schedule.items)
                  .find((i) => i.occurrenceId === event.occurrenceId)?.title ??
                  "Learning activity"}{" "}
                <button
                  disabled={busy}
                  onClick={() =>
                    void send("reverse", {
                      occurrenceId: event.occurrenceId,
                      reversesId: event.eventId,
                    })
                  }
                >
                  Correct historical check-in
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
