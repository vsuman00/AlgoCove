import { describe, expect, it } from "vitest";
import {
  abandonAttempt,
  abandonLearningSession,
  completeLearningSession,
  expireAttempt,
  formatId,
  parseContentChecksum,
  parseInstant,
  recordRunRequested,
  recordSourceSaved,
  resetAttemptForLanguage,
  startAttempt,
  startLearningSession,
  submitAttempt,
  type LearningAttempt,
  type LearningSession,
  type Result,
} from "@algocove/domain";

const now = parseInstant("2026-09-18T10:00:00.000Z");
const later = parseInstant("2026-09-18T10:01:00.000Z");
const learner = formatId("learner", "aaaaaaaaaaaaaaaa");
const session = formatId("session", "bbbbbbbbbbbbbbbb");
const attempt = formatId("attempt", "cccccccccccccccc");
const nextAttempt = formatId("attempt", "dddddddddddddddd");
const problem = formatId("problemVersion", "eeeeeeeeeeeeeeee");
const pythonManifest = formatId("languageManifest", "ffffffffffffffff");
const typescriptManifest = formatId("languageManifest", "gggggggggggggggg");
const startedEvent = formatId("event", "hhhhhhhhhhhhhhhh");
const sourceEvent = formatId("event", "1111111111111111");
const runEvent = formatId("event", "jjjjjjjjjjjjjjjj");
const submitEvent = formatId("event", "kkkkkkkkkkkkkkkk");
const abandonEvent = formatId("event", "mmmmmmmmmmmmmmmm");
const resetEvent = formatId("event", "nnnnnnnnnnnnnnnn");
const run = formatId("codeRun", "2222222222222222");
const checksum = parseContentChecksum(`sha256:${"a".repeat(64)}`);

function unwrap<T, F>(result: Result<T, F>): T {
  if (!result.ok) throw new Error("practice fixture is invalid");
  return result.value;
}

const nowValue = unwrap(now);
const laterValue = unwrap(later);
const learnerValue = unwrap(learner);
const sessionValue = unwrap(session);
const attemptValue = unwrap(attempt);
const nextAttemptValue = unwrap(nextAttempt);
const problemValue = unwrap(problem);
const pythonManifestValue = unwrap(pythonManifest);
const typescriptManifestValue = unwrap(typescriptManifest);
const startedEventValue = unwrap(startedEvent);
const sourceEventValue = unwrap(sourceEvent);
const runEventValue = unwrap(runEvent);
const submitEventValue = unwrap(submitEvent);
const abandonEventValue = unwrap(abandonEvent);
const resetEventValue = unwrap(resetEvent);
const runValue = unwrap(run);
const checksumValue = unwrap(checksum);

function activeSession(): LearningSession {
  return unwrap(
    startLearningSession({
      sessionId: sessionValue,
      learnerId: learnerValue,
      mode: "learn",
      startedAt: nowValue,
    }),
  );
}

function activeAttempt(): LearningAttempt {
  return unwrap(
    startAttempt(activeSession(), {
      attemptId: attemptValue,
      eventId: startedEventValue,
      problemVersionId: problemValue,
      manifestId: pythonManifestValue,
      language: "python",
      startedAt: nowValue,
    }),
  ).attempt;
}

