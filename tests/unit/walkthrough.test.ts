import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
  pilotWalkthrough,
  playbackReducer,
  validateWalkthrough,
  walkthroughFrame,
} from "@algocove/visualizer";
for (const pattern of ["arrays-hashing", "two-pointers", "sliding-window", "stack"]) {
  it(`${pattern}: scrubbing and sequential playback share pseudocode, variables and structure`, () => {
    const b = JSON.parse(readFileSync(`content/patterns/${pattern}/bundle.json`, "utf8"));
    const w = pilotWalkthrough({
      schemaVersion: 2,
      provenance: "authored_reference",
      pattern,
      ...b.trace,
    });
    let p = { step: 0, playing: true, speed: 1 };
    for (let i = 0; i < w.trace.states.length; i++) {
      expect(walkthroughFrame(w, p.step)).toEqual(walkthroughFrame(w, i));
      expect(walkthroughFrame(w, i).activeLineIds).toContain(b.trace.states[i].action);
      p = playbackReducer(p, { type: "tick" }, w.trace.states.length);
    }
    expect(p.playing).toBe(false);
    p = playbackReducer(p, { type: "seek", step: 1 }, w.trace.states.length);
    expect(walkthroughFrame(w, p.step)).toEqual(walkthroughFrame(w, 1));
    expect(playbackReducer(p, { type: "restart" }, w.trace.states.length).step).toBe(0);
    const poisoned = structuredClone(w);
    poisoned.activeLineIds = [["missing"]];
    expect(() => validateWalkthrough(poisoned)).toThrow();
    expect(() => validateWalkthrough({ ...w, answer: "secret" })).toThrow();
  });
}
