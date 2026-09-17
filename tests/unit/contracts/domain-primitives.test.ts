import { describe, expect, it } from "vitest";
import {
  addDurationToInstant,
  durationFromMinutes,
  durationFromMs,
  formatId,
  instantFromEpochMs,
  normalizeLearnerText,
  parseContentChecksum,
  parseId,
  parseInstant,
  parseTimeZone,
} from "@algocove/domain";

describe("opaque identifiers", () => {
  it("round-trips generated identifiers across the trust boundary", () => {
    const alphabet = "0123456789abcdefghjkmnpqrstvwxyz";
    for (let counter = 0; counter < 100; counter += 1) {
      const entropy = "0".repeat(15) + alphabet[counter % alphabet.length];
      const formatted = formatId("learner", entropy);

      expect(formatted.ok).toBe(true);
      if (formatted.ok) {
        const parsed = parseId("learner", formatted.value);
        expect(parsed).toEqual({ ok: true, value: formatted.value });
      }
    }
  });

  it.each([
    ["short", "too short"],
    ["0".repeat(53), "too long"],
    ["contains_illegal_character", "ambiguous punctuation"],
  ])("rejects %s (%s)", (entropy) => {
    expect(formatId("request", entropy).ok).toBe(false);
  });

  it("rejects a valid identifier with the wrong kind prefix", () => {
    const learner = formatId("learner", "0".repeat(16));

    expect(learner.ok).toBe(true);
    if (learner.ok) {
      expect(parseId("session", learner.value).ok).toBe(false);
    }
  });
});

describe("server-controlled time and bounded values", () => {
  it("normalizes offsets to a millisecond UTC instant", () => {
    expect(parseInstant("2026-09-17T15:00:00+05:30")).toEqual({
      ok: true,
      value: "2026-09-17T09:30:00.000Z",
    });
    expect(parseInstant("2026-02-30T09:00:00Z").ok).toBe(false);
  });

  it("rejects out-of-range durations and prevents instant overflow", () => {
    const oneHour = durationFromMinutes(60);
    const nearMaximum = instantFromEpochMs(8_640_000_000_000_000);

    expect(oneHour.ok).toBe(true);
    expect(durationFromMs(-1).ok).toBe(false);
    expect(nearMaximum.ok).toBe(true);
    if (oneHour.ok && nearMaximum.ok) {
      expect(addDurationToInstant(nearMaximum.value, oneHour.value).ok).toBe(false);
    }
  });
});

describe("boundary hygiene", () => {
  it("accepts runtime-supported time zones and rejects unknown zones", () => {
    expect(parseTimeZone("UTC").ok).toBe(true);
    expect(parseTimeZone("Asia/Kolkata").ok).toBe(true);
    expect(parseTimeZone("Mars/Crater").ok).toBe(false);
  });

  it("normalizes line endings and removes control characters", () => {
    expect(normalizeLearnerText("  line one\r\nline\u0000 two  ")).toBe("line one\nline two");
  });

  it("validates immutable content checksums", () => {
    expect(parseContentChecksum(`sha256:${"a".repeat(64)}`).ok).toBe(true);
    expect(parseContentChecksum("sha256:ABC").ok).toBe(false);
  });
});
