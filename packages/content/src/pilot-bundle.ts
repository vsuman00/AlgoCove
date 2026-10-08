import { PROBLEM_LANGUAGES, type ProblemLanguage } from "@algocove/domain";

export const PILOT_PATTERNS = [
  "arrays-hashing",
  "two-pointers",
  "sliding-window",
  "stack",
] as const;
export type PilotPattern = (typeof PILOT_PATTERNS)[number];
export type PilotState = {
  action: string;
  cursor: number;
  left: number | null;
  right: number | null;
  memory: readonly { value: number; count: number }[];
  stack: readonly number[];
  answer: number;
  explanation: string;
};
export type PilotBundle = {
  readinessQuestions: {
    id: string;
    category: string;
    prompt: string;
    options: { value: string; label: string }[];
    answer: string;
  }[];
  schemaVersion: 1;
  version: string;
  pattern: PilotPattern;
  slug: string;
  title: string;
  statement: string;
  rights: { kind: "original"; rightsHolder: "AlgoCove"; license: "original-v1" };
  semantics: {
    maxLength: 100;
    minValue: 0;
    maxValue: number;
    sortedDistinct: boolean;
    output: "integer";
    mutation: "forbidden";
  };
  lesson: {
    summary: string;
    recognition: string[];
    invariant: string;
    complexity: string;
    pitfalls: string[];
  };
  pseudocode: Record<string, string>;
  hints: { tier: number; text: string }[];
  languages: Record<ProblemLanguage, { starter: string; solution: string; commonErrors: string[] }>;
  fixtures: { id: string; values: number[]; expected: number }[];
  trace: { values: number[]; states: PilotState[] };
  review: {
    afterDays: number[];
    prompt: string;
    options: { id: string; text: string }[];
    correctOption: string;
    rationale: string;
  };
  transfer: {
    delayDays: number;
    title: string;
    statement: string;
    invariant: string;
    expectedReasoning: string;
    checkpoint: { prompt: string; options: { id: string; text: string }[]; correctOption: string };
  };
};

