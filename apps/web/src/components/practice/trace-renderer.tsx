"use client";

import {
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import {
  replayTrace,
  traceTranscript,
  validateTraceDocument,
  type TraceReplay,
} from "@algocove/visualizer";

export type TraceRendererProps = {
  readonly trace: unknown;
  readonly calculation?: "container_area";
};

export default function TraceRenderer({ trace, calculation }: TraceRendererProps): ReactElement {
  const documentResult = useMemo(() => validateTraceDocument(trace), [trace]);
  const transcript = useMemo(() => traceTranscript(trace), [trace]);
  const maxStep = documentResult.ok ? documentResult.value.events.length : 0;
  const [navigation, setNavigation] = useState<{ readonly trace: unknown; readonly step: number }>({
    trace,
    step: 0,
  });
  const [spatial, setSpatial] = useState(true);
  const [angle, setAngle] = useState(-18);
  const [tilt, setTilt] = useState(24);
  const step = navigation.trace === trace ? navigation.step : 0;

  const replay = useMemo(() => {
    if (!documentResult.ok) return null;
    return replayTrace(documentResult.value, step);
  }, [documentResult, step]);

  if (!documentResult.ok || !transcript.ok || replay === null) {
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

  if (!replay.ok) {
    return (
      <section aria-labelledby="trace-unavailable-title" className="ac-trace ac-trace--error">
        <h2 id="trace-unavailable-title">Trace unavailable</h2>
        <p role="status">The selected trace step could not be replayed safely.</p>
      </section>
    );
  }

  const leftIdx = replay.value.state.left;
  const rightIdx = replay.value.state.right;
  const values = replay.value.state.values;
  const currentLeftVal = leftIdx >= 0 && leftIdx < values.length ? (values[leftIdx] ?? null) : null;
  const currentRightVal =
    rightIdx >= 0 && rightIdx < values.length ? (values[rightIdx] ?? null) : null;
  const distance = leftIdx >= 0 && rightIdx >= 0 && rightIdx >= leftIdx ? rightIdx - leftIdx : 0;
  const minHeight =
    currentLeftVal !== null && currentRightVal !== null
      ? Math.min(currentLeftVal, currentRightVal)
      : null;
  const currentArea =
    calculation === "container_area" && minHeight !== null ? minHeight * distance : null;

  const move = (nextStep: number): void => {
    setNavigation({ trace, step: Math.max(0, Math.min(maxStep, nextStep)) });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.target instanceof HTMLElement && event.target.matches("input, select, textarea"))
      return;
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

      {currentArea !== null && (
        <div className="ac-trace-calculation" aria-live="polite">
          <span className="ac-trace-calc-label">State calculation:</span>
          <span className="ac-trace-calc-formula">
            Width = <strong>{distance}</strong> · Height = min(
            <span className="ac-val-jade">
              h[{leftIdx}]={currentLeftVal}
            </span>
            ,{" "}
            <span className="ac-val-coral">
              h[{rightIdx}]={currentRightVal}
            </span>
            ) = <strong>{minHeight}</strong>
          </span>
          <span className="ac-trace-calc-result">
            Current Area = <strong>{currentArea}</strong>
          </span>
        </div>
      )}

      <div className="ac-trace-view-controls" role="group" aria-label="Trace view">
        <button type="button" aria-pressed={spatial} onClick={() => setSpatial((value) => !value)}>
          {spatial ? "Use flat view" : "Use 3D view"}
        </button>
        {spatial && (
          <>
            <div className="ac-trace-camera-presets" role="group" aria-label="Camera presets">
              <button
                type="button"
                className={`ac-preset-button${angle === -18 && tilt === 24 ? " is-active" : ""}`}
                onClick={() => {
                  setAngle(-18);
                  setTilt(24);
                }}
              >
                Isometric 3D
              </button>
              <button
                type="button"
                className={`ac-preset-button${angle === 0 && tilt === 45 ? " is-active" : ""}`}
                onClick={() => {
                  setAngle(0);
                  setTilt(45);
                }}
              >
                Top-Down
              </button>
              <button
                type="button"
                className={`ac-preset-button${angle === 0 && tilt === 0 ? " is-active" : ""}`}
                onClick={() => {
                  setAngle(0);
                  setTilt(0);
                }}
              >
                Front View
              </button>
            </div>
            <label>
              Rotate{" "}
              <input
                type="range"
                min="-45"
                max="45"
                value={angle}
                onChange={(event) => setAngle(Number(event.target.value))}
              />
            </label>
            <label>
              Tilt{" "}
              <input
                type="range"
                min="0"
                max="45"
                value={tilt}
                onChange={(event) => setTilt(Number(event.target.value))}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setAngle(-18);
                setTilt(24);
              }}
            >
              Reset view
            </button>
          </>
        )}
      </div>
      <div
        className={`ac-trace-stage${spatial ? " is-spatial" : ""}`}
        tabIndex={0}
        aria-label="Trace values"
      >
        <div
          aria-label="Array values"
          className="ac-trace-values"
          role="list"
          style={{ "--trace-angle": `${angle}deg`, "--trace-tilt": `${tilt}deg` } as CSSProperties}
        >
          {replay.value.state.values.map((value, index) => (
            <span
              aria-label={cellLabel(value, index, replay.value)}
              className="ac-trace-value"
              data-active={isActiveIndex(index, replay.value) ? "true" : "false"}
              data-answer={replay.value.state.answer?.includes(index) ? "true" : "false"}
              data-pointer-left={replay.value.state.left === index ? "true" : "false"}
              data-pointer-right={replay.value.state.right === index ? "true" : "false"}
              key={`${index}-${value}`}
              role="listitem"
            >
              <span className="ac-trace-cube" aria-hidden="true">
                <span className="ac-trace-face ac-trace-face--front">{value}</span>
                <span className="ac-trace-face ac-trace-face--top" />
                <span className="ac-trace-face ac-trace-face--side" />
              </span>
              <small aria-hidden="true">{index}</small>
              <span className="ac-trace-pointer" aria-hidden="true">
                {replay.value.state.left === index && (
                  <span className="ac-pointer-badge ac-pointer-badge--left">L</span>
                )}
                {replay.value.state.right === index && (
                  <span className="ac-pointer-badge ac-pointer-badge--right">R</span>
                )}
                {replay.value.state.answer?.includes(index) && (
                  <span className="ac-pointer-badge ac-pointer-badge--answer">✓</span>
                )}
              </span>
            </span>
          ))}
        </div>
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
        {transcript.value.slice(0, step + 1).map((line, index) => (
          <li key={`${index}-${line}`}>{line}</li>
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
