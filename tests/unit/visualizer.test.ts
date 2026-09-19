import { describe, expect, it } from "vitest";
import {
  replayTrace,
  traceTranscript,
  validateTraceDocument,
  type TraceDocument,
} from "@algocove/visualizer";

const trace: TraceDocument = {
  schemaVersion: 1,
  traceId: "trace-array-1",
  version: 1,
  provenance: "learner_draft",
  structure: "array_two_pointer",
  initialValues: [1, 8, 6, 2, 5],
  events: [
    { kind: "compare", left: 0, right: 4 },
    { kind: "move_left" },
    {
      kind: "prediction_checkpoint",
      checkpointId: "cp-1",
      prompt: "Which side moves?",
      selectedOption: "left",
    },
    { kind: "mark_answer", left: 1, right: 4 },
    { kind: "complete" },
  ],
};

describe("Task 27 deterministic trace protocol", () => {
  it("replays the same bounded trace into the same state and transcript", () => {
    const first = replayTrace(trace);
    const second = replayTrace(JSON.parse(JSON.stringify(trace)));
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      ok: true,
      value: {
        state: {
          step: 5,
          left: 1,
          right: 4,
          answer: [1, 4],
          status: "complete",
        },
        assistanceDisclosure: "none",
      },
    });
    expect(traceTranscript(trace)).toMatchObject({
      ok: true,
      value: expect.arrayContaining([
        "Step 0: pointers at 0 and 4.",
        "Step 1: compare positions 0 and 4.",
      ]),
    });
  });

  it("fails closed on unknown events, invalid pointers, and out-of-range steps", () => {
    const unknown = { ...trace, events: [{ kind: "invented" }] };
    expect(validateTraceDocument(unknown)).toMatchObject({
      ok: false,
      error: { code: "invalid_event" },
    });
    expect(
      replayTrace({ ...trace, events: [{ kind: "compare", left: 0, right: 99 }] }),
    ).toMatchObject({ ok: false, error: { code: "invalid_event" } });
    expect(replayTrace(trace, 99)).toMatchObject({
      ok: false,
      error: { code: "step_out_of_range" },
    });
    expect(
      replayTrace({ ...trace, events: [...trace.events, { kind: "move_left" }] }),
    ).toMatchObject({
      ok: false,
      error: { code: "invalid_event" },
    });
  });

  it("labels reviewed reference disclosure as assistance instead of inventing source traces", () => {
    const reference = { ...trace, provenance: "authored_reference" as const };
    expect(replayTrace(reference)).toMatchObject({
      ok: true,
      value: { assistanceDisclosure: "reference_trace", provenance: "authored_reference" },
    });
    expect(validateTraceDocument({ ...trace, structure: "arbitrary_source_trace" })).toMatchObject({
      ok: false,
      error: { code: "invalid_document" },
    });
  });
});
