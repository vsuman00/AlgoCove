"use client";
import { useEffect, useId, useMemo, useReducer, useState, type ReactElement } from "react";
import {
  validatePilotTrace,
  pilotTraceTranscript,
  pilotWalkthrough,
  validateWalkthrough,
  walkthroughFrame,
  playbackReducer,
  type Walkthrough,
  type PilotTrace,
} from "@algocove/visualizer";

export default function PilotTraceRenderer({
  trace,
  walkthrough,
  assistanceRecorded = true,
}: {
  trace: PilotTrace;
  assistanceRecorded?: boolean;
  walkthrough?: Walkthrough | undefined;
}): ReactElement {
  const label = useId();
  const parsed = useMemo(() => {
    try {
      return {
        trace: validatePilotTrace(trace),
        transcript: pilotTraceTranscript(trace),
        walkthrough: walkthrough ? validateWalkthrough(walkthrough) : pilotWalkthrough(trace),
      };
    } catch {
      return null;
    }
  }, [trace, walkthrough]);
  const [playback, dispatch] = useReducer(
    (
      state: { step: number; playing: boolean; speed: number },
      action: Parameters<typeof playbackReducer>[1],
    ) => playbackReducer(state, action, parsed?.trace.states.length ?? 1),
    { step: 0, playing: false, speed: 1 },
  );
  const step = playback.step;
  const setStep = (step: number) => dispatch({ type: "seek", step });
  useEffect(() => {
    dispatch({ type: "restart" });
  }, [trace, walkthrough]);
  useEffect(() => {
    if (!playback.playing) return;
    const timer = window.setTimeout(() => dispatch({ type: "tick" }), 1000 / playback.speed);
    return () => window.clearTimeout(timer);
  }, [playback]);
  const [flat, setFlat] = useState(true);
  const [fallback, setFallback] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce), (max-width: 600px)").matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce), (max-width: 600px)");
    const changed = () => setFallback(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);

  if (!parsed) return <p role="alert">This reference trace is invalid or unavailable.</p>;
  const index = Math.min(step, parsed.trace.states.length - 1);
  const frame = walkthroughFrame(parsed.walkthrough, index);
  const state = frame.state;
  const last = parsed.trace.states.length - 1;
  return (
    <section
      className="ac-pilot-trace"
      data-view={flat || fallback ? "flat" : "isometric"}
      aria-labelledby={label}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || e.altKey || e.ctrlKey || e.metaKey) return;
        const target =
          e.key === "ArrowRight"
            ? Math.min(last, index + 1)
            : e.key === "ArrowLeft"
              ? Math.max(0, index - 1)
              : e.key === "Home"
                ? 0
                : e.key === "End"
                  ? last
                  : null;
        if (target !== null) {
          e.preventDefault();
          setStep(target);
        }
      }}
    >
      <h3 id={label}>{parsed.trace.pattern.replaceAll("-", " ")} reference trace</h3>
      <p>
        {assistanceRecorded
          ? "Authored reference · scaffold-tier assistance recorded."
          : "Staff preview · learner assistance is not recorded."}{" "}
        Arrow keys move one step; Home and End move to the boundaries. Text-first presentation
        preserves every state. An optional isometric view uses the same data; small screens, reduced
        motion and low-power preferences retain the flat layout.
      </p>
      <p>
        Approach: {parsed.walkthrough.approachId} · Scenario: {parsed.walkthrough.scenarioId}
      </p>
      <button
        className="ac-small-button"
        type="button"
        disabled={fallback}
        aria-pressed={!flat && !fallback}
        onClick={() => setFlat((v) => !v)}
      >
        {fallback ? "Flat view for this display" : flat ? "Use isometric view" : "Use flat view"}
      </button>
      <p role="status" aria-live="polite">
        {parsed.transcript[index]}
      </p>
      <div className="ac-walkthrough-code">
        <h4>Active pseudocode</h4>
        <ol aria-label="Reviewed pseudocode lines">
          {parsed.walkthrough.lines.map((line) => (
            <li
              key={line.id}
              data-active={frame.activeLineIds.includes(line.id)}
              aria-current={frame.activeLineIds.includes(line.id) ? "step" : undefined}
            >
              <code>{line.text}</code>
            </li>
          ))}
        </ol>
      </div>
      <dl aria-label="Walkthrough variables">
        {Object.entries(frame.variables).map(([name, value]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <ol className="ac-pilot-values" aria-label="Input values by position">
        {parsed.trace.values.map((value, i) => (
          <li
            key={i}
            data-left={i === state.left}
            data-right={i === state.right}
            data-active={i === state.left || i === state.right || i === state.cursor - 1}
          >
            <span>
              Position {i}: {value}
            </span>
            {i === state.left && <strong> Left</strong>}
            {i === state.right && <strong> Right</strong>}
          </li>
        ))}
      </ol>
      {parsed.trace.pattern === "arrays-hashing" || parsed.trace.pattern === "sliding-window" ? (
        <table>
          <caption>Current label frequencies</caption>
          <thead>
            <tr>
              <th scope="col">Label</th>
              <th scope="col">Count</th>
            </tr>
          </thead>
          <tbody>
            {state.memory.map((m) => (
              <tr key={m.value}>
                <th scope="row">{m.value}</th>
                <td>{m.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {parsed.trace.pattern === "stack" ? (
        <div>
          <p>Stack bottom to top: {state.stack.join(", ") || "empty"}</p>
          <p>Top: {state.stack.at(-1) ?? "none"}</p>
          <p>Action: {state.action}</p>
          <ol className="ac-pilot-stack" aria-label="Stack from bottom to top">
            {state.stack.map((value, i) => (
              <li key={i} data-top={i === state.stack.length - 1}>
                {value}
                {i === state.stack.length - 1 && <strong> Top</strong>}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      <div className="ac-tutor-actions">
        <button
          className="ac-small-button"
          disabled={index === last && !playback.playing}
          onClick={() => dispatch({ type: playback.playing ? "pause" : "play" })}
        >
          {playback.playing ? "Pause playback" : "Play walkthrough"}
        </button>
        <label>
          Playback speed
          <select
            aria-label="Playback speed"
            value={playback.speed}
            onChange={(e) => dispatch({ type: "speed", speed: Number(e.target.value) })}
          >
            {[0.5, 1, 2, 4].map((speed) => (
              <option key={speed} value={speed}>
                {speed}×
              </option>
            ))}
          </select>
        </label>
        <label>
          Walkthrough step
          <input
            aria-label="Walkthrough step"
            type="range"
            min={0}
            max={last}
            value={index}
            onChange={(e) => setStep(Number(e.target.value))}
          />
        </label>
        <button
          className="ac-small-button"
          disabled={index === 0}
          onClick={() => setStep(index - 1)}
        >
          Previous step
        </button>
        <button
          className="ac-small-button"
          disabled={index === last}
          onClick={() => setStep(index + 1)}
        >
          Next step
        </button>
        <button className="ac-small-button" disabled={index === 0} onClick={() => setStep(0)}>
          Restart trace
        </button>
        <button className="ac-small-button" disabled={index === last} onClick={() => setStep(last)}>
          Complete trace
        </button>
      </div>
      <details>
        <summary>Full text transcript</summary>
        <ol>
          {parsed.transcript.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
      </details>
    </section>
  );
}