/** Full authoring payload is server/operator-only; never serialize this into learner pages. */
export function validatePilotBundle(raw: unknown): PilotBundle {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    throw Error("Bundle required.");
  const keys = (v: unknown, allowed: string[]) => {
    if (
      !v ||
      typeof v !== "object" ||
      Array.isArray(v) ||
      Object.keys(v).some((k) => !allowed.includes(k))
    )
      throw Error("Unsupported bundle field.");
  };
  keys(raw, [
    "readinessQuestions",
    "schemaVersion",
    "version",
    "pattern",
    "slug",
    "title",
    "statement",
    "rights",
    "semantics",
    "lesson",
    "pseudocode",
    "hints",
    "languages",
    "fixtures",
    "trace",
    "review",
    "transfer",
  ]);
  const b = raw as PilotBundle;
  if (
    !Array.isArray(b.readinessQuestions) ||
    b.readinessQuestions.length !== 5 ||
    new Set(b.readinessQuestions.map((q) => q.category)).size !== 5
  )
    throw Error("Five readiness categories required.");
  b.readinessQuestions.forEach((q) => {
    keys(q, ["id", "category", "prompt", "options", "answer"]);
    if (
      !["concept", "pattern", "invariant", "pseudocode", "visualization"].includes(q.category) ||
      q.id !== q.category ||
      typeof q.prompt !== "string" ||
      q.prompt.length < 1 ||
      q.prompt.length > 1600 ||
      !Array.isArray(q.options) ||
      q.options.length < 2 ||
      q.options.length > 8 ||
      new Set(q.options.map((o) => o.value)).size !== q.options.length ||
      !q.options.some((o) => o.value === q.answer)
    )
      throw Error("Invalid readiness checkpoint.");
    q.options.forEach((o) => {
      keys(o, ["value", "label"]);
      if (
        typeof o.value !== "string" ||
        !o.value ||
        o.value.length > 128 ||
        typeof o.label !== "string" ||
        !o.label ||
        o.label.length > 500
      )
        throw Error("Bounded readiness options required.");
    });
  });
  keys(b.rights, ["kind", "rightsHolder", "license"]);
  keys(b.semantics, ["maxLength", "minValue", "maxValue", "sortedDistinct", "output", "mutation"]);
  keys(b.lesson, ["summary", "recognition", "invariant", "complexity", "pitfalls"]);
  keys(b.pseudocode, [
    "inputs",
    "state",
    "initialization",
    "invariant",
    "loop",
    "termination",
    "output",
    "complexity",
  ]);
  keys(b.languages, [...PROBLEM_LANGUAGES]);
  for (const l of PROBLEM_LANGUAGES) keys(b.languages[l], ["starter", "solution", "commonErrors"]);
  keys(b.trace, ["values", "states"]);
  keys(b.review, ["afterDays", "prompt", "options", "correctOption", "rationale"]);
  keys(b.transfer, [
    "delayDays",
    "title",
    "statement",
    "invariant",
    "expectedReasoning",
    "checkpoint",
  ]);
  if (
    !Array.isArray(b.hints) ||
    !Array.isArray(b.fixtures) ||
    !Array.isArray(b.trace.states) ||
    !Array.isArray(b.review.options)
  )
    throw Error("Bundle arrays required.");
  b.hints.forEach((h) => keys(h, ["tier", "text"]));
  b.fixtures.forEach((f) => keys(f, ["id", "values", "expected"]));
  b.review.options.forEach((o) => keys(o, ["id", "text"]));
  b.trace.states.forEach((state) => {
    keys(state, ["action", "cursor", "left", "right", "memory", "stack", "answer", "explanation"]);
    if (!Array.isArray(state.memory)) throw Error("Trace memory required.");
    state.memory.forEach((m) => keys(m, ["value", "count"]));
  });
  keys(b.transfer.checkpoint, ["prompt", "options", "correctOption"]);
  if (!textCheckpoint(b.transfer.checkpoint)) throw Error("Transfer checkpoint required.");
  b.transfer.checkpoint.options.forEach((o) => keys(o, ["id", "text"]));
  const text = (value: unknown) =>
    typeof value === "string" && value.trim().length > 0 && value.length <= 20_000;
  if (
    b.schemaVersion !== 1 ||
    !PILOT_PATTERNS.includes(b.pattern) ||
    !text(b.version) ||
    !text(b.title) ||
    !text(b.statement) ||
    !/^[a-z][a-z0-9-]{1,63}$/.test(b.slug)
  )
    throw Error("Invalid bundle identity.");
  if (
    b.rights?.kind !== "original" ||
    b.rights.rightsHolder !== "AlgoCove" ||
    b.rights.license !== "original-v1"
  )
    throw Error("Original rights required.");
  if (
    b.semantics?.maxLength !== 100 ||
    b.semantics.minValue !== 0 ||
    !Number.isSafeInteger(b.semantics.maxValue) ||
    b.semantics.maxValue < 1 ||
    b.semantics.maxValue > 100 ||
    typeof b.semantics.sortedDistinct !== "boolean" ||
    b.semantics.output !== "integer" ||
    b.semantics.mutation !== "forbidden"
  )
    throw Error("Portable bounded semantics required.");
  if (
    !text(b.lesson?.summary) ||
    !text(b.lesson.invariant) ||
    !text(b.lesson.complexity) ||
    !b.lesson.recognition?.length ||
    !b.lesson.recognition.every(text) ||
    !b.lesson.pitfalls?.length ||
    !b.lesson.pitfalls.every(text)
  )
    throw Error("Complete lesson required.");
  if (
    !b.pseudocode ||
    [
      "inputs",
      "state",
      "initialization",
      "invariant",
      "loop",
      "termination",
      "output",
      "complexity",
    ].some((k) => !text(b.pseudocode[k]))
  )
    throw Error("Complete reasoning rubric required.");
  if (
    !Array.isArray(b.hints) ||
    b.hints.length !== 6 ||
    b.hints.some((h, i) => h.tier !== i + 1 || !text(h.text))
  )
    throw Error("Six ordered hint tiers required.");
  if (
    !b.languages ||
    Object.keys(b.languages).length !== 6 ||
    PROBLEM_LANGUAGES.some(
      (l) =>
        !text(b.languages[l]?.starter) ||
        !text(b.languages[l]?.solution) ||
        !b.languages[l]?.commonErrors?.length ||
        !b.languages[l].commonErrors.every(text),
    )
  )
    throw Error("Six complete languages required.");
  if (
    !Array.isArray(b.fixtures) ||
    b.fixtures.length < 6 ||
    b.fixtures.length > 32 ||
    new Set(b.fixtures.map((f) => f.id)).size !== b.fixtures.length
  )
    throw Error("Distinct semantic fixtures required.");
  for (const f of b.fixtures) {
    if (
      !text(f.id) ||
      !validValues(f.values, b) ||
      !Number.isSafeInteger(f.expected) ||
      f.expected < 0 ||
      f.expected > 4950
    )
      throw Error("Invalid semantic fixture.");
  }
  const allowedActions: Record<PilotPattern, string[]> = {
    "arrays-hashing": ["initialize", "count_then_insert", "complete"],
    "two-pointers": ["initialize", "advance_left", "advance_right", "match", "complete"],
    "sliding-window": ["initialize", "expand", "shrink", "record_best", "complete"],
    stack: ["initialize", "push", "pop", "complete"],
  };
  for (const state of b.trace.states) {
    const index = (v: unknown, limit: number) =>
      v === null || (Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) <= limit);
    if (
      !allowedActions[b.pattern]?.includes(state.action) ||
      typeof state.explanation !== "string" ||
      !state.explanation.trim() ||
      state.explanation.length > 2000 ||
      !Number.isSafeInteger(state.cursor) ||
      state.cursor < 0 ||
      state.cursor > b.trace.values.length ||
      !index(state.left, b.trace.values.length) ||
      !index(state.right, b.trace.values.length + 1) ||
      !Number.isSafeInteger(state.answer) ||
      state.answer < 0 ||
      state.answer > 4950 ||
      !Array.isArray(state.stack) ||
      state.stack.length > 100 ||
      state.stack.some((v) => !Number.isSafeInteger(v) || v < 0 || v > 100) ||
      state.memory.length > 101 ||
      new Set(state.memory.map((m) => m.value)).size !== state.memory.length ||
      state.memory.some(
        (m) =>
          !Number.isSafeInteger(m.value) ||
          m.value < 0 ||
          m.value > 100 ||
          !Number.isSafeInteger(m.count) ||
          m.count < 1 ||
          m.count > 100,
      )
    )
      throw Error("Invalid bounded trace state.");
    if (
      (b.pattern === "stack" &&
        (state.left !== null ||
          state.right !== null ||
          state.memory.length !== 0 ||
          state.answer !== state.stack.length)) ||
      (b.pattern === "arrays-hashing" &&
        (state.left !== null || state.right !== null || state.stack.length !== 0)) ||
      (b.pattern === "two-pointers" &&
        (state.memory.length !== 0 ||
          state.stack.length !== 0 ||
          state.left === null ||
          state.right === null ||
          state.left >= state.right)) ||
      (b.pattern === "sliding-window" &&
        (state.stack.length !== 0 ||
          state.left === null ||
          (state.right !== null && state.left > state.right) ||
          (state.action === "record_best" && state.memory.length > 2)))
    )
      throw Error("Invalid pattern trace state.");
  }
  if (
    b.trace.states[0]?.action !== "initialize" ||
    b.trace.states.at(-1)?.action !== "complete" ||
    b.trace.states.slice(0, -1).some((s) => s.action === "complete")
  )
    throw Error("Trace needs initial and terminal states.");
  if (
    !validValues(b.trace?.values, b) ||
    !Array.isArray(b.trace.states) ||
    b.trace.states.length < 2 ||
    b.trace.states.length > 256 ||
    b.trace.states.some((s) => !text(s.action) || !text(s.explanation))
  )
    throw Error("Bounded explained trace required.");
  if (
    !b.review?.afterDays?.length ||
    b.review.afterDays.some((d) => !Number.isSafeInteger(d) || d < 1 || d > 365) ||
    !text(b.review.prompt) ||
    b.review.options?.length < 2 ||
    b.review.options.length > 8 ||
    b.review.prompt.length > 1600 ||
    !b.review.options.every(
      (o) => text(o.id) && o.id.length <= 128 && text(o.text) && o.text.length <= 500,
    ) ||
    new Set(b.review.options.map((o) => o.id)).size !== b.review.options.length ||
    !b.review.options.some((o) => o.id === b.review.correctOption) ||
    !text(b.review.rationale)
  )
    throw Error("Delayed review required.");
  if (
    !b.transfer ||
    !Number.isSafeInteger(b.transfer.delayDays) ||
    b.transfer.delayDays < 1 ||
    b.transfer.delayDays > 365 ||
    !text(b.transfer.title) ||
    !text(b.transfer.statement) ||
    !text(b.transfer.invariant) ||
    !text(b.transfer.expectedReasoning)
  )
    throw Error("Delayed transfer required.");
  return structuredClone(b);
}
function validValues(values: unknown, b: PilotBundle): values is number[] {
  return (
    Array.isArray(values) &&
    values.length <= b.semantics.maxLength &&
    values.every(
      (v, i) =>
        Number.isSafeInteger(v) &&
        v >= 0 &&
        v <= b.semantics.maxValue &&
        (!b.semantics.sortedDistinct || i === 0 || values[i - 1] < v),
    )
  );
}