describe("learning session and attempt state machines", () => {
  it("starts a mode-pinned session and version-pinned attempt without source data", () => {
    const started = unwrap(
      startAttempt(activeSession(), {
        attemptId: attemptValue,
        eventId: startedEventValue,
        problemVersionId: problemValue,
        manifestId: pythonManifestValue,
        language: "python",
        startedAt: nowValue,
      }),
    );

    expect(started.attempt).toMatchObject({
      learnerId: learnerValue,
      problemVersionId: problemValue,
      manifestId: pythonManifestValue,
      language: "python",
      mode: "learn",
      status: "active",
      version: 1,
      eventSequence: 1,
    });
    expect(started.event).toMatchObject({
      kind: "started",
      metadata: { reason: "initial", language: "python", mode: "learn" },
    });
    expect(JSON.stringify(started.event)).not.toContain("source");
  });

  it("records meaningful source and run events with optimistic version increments", () => {
    const saved = unwrap(
      recordSourceSaved(activeAttempt(), {
        eventId: sourceEventValue,
        sourceChecksum: checksumValue,
        sourceLength: 42,
        occurredAt: laterValue,
      }),
    );
    expect(saved.attempt).toMatchObject({ version: 2, eventSequence: 2, status: "active" });
    expect(saved.event).toMatchObject({
      kind: "source_saved",
      metadata: { sourceChecksum: checksumValue, sourceLength: 42 },
    });

    const runRequested = unwrap(
      recordRunRequested(saved.attempt, {
        eventId: runEventValue,
        runId: runValue,
        sourceChecksum: checksumValue,
        occurredAt: laterValue,
      }),
    );
    expect(runRequested.attempt).toMatchObject({ version: 3, eventSequence: 3 });
    expect(runRequested.event).toMatchObject({
      kind: "run_requested",
      metadata: { runId: runValue },
    });
  });

  it("makes submit terminal and rejects later mutations", () => {
    const submitted = unwrap(
      submitAttempt(activeAttempt(), {
        eventId: submitEventValue,
        runId: runValue,
        sourceChecksum: checksumValue,
        submittedAt: laterValue,
      }),
    );
    expect(submitted.attempt).toMatchObject({
      status: "submitted",
      terminalReason: "submitted",
      version: 2,
      endedAt: laterValue,
    });
    expect(
      recordSourceSaved(submitted.attempt, {
        eventId: sourceEventValue,
        sourceChecksum: checksumValue,
        sourceLength: 3,
        occurredAt: laterValue,
      }),
    ).toMatchObject({ ok: false, error: { code: "invalid_state" } });
  });

  it("allows only one monotonic terminal transition", () => {
    const abandoned = unwrap(
      abandonAttempt(activeAttempt(), {
        eventId: abandonEventValue,
        endedAt: laterValue,
      }),
    );
    expect(abandoned.attempt).toMatchObject({
      status: "abandoned",
      terminalReason: "learner",
      version: 2,
    });
    expect(
      expireAttempt(abandoned.attempt, { eventId: resetEventValue, endedAt: laterValue }),
    ).toMatchObject({
      ok: false,
      error: { code: "invalid_state" },
    });
    expect(abandonLearningSession(activeSession(), laterValue)).toMatchObject({
      ok: true,
      value: { status: "abandoned", version: 2 },
    });
    const endedSession = unwrap(abandonLearningSession(activeSession(), laterValue));
    expect(completeLearningSession(endedSession, laterValue)).toMatchObject({
      ok: false,
      error: { code: "invalid_state" },
    });
  });

  it("creates an explicit new attempt when language changes", () => {
    const reset = unwrap(
      resetAttemptForLanguage(activeSession(), activeAttempt(), {
        nextAttemptId: nextAttemptValue,
        previousEventId: abandonEventValue,
        nextEventId: resetEventValue,
        problemVersionId: problemValue,
        manifestId: typescriptManifestValue,
        language: "typescript",
        resetAt: laterValue,
      }),
    );
    expect(reset.previous.attempt).toMatchObject({
      status: "abandoned",
      terminalReason: "language_changed",
      version: 2,
    });
    expect(reset.next.attempt).toMatchObject({
      attemptId: nextAttemptValue,
      language: "typescript",
      resetFromAttemptId: attemptValue,
      status: "active",
      version: 1,
    });
    expect(reset.next.event).toMatchObject({
      kind: "started",
      metadata: { reason: "language_reset", resetFromAttemptId: attemptValue },
    });
  });

  it("rejects changing to the same language and oversized source snapshots", () => {
    expect(
      resetAttemptForLanguage(activeSession(), activeAttempt(), {
        nextAttemptId: nextAttemptValue,
        previousEventId: abandonEventValue,
        nextEventId: resetEventValue,
        problemVersionId: problemValue,
        manifestId: typescriptManifestValue,
        language: "python",
        resetAt: laterValue,
      }),
    ).toMatchObject({ ok: false, error: { code: "same_language" } });
    expect(
      recordSourceSaved(activeAttempt(), {
        eventId: sourceEventValue,
        sourceChecksum: checksumValue,
        sourceLength: 1_048_577,
        occurredAt: laterValue,
      }),
    ).toMatchObject({ ok: false, error: { code: "invalid_event" } });
  });
});
