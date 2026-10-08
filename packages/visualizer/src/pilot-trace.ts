export type PilotTraceState = {
  action: string;
  cursor: number;
  left: number | null;
  right: number | null;
  memory: readonly { value: number; count: number }[];
  stack: readonly number[];
  answer: number;
  explanation: string;
};
export type PilotTrace = {
  schemaVersion: 2;
  provenance: "authored_reference";
  pattern: "arrays-hashing" | "two-pointers" | "sliding-window" | "stack";
  values: readonly number[];
  states: readonly PilotTraceState[];
};
const integer = (v: unknown, max: number): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= max;
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
export function validatePilotTrace(raw: unknown): PilotTrace {
  if (
    !object(raw) ||
    Object.keys(raw).some(
      (k) => !["schemaVersion", "provenance", "pattern", "values", "states"].includes(k),
    ) ||
    raw.schemaVersion !== 2 ||
    raw.provenance !== "authored_reference" ||
    !["arrays-hashing", "two-pointers", "sliding-window", "stack"].includes(String(raw.pattern)) ||
    !Array.isArray(raw.values) ||
    raw.values.length > 100 ||
    !raw.values.every((v) => integer(v, 100)) ||
    !Array.isArray(raw.states) ||
    raw.states.length < 2 ||
    raw.states.length > 256
  )
    throw Error("Invalid bounded pilot trace.");
  const values = raw.values;
  for (const s of raw.states) {
    if (
      !object(s) ||
      Object.keys(s).some(
        (k) =>
          ![
            "action",
            "cursor",
            "left",
            "right",
            "memory",
            "stack",
            "answer",
            "explanation",
          ].includes(k),
      ) ||
      typeof s.action !== "string" ||
      ![
        "initialize",
        "count_then_insert",
        "match",
        "advance_left",
        "advance_right",
        "expand",
        "shrink",
        "record_best",
        "push",
        "pop",
        "complete",
      ].includes(s.action) ||
      typeof s.explanation !== "string" ||
      !s.explanation.trim() ||
      s.explanation.length > 2000 ||
      !integer(s.cursor, values.length) ||
      !integer(s.answer, 4950) ||
      (s.left !== null && !integer(s.left, values.length)) ||
      (s.right !== null && !integer(s.right, values.length + 1)) ||
      !Array.isArray(s.memory) ||
      s.memory.length > 101 ||
      !s.memory.every(
        (m) =>
          object(m) &&
          Object.keys(m).length === 2 &&
          integer(m.value, 100) &&
          integer(m.count, 100) &&
          m.count > 0,
      ) ||
      new Set(s.memory.map((m) => m.value)).size !== s.memory.length ||
      !Array.isArray(s.stack) ||
      s.stack.length > 100 ||
      !s.stack.every((v) => integer(v, 100))
    )
      throw Error("Invalid pilot trace state.");
    if (
      raw.pattern === "stack" &&
      (s.left !== null || s.right !== null || s.memory.length !== 0 || s.answer !== s.stack.length)
    )
      throw Error("Invalid stack state.");
    if (
      raw.pattern === "arrays-hashing" &&
      (s.left !== null || s.right !== null || s.stack.length !== 0)
    )
      throw Error("Invalid hash state.");
    if (
      raw.pattern === "two-pointers" &&
      (s.memory.length !== 0 ||
        s.stack.length !== 0 ||
        s.left === null ||
        s.right === null ||
        s.left >= s.right)
    )
      throw Error("Invalid pointer state.");
    if (
      raw.pattern === "sliding-window" &&
      (s.stack.length !== 0 ||
        s.left === null ||
        (s.right !== null && s.left > s.right) ||
        (s.action === "record_best" && s.memory.length > 2))
    )
      throw Error("Invalid window state.");
  }
  if (
    raw.states[0].action !== "initialize" ||
    raw.states.at(-1).action !== "complete" ||
    raw.states.slice(0, -1).some((s) => s.action === "complete")
  )
    throw Error("Trace requires initial and terminal states.");
  return structuredClone(raw) as PilotTrace;
}
export function pilotTraceTranscript(raw: unknown): readonly string[] {
  const t = validatePilotTrace(raw);
  return t.states.map(
    (s, i) =>
      `Step ${i}: ${s.action.replaceAll("_", " ")}. ${s.explanation} Processed ${s.cursor} of ${t.values.length}. Left: ${s.left ?? "none"}; right: ${s.right ?? "none"}. Counts: ${s.memory.map((m) => `${m.value}=${m.count}`).join(", ") || "empty"}. Stack from bottom to top: ${s.stack.join(", ") || "empty"}; top: ${s.stack.at(-1) ?? "none"}. Result so far: ${s.answer}.`,
  );
}
