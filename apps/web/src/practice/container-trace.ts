/** Server-only reviewed original trace; delivered only after assistance is persisted. */
export const CONTAINER_REFERENCE_TRACE = {
  schemaVersion: 1,
  traceId: "arrays-two-pointer-reference",
  version: 1,
  provenance: "authored_reference",
  structure: "array_two_pointer",
  initialValues: [1, 8, 6, 2, 5, 4, 8, 3, 7],
  events: [
    { kind: "compare", left: 0, right: 8 },
    {
      kind: "prediction_checkpoint",
      checkpointId: "boundary-1",
      prompt: "Which boundary would you move?",
      selectedOption: null,
    },
    { kind: "move_left" },
    { kind: "compare", left: 1, right: 8 },
    { kind: "mark_answer", left: 1, right: 8 },
    { kind: "move_right" },
    { kind: "complete" },
  ],
};
