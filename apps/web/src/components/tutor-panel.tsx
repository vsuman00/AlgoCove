"use client";
import { useEffect, useRef, useState, useId, type ReactElement } from "react";
import type { TutorView } from "@algocove/application";
export default function TutorPanel({
  getAttemptId,
  available,
}: {
  getAttemptId: () => string | undefined;
  available: boolean;
}): ReactElement {
  const questionId = useId();
  const [query, setQuery] = useState("Help me clarify the inputs."),
    [debug, setDebug] = useState(false),
    [shareCode, setShareCode] = useState(false),
    [hasRequest, setHasRequest] = useState(false),
    [view, setView] = useState<TutorView | null>(null),
    [status, setStatus] = useState("Ask for a clarification or use the authored hints above.");
  const current = useRef<{ attempt: string; key: string; id: string | null; body: unknown } | null>(
      null,
    ),
    epoch = useRef(0);
  useEffect(
    () => () => {
      epoch.current++;
      current.current = null;
    },
    [],
  );
  async function request(body: unknown) {
    const response = await fetch("/api/tutor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw Error();
    const result = (await response.json()) as TutorView;
    if (
      !["pending", "running", "completed", "fallback", "cancelled"].includes(result.status) ||
      ((result.status === "pending" ||
        result.status === "running" ||
        result.status === "cancelled") &&
        result.response !== null)
    )
      throw Error();
    return result;
  }
  async function run(retry = false) {
    const attemptId = getAttemptId();
    if (!attemptId) {
      setStatus("Wait for your owned attempt to finish syncing.");
      return;
    }
    const token = ++epoch.current;
    if (!retry || current.current?.attempt !== attemptId) {
      const key = `tutor-${crypto.randomUUID()}`;
      current.current = {
        attempt: attemptId,
        key,
        id: null,
        body: {
          attemptId,
          intent: debug ? "debug" : "explain",
          query,
          requestedTier: 1,
          shareCode: debug && shareCode,
          idempotencyKey: key,
        },
      };
    }
    const turn = current.current!;
    setHasRequest(true);
    setStatus("Pending — waiting for validated guidance.");
    setView(null);
    try {
      let result = await request({ action: "start", input: turn.body });
      if (token !== epoch.current) return;
      turn.id = result.requestId;
      setView(result);
      if (result.status === "pending")
        result = await request({ action: "complete", requestId: result.requestId });
      if (token !== epoch.current) return;
      setView(result);
      setStatus(
        result.status === "completed"
          ? "Validated guidance saved."
          : result.status === "fallback"
            ? "Authored fallback or unavailable guidance."
            : result.status === "cancelled"
              ? "Request cancelled."
              : "Still pending. Retry to check the saved request.",
      );
    } catch {
      if (token === epoch.current)
        setStatus("Guidance could not be confirmed. Retry the same request.");
    }
  }
  async function cancel() {
    const turn = current.current;
    const token = ++epoch.current;
    if (!turn?.id) {
      setView(null);
      setStatus("Stop requested. Retry later to check any saved request.");
      return;
    }
    try {
      const result = await request({ action: "cancel", requestId: turn.id });
      if (token !== epoch.current) return;
      setView(result);
      setStatus(
        result.status === "cancelled"
          ? "Request cancelled."
          : "The saved request has already completed.",
      );
    } catch {
      if (token !== epoch.current) return;
      setView(null);
      setStatus("Cancellation could not be confirmed. Retry to check the saved request.");
    }
  }
  return (
    <section className="ac-tutor-panel" aria-labelledby="tutor-title">
      <h3 id="tutor-title">Optional tutor clarification</h3>
      <label htmlFor={questionId}>Question</label>
      <textarea
        id={questionId}
        value={query}
        rows={3}
        maxLength={500}
        onChange={(e) => setQuery(e.target.value)}
      />
      <label>
        <input
          type="checkbox"
          checked={debug}
          onChange={(e) => {
            setDebug(e.target.checked);
            setShareCode(false);
          }}
        />{" "}
        Debug my saved code
      </label>
      {debug ? (
        <label>
          <input
            type="checkbox"
            checked={shareCode}
            onChange={(e) => setShareCode(e.target.checked)}
          />{" "}
          Send my saved code for this debug request, only if the configured data policy permits it.
        </label>
      ) : null}
      <p role="status">{status}</p>
      <div className="ac-tutor-actions">
        <button
          className="ac-small-button"
          type="button"
          disabled={!available || !query.trim()}
          onClick={() => void run()}
        >
          Ask tutor
        </button>
        <button
          className="ac-small-button"
          type="button"
          disabled={!hasRequest}
          onClick={() => void run(true)}
        >
          Retry saved request
        </button>
        <button
          className="ac-small-button"
          type="button"
          disabled={!hasRequest}
          onClick={() => void cancel()}
        >
          Cancel tutor request
        </button>
      </div>
      {view?.response ? (
        <div>
          <p>{view.response.message}</p>
          <ul>
            {view.response.citations.map((c) => (
              <li key={c.evidenceItemId}>{c.title}</li>
            ))}
          </ul>
          <p>Assistance tier {view.response.hintTier} recorded.</p>
        </div>
      ) : null}
    </section>
  );
}
