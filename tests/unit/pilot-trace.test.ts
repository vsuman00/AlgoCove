import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { validatePilotTrace, pilotTraceTranscript } from "@algocove/visualizer";
import { PILOT_PATTERNS } from "../../packages/content/src/pilot-bundle.ts";
it.each(PILOT_PATTERNS)("validates and describes every authored %s state", (pattern) => {
  const bundle = JSON.parse(readFileSync(`content/patterns/${pattern}/bundle.json`, "utf8"));
  const trace = { schemaVersion: 2, provenance: "authored_reference", pattern, ...bundle.trace };
  const t = validatePilotTrace(trace);
  expect(pilotTraceTranscript(trace)).toHaveLength(t.states.length);
  for (const state of t.states) expect(state.explanation).toBeTruthy();
  const changed = structuredClone(trace);
  changed.states[1].cursor = 999;
  expect(() => validatePilotTrace(changed)).toThrow();
  expect(() => validatePilotTrace({ ...trace, secret: "extra" })).toThrow();
});
it.each(PILOT_PATTERNS)(
  "checks %s snapshots against independent prefix/window oracles",
  (pattern) => {
    const b = JSON.parse(readFileSync(`content/patterns/${pattern}/bundle.json`, "utf8"));
    const counts = (v: number[]) =>
      [...new Set(v)]
        .sort((a, b) => a - b)
        .map((value) => ({ value, count: v.filter((x) => x === value).length }));
    const cancel = (v: number[]) => {
      const out = [...v];
      for (;;) {
        const i = out.findIndex((x, i) => i > 0 && x === out[i - 1]);
        if (i < 0) return out;
        out.splice(i - 1, 2);
      }
    };
    for (const s of b.trace.states) {
      if (pattern === "arrays-hashing") {
        const prefix = b.trace.values.slice(0, s.cursor);
        expect(s.memory).toEqual(counts(prefix));
        let pairs = 0;
        for (let i = 0; i < prefix.length; i++)
          for (let j = i + 1; j < prefix.length; j++) if (prefix[i] === prefix[j]) pairs++;
        expect(s.answer).toBe(pairs);
      }
      if (pattern === "stack") expect(s.stack).toEqual(cancel(b.trace.values.slice(0, s.cursor)));
      if (pattern === "sliding-window")
        expect(s.memory).toEqual(
          counts(s.right === null ? [] : b.trace.values.slice(s.left, s.right + 1)),
        );
    }
    if (pattern === "two-pointers")
      expect(new Set(b.trace.states.map((s: { action: string }) => s.action))).toEqual(
        new Set(["initialize", "advance_left", "advance_right", "match", "complete"]),
      );
  },
);
