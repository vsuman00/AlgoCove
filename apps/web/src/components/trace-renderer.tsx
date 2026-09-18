"use client";

import { useMemo, useState, type KeyboardEvent, type ReactElement } from "react";
import {
  replayTrace,
  traceTranscript,
  validateTraceDocument,
  type TraceReplay,
} from "@algocove/visualizer";

export type TraceRendererProps = {
  readonly trace: unknown;
};

export default function TraceRenderer({ trace }: TraceRendererProps): ReactElement {
  const documentResult = useMemo(() => validateTraceDocument(trace), [trace]);
  const transcript = useMemo(() => traceTranscript(trace), [trace]);
  const maxStep = documentResult.ok ? documentResult.value.events.length : 0;
  const [navigation, setNavigation] = useState<{ readonly trace: unknown; readonly step: number }>({
    trace,
    step: 0,
  });
  const step = navigation.trace === trace ? navigation.step : 0;

  if (!documentResult.ok || !transcript.ok) {
    return (
      <section aria-labelledby="trace-unavailable-title" className="ac-trace ac-trace--error">
        <h2 id="trace-unavailable-title">Trace unavailable</h2>
        <p role="status">
          This trace is invalid or unsupported. AlgoCove will not invent visual states; use the
          reviewed reference trace when one is available.
        </p>
      </section>
    );
  }

  const replay = replayTrace(documentResult.value, step);
  if (!replay.ok) {
    return (
      <section aria-labelledby="trace-unavailable-title" className="ac-trace ac-trace--error">
        <h2 id="trace-unavailable-title">Trace unavailable</h2>
        <p role="status">The selected trace step could not be replayed safely.</p>
      </section>
    );
  }

  const move = (nextStep: number): void => {
    setNavigation({ trace, step: Math.max(0, Math.min(maxStep, nextStep)) });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      move(step + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(step - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      move(0);
    } else if (event.key === "End") {
      event.preventDefault();
      move(maxStep);
    }
  };

  return (
    <section
      aria-labelledby="trace-title"
      aria-describedby="trace-instructions"
      className="ac-trace"
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      <header>
        <p className="ac-eyebrow">{labelForProvenance(replay.value)}</p>
        <h2 id="trace-title">Array trace</h2>
        <p id="trace-instructions">
          Use Left and Right Arrow to move one step. Home and End jump to the beginning or end.
        </p>
      </header>

      <div className="ac-trace-status" aria-live="polite" role="status">
        Step {replay.value.state.step} of {maxStep}. {stateSummary(replay.value)}
      </div>

      <div aria-label="Array values" className="ac-trace-values" role="list">
        {replay.value.state.values.map((value, index) => (
          <span
            aria-label={cellLabel(value, index, replay.value)}
            className="ac-trace-value"
            data-active={isActiveIndex(index, replay.value) ? "true" : "false"}
            key={`${index}-${value}`}
            role="listitem"
          >
            <span aria-hidden="true">{value}</span>
            <small aria-hidden="true">{index}</small>
          </span>
        ))}
      </div>

      <div aria-label="Trace controls" className="ac-trace-controls" role="group">
        <button disabled={step === 0} onClick={() => move(step - 1)} type="button">
          Previous step
        </button>
        <button disabled={step === maxStep} onClick={() => move(step + 1)} type="button">
          Next step
        </button>
        <button disabled={step === 0} onClick={() => move(0)} type="button">
          Restart trace
        </button>
        <button disabled={step === maxStep} onClick={() => move(maxStep)} type="button">
          Complete trace
        </button>
      </div>

      <ol aria-label="Trace transcript" className="ac-trace-transcript">
        {transcript.value.slice(0, step + 1).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>
    </section>
  );
}

function labelForProvenance(replay: TraceReplay): string {
  return replay.assistanceDisclosure === "reference_trace"
    ? "Reviewed reference trace · assistance recorded"
    : "Learner draft trace";
}

function stateSummary(replay: TraceReplay): string {
  const { state } = replay;
  return `Pointers at ${state.left} and ${state.right}; status ${state.status}.`;
}

function cellLabel(value: number, index: number, replay: TraceReplay): string {
  const labels = [`Value ${value} at index ${index}`];
  if (replay.state.left === index) labels.push("left pointer");
  if (replay.state.right === index) labels.push("right pointer");
  if (replay.state.answer?.includes(index)) labels.push("recorded answer");
  return labels.join(", ");
}

function isActiveIndex(index: number, replay: TraceReplay): boolean {
  return (
    replay.state.left === index ||
    replay.state.right === index ||
    replay.state.answer?.includes(index) === true
  );
}
