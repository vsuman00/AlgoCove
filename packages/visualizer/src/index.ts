export const TRACE_SCHEMA_VERSION = 1 as const;
export const MAX_TRACE_VALUES = 128;
export const MAX_TRACE_EVENTS = 256;

export type TraceProvenance = "learner_draft" | "authored_reference";
export type TraceStructure = "array_two_pointer";

export type TraceEvent =
  | { readonly kind: "compare"; readonly left: number; readonly right: number }
  | { readonly kind: "move_left" }
  | { readonly kind: "move_right" }
  | { readonly kind: "mark_answer"; readonly left: number; readonly right: number }
  | {
      readonly kind: "prediction_checkpoint";
      readonly checkpointId: string;
      readonly prompt: string;
      readonly selectedOption: string | null;
    }
  | { readonly kind: "complete" };

export type TraceDocument = {
  readonly schemaVersion: typeof TRACE_SCHEMA_VERSION;
  readonly traceId: string;
  readonly version: number;
  readonly provenance: TraceProvenance;
  readonly structure: TraceStructure;
  readonly initialValues: readonly number[];
  readonly events: readonly TraceEvent[];
};

export type TraceState = {
  readonly step: number;
  readonly values: readonly number[];
  readonly left: number;
  readonly right: number;
  readonly compared: readonly [number, number] | null;
  readonly answer: readonly [number, number] | null;
  readonly prediction: {
    readonly checkpointId: string;
    readonly prompt: string;
    readonly selectedOption: string | null;
  } | null;
  readonly status: "ready" | "running" | "complete" | "invalid";
  readonly invalidReason: string | null;
};

export type TraceFailure = {
  readonly code: "invalid_document" | "invalid_event" | "step_out_of_range";
  readonly message: string;
};

export type TraceReplay = {
  readonly state: TraceState;
  readonly provenance: TraceProvenance;
  readonly assistanceDisclosure: "none" | "reference_trace";
};

export function validateTraceDocument(
  value: unknown,
):
  | { readonly ok: true; readonly value: TraceDocument }
  | { readonly ok: false; readonly error: TraceFailure } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return failure("invalid_document", "Trace must be an object.");
  }
  const candidate = value as Record<string, unknown>;
  if (
    candidate.schemaVersion !== TRACE_SCHEMA_VERSION ||
    typeof candidate.traceId !== "string" ||
    candidate.traceId.length === 0 ||
    !Number.isSafeInteger(candidate.version) ||
    (candidate.version as number) < 1 ||
    (candidate.provenance !== "learner_draft" && candidate.provenance !== "authored_reference") ||
    candidate.structure !== "array_two_pointer" ||
    !Array.isArray(candidate.initialValues) ||
    candidate.initialValues.length === 0 ||
    candidate.initialValues.length > MAX_TRACE_VALUES ||
    candidate.initialValues.some(
      (item) => typeof item !== "number" || !Number.isSafeInteger(item),
    ) ||
    !Array.isArray(candidate.events) ||
    candidate.events.length > MAX_TRACE_EVENTS
  ) {
    return failure("invalid_document", "Trace document is outside the bounded schema.");
  }
  const events: TraceEvent[] = [];
  for (const event of candidate.events) {
    const parsed = parseEvent(event);
    if (!parsed.ok) return parsed;
    events.push(parsed.value);
  }
  return {
    ok: true,
    value: {
      schemaVersion: TRACE_SCHEMA_VERSION,
      traceId: candidate.traceId,
      version: candidate.version as number,
      provenance: candidate.provenance,
      structure: "array_two_pointer",
      initialValues: candidate.initialValues as number[],
      events,
    },
  };
}

export function replayTrace(
  input: unknown,
  step?: number,
):
  | { readonly ok: true; readonly value: TraceReplay }
  | { readonly ok: false; readonly error: TraceFailure } {
  const document = validateTraceDocument(input);
  if (!document.ok) return document;
  const targetStep = step ?? document.value.events.length;
  if (
    !Number.isSafeInteger(targetStep) ||
    targetStep < 0 ||
    targetStep > document.value.events.length
  ) {
    return failure("step_out_of_range", "Trace step is outside the document event range.");
  }
  let state = initialState(document.value.initialValues);
  for (let index = 0; index < targetStep; index += 1) {
    const event = document.value.events[index];
    if (event === undefined) return failure("invalid_event", "Trace event is missing.");
    const next = reduceTraceEvent(state, event);
    if (!next.ok) return next;
    state = { ...next.value, step: index + 1 };
  }
  return {
    ok: true,
    value: {
      state,
      provenance: document.value.provenance,
      assistanceDisclosure:
        document.value.provenance === "authored_reference" ? "reference_trace" : "none",
    },
  };
}

