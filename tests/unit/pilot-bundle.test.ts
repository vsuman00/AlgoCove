import { expect, it } from "vitest";
import { validatePilotBundle } from "../../packages/content/src/pilot-bundle.ts";
it("rejects incomplete or unbounded pilot content", () => {
  for (const value of [null, {}, [], { schemaVersion: 2 }])
    expect(() => validatePilotBundle(value)).toThrow();
});

import { readFileSync } from "node:fs";
it("validates the original arrays/hashing bundle and portable edge cases", () => {
  const bundle = validatePilotBundle(
    JSON.parse(readFileSync("content/patterns/arrays-hashing/bundle.json", "utf8")),
  );
  for (const f of bundle.fixtures) {
    let pairs = 0;
    for (let i = 0; i < f.values.length; i++)
      for (let j = i + 1; j < f.values.length; j++) if (f.values[i] === f.values[j]) pairs++;
    expect(f.expected).toBe(pairs);
  }
  expect(bundle.trace.states.at(-1)?.answer).toBe(3);
});

it("validates sorted two-pointer pair fixtures independently", () => {
  const b = validatePilotBundle(
    JSON.parse(readFileSync("content/patterns/two-pointers/bundle.json", "utf8")),
  );
  for (const f of b.fixtures) {
    let count = 0;
    for (let i = 0; i < f.values.length; i++)
      for (let j = i + 1; j < f.values.length; j++) if (f.values[j]! - f.values[i]! === 3) count++;
    expect(f.expected).toBe(count);
  }
});

it("validates sliding-window and stack fixtures with independent oracles", () => {
  for (const pattern of ["sliding-window", "stack"]) {
    const b = validatePilotBundle(
      JSON.parse(readFileSync(`content/patterns/${pattern}/bundle.json`, "utf8")),
    );
    for (const f of b.fixtures) {
      let expected = 0;
      if (pattern === "sliding-window") {
        for (let i = 0; i < f.values.length; i++)
          for (let j = i; j < f.values.length; j++)
            if (new Set(f.values.slice(i, j + 1)).size <= 2)
              expected = Math.max(expected, j - i + 1);
      } else {
        const remaining = [...f.values];
        let index = 0;
        while (index < remaining.length - 1) {
          if (remaining[index] === remaining[index + 1]) {
            remaining.splice(index, 2);
            index = 0;
          } else index++;
        }
        expected = remaining.length;
      }
      expect(f.expected).toBe(expected);
    }
  }
});

import { pilotHarness } from "../../packages/content/src/pilot-harness.ts";
import { PROBLEM_LANGUAGES } from "@algocove/domain";
it("keeps grading answers out of all six harnesses and supplies bounded compile commands", () => {
  for (const language of PROBLEM_LANGUAGES) {
    const harness = pilotHarness(language, "learner source");
    expect(harness.source).toContain("learner source");
    expect(harness.source).not.toContain("expected");
    expect(harness.compile.length).toBeGreaterThan(0);
    expect(harness.run.length).toBeGreaterThan(0);
  }
});

it("rejects ambiguous readiness answer values before draft import", () => {
  const b = JSON.parse(readFileSync("content/patterns/stack/bundle.json", "utf8"));
  b.readinessQuestions[0].options[1].value = b.readinessQuestions[0].options[0].value;
  expect(() => validatePilotBundle(b)).toThrow();
});

it("rejects pattern-incompatible traces before draft import", () => {
  for (const pattern of ["arrays-hashing", "two-pointers", "sliding-window", "stack"]) {
    const b = JSON.parse(readFileSync(`content/patterns/${pattern}/bundle.json`, "utf8"));
    if (pattern === "two-pointers" || pattern === "sliding-window") b.trace.states[0].left = null;
    else b.trace.states[0].left = 0;
    expect(() => validatePilotBundle(b)).toThrow();
  }
});
