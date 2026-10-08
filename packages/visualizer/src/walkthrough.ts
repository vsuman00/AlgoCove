import { validatePilotTrace, type PilotTrace, type PilotTraceState } from "./pilot-trace.ts";
export type Walkthrough = {
  schemaVersion: 3;
  approachId: string;
  scenarioId: string;
  lines: readonly { id: string; text: string }[];
  trace: PilotTrace;
  activeLineIds: readonly (readonly string[])[];
};
export type Playback = { step: number; playing: boolean; speed: number };
export type PlaybackAction =
  | { type: "seek"; step: number }
  | { type: "play" | "pause" | "tick" | "restart" }
  | { type: "speed"; speed: number };
const id = (v: unknown): v is string =>
  typeof v === "string" && /^[a-z][a-z0-9._-]{0,100}$/.test(v);
const actions: Record<string, string> = {
  initialize: "Initialize the state for an empty processed prefix.",
  count_then_insert:
    "Add the current value's earlier frequency to the pair count, then increment its frequency.",
  match: "Record the matching pair and advance both pointers.",
  advance_left: "Increase the left pointer when the current gap is too large.",
  advance_right:
    "Increase the right pointer when the current gap is too small; keep right beyond left.",
  expand: "Include the next reading in the window and update its frequency.",
  shrink: "Remove the left reading until the window has at most two labels.",
  record_best: "Compare the current valid window length with the best length.",
  push: "Push the incoming label when it differs from the stack top.",
  pop: "Pop the matching stack top and consume the incoming label.",
  complete: "Return the recorded result after processing the bounded input.",
};
/** Explicit schema-2 adapter preserves all historical pilot frames. */
export function pilotWalkthrough(raw: unknown): Walkthrough {
  const trace = validatePilotTrace(raw);
  const used = [...new Set(trace.states.map((s) => s.action))];
  return validateWalkthrough({
    schemaVersion: 3,
    approachId: `${trace.pattern}.v1`,
    scenarioId: `${trace.pattern}.reference.v1`,
    lines: used.map((action) => ({ id: action, text: actions[action]! })),
    trace,
    activeLineIds: trace.states.map((s) => [s.action]),
  });
}
export function validateWalkthrough(raw: unknown): Walkthrough {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Error("Walkthrough required.");
  const w = raw as Walkthrough;
  if (
    Object.keys(w).some(
      (k) =>
        !["schemaVersion", "approachId", "scenarioId", "lines", "trace", "activeLineIds"].includes(
          k,
        ),
    ) ||
    w.schemaVersion !== 3 ||
    !id(w.approachId) ||
    !id(w.scenarioId) ||
    !Array.isArray(w.lines) ||
    w.lines.length < 1 ||
    w.lines.length > 64 ||
    new Set(w.lines.map((l) => l?.id)).size !== w.lines.length ||
    !w.lines.every(
      (l) =>
        l &&
        Object.keys(l).every((k) => ["id", "text"].includes(k)) &&
        id(l.id) &&
        typeof l.text === "string" &&
        l.text.length > 0 &&
        l.text.length <= 1000 &&
        !/<\/?[a-z!]/i.test(l.text),
    )
  )
    throw Error("Invalid pseudocode line contract.");
  const trace = validatePilotTrace(w.trace);
  if (
    !Array.isArray(w.activeLineIds) ||
    w.activeLineIds.length !== trace.states.length ||
    !w.activeLineIds.every(
      (ids) =>
        Array.isArray(ids) &&
        ids.length >= 1 &&
        ids.length <= 8 &&
        new Set(ids).size === ids.length &&
        ids.every((i) => w.lines.some((l) => l.id === i)),
    )
  )
    throw Error("Invalid active line references.");
  return structuredClone({ ...w, trace });
}
export function walkthroughFrame(
  w: Walkthrough,
  step: number,
): {
  index: number;
  activeLineIds: readonly string[];
  state: PilotTraceState;
  variables: Record<string, string | number>;
} {
  if (!Number.isInteger(step) || step < 0 || step >= w.trace.states.length)
    throw Error("Step outside walkthrough.");
  const state = structuredClone(w.trace.states[step]!);
  return {
    index: step,
    activeLineIds: [...w.activeLineIds[step]!],
    state,
    variables: {
      processed: state.cursor,
      left: state.left ?? "none",
      right: state.right ?? "none",
      result: state.answer,
      frequencies: state.memory.map((m) => `${m.value}=${m.count}`).join(", ") || "empty",
      stack: state.stack.join(", ") || "empty",
    },
  };
}
export function playbackReducer(
  current: Playback,
  action: PlaybackAction,
  count: number,
): Playback {
  const last = Math.max(0, count - 1);
  if (action.type === "speed")
    return [0.5, 1, 2, 4].includes(action.speed) ? { ...current, speed: action.speed } : current;
  if (action.type === "pause") return { ...current, playing: false };
  if (action.type === "restart") return { ...current, step: 0, playing: false };
  if (action.type === "play") return { ...current, playing: current.step < last };
  if (action.type === "seek")
    return Number.isInteger(action.step)
      ? { ...current, step: Math.max(0, Math.min(last, action.step)), playing: false }
      : current;
  if (!current.playing) return current;
  const step = Math.min(last, current.step + 1);
  return { ...current, step, playing: step < last };
}
