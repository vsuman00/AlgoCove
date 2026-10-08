"use client";
import { useEffect, useRef, useState, type ReactElement } from "react";
import type { ExternalReadinessDecision } from "@algocove/domain";
import type { ExternalPreparationView } from "@algocove/application";
export default function ExternalReadiness({
  enabled,
  revisionKey,
  evaluate,
  perform,
}: {
  readonly enabled: boolean;
  readonly revisionKey: string;
  readonly evaluate: (
    answers?: Readonly<Record<string, string>>,
  ) => Promise<ExternalReadinessDecision | ExternalPreparationView>;
  readonly perform?: (
    action: "open" | "completed" | "corrected",
    key: string,
  ) => Promise<{ url: string | null }>;
}): ReactElement {
  const [result, setResult] = useState<{ key: string; view: ExternalPreparationView } | null>(null);
  const [progress, setProgress] = useState<{ key: string; state: string } | null>(null);
  const [selections, setSelections] = useState<{
    key: string;
    answers: Record<string, string>;
  } | null>(null);
  const [navigation, setNavigation] = useState<{
    key: string;
    url: string;
    message: string;
  } | null>(null);
  const generation = useRef(0),
    keys = useRef<Record<string, string>>({});
  useEffect(() => {
    generation.current++;
    keys.current = {};
    return () => {
      // This ref fences asynchronous requests; it is not a captured DOM node.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
    };
  }, [revisionKey, enabled]);
  const view = result?.key === revisionKey && enabled ? result.view : null;
  const state = progress?.key === revisionKey ? progress.state : "idle";
  const answers = selections?.key === revisionKey ? selections.answers : {};
  async function check(grade = false): Promise<void> {
    const stamp = ++generation.current;
    setProgress({ key: revisionKey, state: "checking" });
    setNavigation(null);
    try {
      const r = await evaluate(grade ? answers : undefined);
      if (stamp !== generation.current) return;
      const next =
        "decision" in r
          ? r
          : { decision: r, questions: [], reference: null, journal: "none" as const };
      setResult({ key: revisionKey, view: next });
      setProgress({ key: revisionKey, state: "idle" });
    } catch {
      if (stamp === generation.current) setProgress({ key: revisionKey, state: "unavailable" });
    }
  }
  async function act(action: "open" | "completed" | "corrected"): Promise<void> {
    if (!perform) return;
    const stamp = ++generation.current;
    setProgress({ key: revisionKey, state: "checking" });
    const key = keys.current[action] ?? crypto.randomUUID();
    keys.current[action] = key;
    try {
      const receipt = await perform(action, key);
      if (stamp !== generation.current) return;
      if (action === "open" && receipt.url) {
        const u = new URL(receipt.url);
        if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash)
          throw Error("Invalid destination.");
        if (view)
          setResult({
            key: revisionKey,
            view: {
              ...view,
              journal: view.journal === "none" ? "handoff_requested" : view.journal,
            },
          });
        setNavigation({
          key: revisionKey,
          url: u.toString(),
          message: "Navigation requested; this does not prove the provider page opened.",
        });
      }
      if (action !== "open") {
        setNavigation(null);
        const r = await evaluate();
        if (stamp !== generation.current) return;
        setResult({
          key: revisionKey,
          view:
            "decision" in r ? r : { decision: r, questions: [], reference: null, journal: "none" },
        });
        delete keys.current[action];
      }
      setProgress({ key: revisionKey, state: "idle" });
    } catch (error) {
      if (stamp === generation.current) {
        const status =
          typeof error === "object" && error !== null && "status" in error
            ? Number(error.status)
            : 503;
        const fallback = action === "open" && status >= 500 ? view?.reference?.url : null;
        setNavigation(
          fallback
            ? {
                key: revisionKey,
                url: fallback,
                message:
                  "The journal is unavailable. This normal link does not confirm or record navigation; retry preparation if the destination has changed.",
              }
            : null,
        );
        if (status < 500) setResult(null);
        setProgress({ key: revisionKey, state: "unavailable" });
      }
    }
  }
  return (
    <section aria-label="External practice readiness">
      <h3>Prepare for external practice</h3>
      <p>
        Check your internal learning evidence before an independent solve on the provider’s site.
      </p>
      <button
        type="button"
        className="ac-small-button"
        disabled={!enabled || state === "checking"}
        onClick={() => void check()}
      >
        {" "}
        {state === "checking" ? "Checking preparation…" : "Check external practice readiness"}
      </button>
      {view?.questions.map((q) => (
        <label key={q.id}>
          {q.prompt}
          <select
            value={answers[q.id] ?? ""}
            onChange={(e) => {
              setSelections({ key: revisionKey, answers: { ...answers, [q.id]: e.target.value } });
              setNavigation(null);
            }}
          >
            <option value="">Select an answer</option>
            {q.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      {Boolean(view?.questions.length) && (
        <button
          type="button"
          className="ac-small-button"
          disabled={state === "checking" || view!.questions.some((q) => !answers[q.id])}
          onClick={() => void check(true)}
        >
          Check preparation answers
        </button>
      )}
      <div role="status" aria-live="polite">
        {!enabled ? (
          <p>Sign in and synchronize your workspace to check preparation.</p>
        ) : state === "unavailable" ? (
          <p>Preparation could not be checked. Try again.</p>
        ) : view?.decision.status === "ready" ? (
          <p>
            Internal preparation is ready.
            {!perform ? " External navigation is not yet available." : ""}
          </p>
        ) : view ? (
          <>
            <p>Preparation is incomplete.</p>
            <ul>
              {view.decision.reasons.map((r) => (
                <li key={r.code}>{r.message}</li>
              ))}
            </ul>
          </>
        ) : (
          <p>Save your current work, then check preparation.</p>
        )}
      </div>
      {view?.reference && (
        <>
          <p>
            {view.reference.title} — {view.reference.attribution}
          </p>
          <p>{view.reference.rationale}</p>
          <p>
            The next solve happens on the provider’s own site and account. Completion is
            learner-confirmed.
          </p>
        </>
      )}
      {view?.decision.status === "ready" && view.reference && perform && (
        <button
          type="button"
          className="ac-small-button"
          disabled={state === "checking"}
          onClick={() => void act("open")}
        >
          Prepare external link
        </button>
      )}
      {navigation?.key === revisionKey && enabled && (
        <>
          <p role="status">{navigation.message}</p>
          <a
            href={navigation.url}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
          >
            Open on provider
          </a>
        </>
      )}
      {view && ["handoff_requested", "corrected"].includes(view.journal) && perform && (
        <button
          type="button"
          className="ac-small-button"
          disabled={state === "checking"}
          onClick={() => void act("completed")}
        >
          I completed this externally (learner-confirmed)
        </button>
      )}
      {view?.journal === "completed" && perform && (
        <>
          <p role="status">External completion recorded as learner-confirmed.</p>
          <button
            type="button"
            className="ac-small-button"
            disabled={state === "checking"}
            onClick={() => void act("corrected")}
          >
            Correct my external completion
          </button>
        </>
      )}
    </section>
  );
}