export function traceTranscript(
  input: unknown,
):
  | { readonly ok: true; readonly value: readonly string[] }
  | { readonly ok: false; readonly error: TraceFailure } {
  const document = validateTraceDocument(input);
  if (!document.ok) return document;
  const lines = [`Step 0: pointers at ${0} and ${document.value.initialValues.length - 1}.`];
  let state = initialState(document.value.initialValues);
  for (let index = 0; index < document.value.events.length; index += 1) {
    const event = document.value.events[index];
    if (event === undefined) return failure("invalid_event", "Trace event is missing.");
    const next = reduceTraceEvent(state, event);
    if (!next.ok) return next;
    state = { ...next.value, step: index + 1 };
    lines.push(`Step ${index + 1}: ${describeEvent(event, state)}.`);
  }
  return { ok: true, value: lines };
}

function initialState(values: readonly number[]): TraceState {
  return {
    step: 0,
    values: [...values],
    left: 0,
    right: values.length - 1,
    compared: null,
    answer: null,
    prediction: null,
    status: "ready",
    invalidReason: null,
  };
}

function reduceTraceEvent(
  state: TraceState,
  event: TraceEvent,
):
  | { readonly ok: true; readonly value: TraceState }
  | { readonly ok: false; readonly error: TraceFailure } {
  if (state.status === "invalid")
    return failure("invalid_event", "Trace cannot continue after an invalid state.");
  switch (event.kind) {
    case "compare":
      if (!validIndex(state.values, event.left) || !validIndex(state.values, event.right)) {
        return failure("invalid_event", "Compare indices are outside the trace values.");
      }
      return {
        ok: true,
        value: { ...state, compared: [event.left, event.right], status: "running" },
      };
    case "move_left":
      if (state.left >= state.right)
        return failure("invalid_event", "Cannot move left after pointers meet.");
      return {
        ok: true,
        value: { ...state, left: state.left + 1, compared: null, status: "running" },
      };
    case "move_right":
      if (state.left >= state.right)
        return failure("invalid_event", "Cannot move right after pointers meet.");
      return {
        ok: true,
        value: { ...state, right: state.right - 1, compared: null, status: "running" },
      };
    case "mark_answer":
      if (!validIndex(state.values, event.left) || !validIndex(state.values, event.right)) {
        return failure("invalid_event", "Answer indices are outside the trace values.");
      }
      return {
        ok: true,
        value: { ...state, answer: [event.left, event.right], status: "running" },
      };
    case "prediction_checkpoint":
      if (event.checkpointId.length === 0 || event.prompt.length === 0) {
        return failure(
          "invalid_event",
          "Prediction checkpoints need bounded identity and prompt text.",
        );
      }
      return {
        ok: true,
        value: {
          ...state,
          prediction: {
            checkpointId: event.checkpointId,
            prompt: event.prompt,
            selectedOption: event.selectedOption,
          },
          status: "running",
        },
      };
    case "complete":
      return { ok: true, value: { ...state, status: "complete" } };
  }
}

function parseEvent(
  value: unknown,
):
  | { readonly ok: true; readonly value: TraceEvent }
  | { readonly ok: false; readonly error: TraceFailure } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return failure("invalid_event", "Trace event must be an object.");
  }
  const candidate = value as Record<string, unknown>;
  switch (candidate.kind) {
    case "compare":
    case "mark_answer":
      if (!safeIndex(candidate.left) || !safeIndex(candidate.right)) {
        return failure(
          "invalid_event",
          "Pointer event indices must be safe non-negative integers.",
        );
      }
      return {
        ok: true,
        value: { kind: candidate.kind, left: candidate.left, right: candidate.right },
      };
    case "move_left":
    case "move_right":
    case "complete":
      return { ok: true, value: { kind: candidate.kind } };
    case "prediction_checkpoint":
      if (
        typeof candidate.checkpointId !== "string" ||
        typeof candidate.prompt !== "string" ||
        (candidate.selectedOption !== null && typeof candidate.selectedOption !== "string")
      ) {
        return failure("invalid_event", "Prediction checkpoint fields are invalid.");
      }
      return {
        ok: true,
        value: {
          kind: "prediction_checkpoint",
          checkpointId: candidate.checkpointId,
          prompt: candidate.prompt,
          selectedOption: candidate.selectedOption,
        },
      };
    default:
      return failure("invalid_event", "Trace event kind is not supported.");
  }
}

function safeIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function validIndex(values: readonly number[], value: number): boolean {
  return safeIndex(value) && value < values.length;
}

function describeEvent(event: TraceEvent, state: TraceState): string {
  switch (event.kind) {
    case "compare":
      return `compare positions ${event.left} and ${event.right}`;
    case "move_left":
      return `move left pointer to ${state.left}`;
    case "move_right":
      return `move right pointer to ${state.right}`;
    case "mark_answer":
      return `record answer using positions ${event.left} and ${event.right}`;
    case "prediction_checkpoint":
      return `prediction checkpoint ${event.checkpointId}`;
    case "complete":
      return "complete the trace";
  }
}

function failure(
  code: TraceFailure["code"],
  message: string,
): { readonly ok: false; readonly error: TraceFailure } {
  return { ok: false, error: { code, message } };
}