export type PilotPublicView = Pick<
  PilotBundle,
  "pattern" | "slug" | "version" | "lesson" | "semantics"
> & {
  checkpoint: { id: string; prompt: string; options: { id: string; text: string }[] };
  transfer: Pick<PilotBundle["transfer"], "delayDays" | "title" | "statement">;
};
export function pilotPublicView(bundle: PilotBundle): PilotPublicView {
  return structuredClone({
    pattern: bundle.pattern,
    slug: bundle.slug,
    version: bundle.version,
    lesson: bundle.lesson,
    semantics: bundle.semantics,
    checkpoint: { id: "pattern", prompt: bundle.review.prompt, options: bundle.review.options },
    transfer: {
      delayDays: bundle.transfer.delayDays,
      title: bundle.transfer.title,
      statement: bundle.transfer.statement,
    },
  });
}

function textCheckpoint(c: PilotBundle["transfer"]["checkpoint"]): boolean {
  return (
    typeof c.prompt === "string" &&
    c.prompt.length > 0 &&
    c.prompt.length <= 1600 &&
    Array.isArray(c.options) &&
    c.options.length >= 2 &&
    c.options.length <= 8 &&
    new Set(c.options.map((o) => o.id)).size === c.options.length &&
    c.options.every(
      (o) =>
        typeof o.id === "string" &&
        o.id.length > 0 &&
        o.id.length <= 128 &&
        typeof o.text === "string" &&
        o.text.length > 0 &&
        o.text.length <= 500,
    ) &&
    c.options.some((o) => o.id === c.correctOption)
  );
}

/** Stable serialization survives JSONB key ordering and formatting changes. */
export function canonicalPilotBundle(bundle: PilotBundle): string {
  const canonical = (value: unknown): string => {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  };
  return canonical(validatePilotBundle(bundle));
}
