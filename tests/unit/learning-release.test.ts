import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { validatePilotBundle } from "@algocove/content/pilot";
import {
  pilotReleasePacket,
  releasePublicView,
  validateReleasePacket,
} from "@algocove/content/learning-release";
const bundle = validatePilotBundle(
  JSON.parse(readFileSync("content/patterns/stack/bundle.json", "utf8")),
);
it("adapts pilot assets into a typed lesson without leaking grading keys", () => {
  const p = pilotReleasePacket(bundle);
  expect(p.brief.invariant).toBe(bundle.lesson.invariant);
  expect(releasePublicView(p).lesson.blocks.length).toBeGreaterThan(1);
  expect(JSON.stringify(releasePublicView(p))).not.toMatch(
    /"answer"|correctOption|expectedReasoning|"solution"/,
  );
});
it("rejects unsafe blocks, hidden fields and incompatible questions/media", () => {
  for (const mutate of [
    (p: ReturnType<typeof pilotReleasePacket>) => {
      p.lesson.blocks[0]!.text = "<script>alert(1)</script>";
    },
    (p: ReturnType<typeof pilotReleasePacket>) => {
      p.questions[0]!.answer = "missing";
    },
    (p: ReturnType<typeof pilotReleasePacket>) => {
      Object.assign(p.lesson.blocks[0]!, { solution: "private" });
    },
    (p: ReturnType<typeof pilotReleasePacket>) => {
      p.media.push({
        role: "video",
        title: "Demo",
        url: "https://youtube.com/watch?v=test",
        transcript: "",
        essential: true,
      });
    },
    (p: ReturnType<typeof pilotReleasePacket>) => {
      p.media.push({
        role: "video",
        title: "Demo",
        url: "https://youtube.com@evil.test/",
        transcript: "Text equivalent",
        essential: true,
      });
    },
  ]) {
    const p = pilotReleasePacket(bundle);
    mutate(p);
    expect(() => validateReleasePacket(p)).toThrow();
  }
});
