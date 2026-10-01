"use client";
import { useState, type ReactElement } from "react";
import { replayTrace, type TraceDocument } from "@algocove/visualizer";
import TraceRenderer from "./trace-renderer";

const INITIAL_DRAFT: TraceDocument = {
  schemaVersion: 1,
  traceId: "container-learner-draft",
  version: 1,
  provenance: "learner_draft",
  structure: "array_two_pointer",
  initialValues: [1, 8, 6, 2, 5, 4, 8, 3, 7],
  events: [{ kind: "compare", left: 0, right: 8 }],
};

export default function TraceWorkspace({
  getAttemptId,
  onExposure,
}: {
  getAttemptId: () => string | undefined;
  onExposure: (tier: number) => void;
}): ReactElement {
  const [draft, setDraft] = useState(INITIAL_DRAFT);
  const [text, setText] = useState(JSON.stringify(INITIAL_DRAFT, null, 2));
  const [reference, setReference] = useState<TraceDocument | null>(null);
  const [status, setStatus] = useState(
    "Learner trace edits stay in this tab. Schema validity does not prove algorithm correctness.",
  );
  const [prediction, setPrediction] = useState("");
  const [loading, setLoading] = useState(false);
  const apply = () => {
    try {
      if (text.length > 32768) throw new Error("too large");
      const candidate: unknown = JSON.parse(text);
      const parsed = replayTrace(candidate);
      if (!parsed.ok) throw new Error("invalid trace");
      const next = { ...(candidate as TraceDocument), provenance: "learner_draft" as const };
      setDraft(next);
      setReference(null);
      setStatus("Learner trace schema accepted. Algorithm correctness has not been verified.");
    } catch {
      setStatus(
        "Trace edit rejected: invalid or unsupported events. The last valid trace is retained; the reviewed reference remains available.",
      );
    }
  };
  const reveal = async () => {
    const attemptId = getAttemptId();
    if (attemptId === undefined) {
      setStatus("Sign in and sync the workspace to reveal the reviewed trace.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/practice/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId }),
      });
      if (!response.ok) throw new Error("unavailable");
      const body = (await response.json()) as { trace: TraceDocument; exposure: { tier: number } };
      if (!replayTrace(body.trace).ok || body.exposure.tier !== 4) throw new Error("invalid trace");
      onExposure(body.exposure.tier);
      setReference(body.trace);
      setStatus("Reviewed reference revealed after scaffold-tier assistance was recorded.");
    } catch {
      setStatus(
        "Reviewed trace is unavailable. No reference was revealed; your learner draft is retained.",
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="ac-trace-workspace">
      <p role="status">{status}</p>
      <label>
        <span>Predict the next boundary</span>
        <select
          aria-label="Predict the next boundary"
          value={prediction}
          onChange={(event) => setPrediction(event.target.value)}
        >
          <option value="">Choose a prediction</option>
          <option value="left">Left</option>
          <option value="right">Right</option>
        </select>
      </label>
      <button
        className="ac-small-button"
        type="button"
        disabled={!prediction}
        onClick={() => {
          const next: TraceDocument = {
            ...draft,
            events: [
              ...draft.events,
              {
                kind: "prediction_checkpoint",
                checkpointId: `prediction-${draft.events.length}`,
                prompt: "Which boundary would you move?",
                selectedOption: prediction,
              },
            ],
          };
          const encoded = JSON.stringify(next, null, 2);
          setText(encoded);
          if (replayTrace(next).ok) {
            setDraft(next);
            setReference(null);
            setStatus("Prediction added to your learner trace. It is self-authored evidence.");
          } else
            setStatus(
              "Prediction could not be added after a completed or full trace; edit the draft first.",
            );
        }}
      >
        Record trace prediction
      </button>
      <details>
        <summary>Edit your bounded trace</summary>
        <label>
          <span>Learner trace JSON</span>
          <textarea
            aria-label="Learner trace JSON"
            value={text}
            maxLength={32768}
            onChange={(event) => setText(event.target.value)}
            rows={8}
          />
        </label>
        <button className="ac-small-button" type="button" onClick={apply}>
          Apply trace edit
        </button>
      </details>
      <button
        className="ac-small-button"
        type="button"
        disabled={loading}
        onClick={() => void reveal()}
      >
        Reveal reviewed trace
      </button>
      <TraceRenderer trace={reference ?? draft} />
    </div>
  );
}
