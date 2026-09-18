import {
  err,
  ok,
  type ContentChecksum,
  type Instant,
  type LearnerId,
  type OpaqueId,
  type Result,
} from "./primitives.ts";
import {
  PROBLEM_LANGUAGES,
  type ProblemLanguage,
  type ProblemVersionId,
} from "./language-manifest.ts";

export const LEARNING_MODES = ["learn", "practice", "rescue"] as const;
export type LearningMode = (typeof LEARNING_MODES)[number];

export const SESSION_STATUSES = ["active", "completed", "abandoned", "expired"] as const;
export type LearningSessionStatus = (typeof SESSION_STATUSES)[number];

export const ATTEMPT_STATUSES = ["active", "submitted", "abandoned", "expired"] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

export type LanguageManifestId = OpaqueId<"languageManifest">;
export type CodeRunId = OpaqueId<"codeRun">;

export type LearningSession = {
  readonly sessionId: OpaqueId<"session">;
  readonly learnerId: LearnerId;
  readonly mode: LearningMode;
  readonly status: LearningSessionStatus;
  /** Optimistic concurrency token. Every state transition increments it. */
  readonly version: number;
  readonly startedAt: Instant;
  readonly updatedAt: Instant;
  readonly endedAt: Instant | null;
};

export type LearningSessionFailureCode = "invalid_mode" | "invalid_state" | "invalid_version";

export type LearningSessionFailure = {
  readonly code: LearningSessionFailureCode;
  readonly message: string;
};

export type AttemptEventKind =
  "started" | "source_saved" | "run_requested" | "submitted" | "abandoned" | "expired";

type AttemptEventBase = {
  readonly eventId: OpaqueId<"event">;
  readonly attemptId: OpaqueId<"attempt">;
  readonly learnerId: LearnerId;
  readonly sequence: number;
  readonly occurredAt: Instant;
};

export type AttemptEvent =
  | (AttemptEventBase & {
      readonly kind: "started";
      readonly metadata: {
        readonly reason: "initial" | "language_reset";
        readonly language: ProblemLanguage;
        readonly mode: LearningMode;
        readonly problemVersionId: ProblemVersionId;
        readonly manifestId: LanguageManifestId;
        readonly resetFromAttemptId: OpaqueId<"attempt"> | null;
      };
    })
  | (AttemptEventBase & {
      readonly kind: "source_saved";
      readonly metadata: {
        readonly sourceChecksum: ContentChecksum;
        readonly sourceLength: number;
      };
    })
  | (AttemptEventBase & {
      readonly kind: "run_requested";
      readonly metadata: {
        readonly runId: CodeRunId;
        readonly sourceChecksum: ContentChecksum;
      };
    })
  | (AttemptEventBase & {
      readonly kind: "submitted";
      readonly metadata: {
        readonly runId: CodeRunId;
        readonly sourceChecksum: ContentChecksum;
      };
    })
  | (AttemptEventBase & {
      readonly kind: "abandoned";
      readonly metadata: { readonly reason: "learner" | "language_changed" | "session_ended" };
    })
  | (AttemptEventBase & {
      readonly kind: "expired";
      readonly metadata: { readonly reason: "session_timeout" | "idle_timeout" };
    });

export type LearningAttempt = {
  readonly attemptId: OpaqueId<"attempt">;
  readonly sessionId: OpaqueId<"session">;
  readonly learnerId: LearnerId;
  readonly problemVersionId: ProblemVersionId;
  readonly manifestId: LanguageManifestId;
  readonly language: ProblemLanguage;
  readonly mode: LearningMode;
  readonly status: AttemptStatus;
  readonly terminalReason:
    "submitted" | "learner" | "language_changed" | "session_ended" | "expired" | null;
  readonly resetFromAttemptId: OpaqueId<"attempt"> | null;
  /** Optimistic concurrency token. Every state transition increments it. */
  readonly version: number;
  /** Number of durable meaningful events already recorded for this attempt. */
  readonly eventSequence: number;
  readonly startedAt: Instant;
  readonly updatedAt: Instant;
  readonly endedAt: Instant | null;
};

export type AttemptTransition = {
  readonly attempt: LearningAttempt;
  readonly event: AttemptEvent;
};

export type AttemptReset = {
  readonly previous: AttemptTransition;
  readonly next: AttemptTransition;
};

export type AttemptFailureCode =
  | "invalid_language"
  | "invalid_mode"
  | "invalid_state"
  | "invalid_event"
  | "invalid_version"
  | "same_language"
  | "problem_mismatch";

export type AttemptFailure = {
  readonly code: AttemptFailureCode;
  readonly message: string;
};

function validMode(mode: LearningMode): boolean {
  return (LEARNING_MODES as readonly string[]).includes(mode);
}

function validLanguage(language: ProblemLanguage): boolean {
  return (PROBLEM_LANGUAGES as readonly string[]).includes(language);
}

function validVersion(version: number): boolean {
  return Number.isSafeInteger(version) && version > 0;
}

function nextSessionStatus(
  session: LearningSession,
  status: Exclude<LearningSessionStatus, "active">,
  now: Instant,
): Result<LearningSession, LearningSessionFailure> {
  if (!validVersion(session.version)) {
    return err({ code: "invalid_version", message: "Session version must be a positive integer." });
  }
  if (session.status !== "active") {
    return err({ code: "invalid_state", message: "Only an active session can be ended." });
  }
  return ok({ ...session, status, version: session.version + 1, updatedAt: now, endedAt: now });
}

export function startLearningSession(input: {
  readonly sessionId: OpaqueId<"session">;
  readonly learnerId: LearnerId;
  readonly mode: LearningMode;
  readonly startedAt: Instant;
}): Result<LearningSession, LearningSessionFailure> {
  if (!validMode(input.mode)) {
    return err({ code: "invalid_mode", message: "Learning mode is not supported." });
  }
  return ok({
    sessionId: input.sessionId,
    learnerId: input.learnerId,
    mode: input.mode,
    status: "active",
    version: 1,
    startedAt: input.startedAt,
    updatedAt: input.startedAt,
    endedAt: null,
  });
}

export function completeLearningSession(
  session: LearningSession,
  now: Instant,
): Result<LearningSession, LearningSessionFailure> {
  return nextSessionStatus(session, "completed", now);
}

export function abandonLearningSession(
  session: LearningSession,
  now: Instant,
): Result<LearningSession, LearningSessionFailure> {
  return nextSessionStatus(session, "abandoned", now);
}

export function expireLearningSession(
  session: LearningSession,
  now: Instant,
): Result<LearningSession, LearningSessionFailure> {
  return nextSessionStatus(session, "expired", now);
}

function nextEventSequence(attempt: LearningAttempt): Result<number, AttemptFailure> {
  if (!validVersion(attempt.version) || !validVersion(attempt.eventSequence)) {
    return err({
      code: "invalid_version",
      message: "Attempt and event sequence versions must be positive integers.",
    });
  }
  return ok(attempt.eventSequence + 1);
}

function activeAttempt(attempt: LearningAttempt): Result<number, AttemptFailure> {
  if (!validVersion(attempt.version) || !validVersion(attempt.eventSequence)) {
    return err({
      code: "invalid_version",
      message: "Attempt and event sequence versions must be positive integers.",
    });
  }
  if (attempt.status !== "active") {
    return err({ code: "invalid_state", message: "Only an active attempt can be changed." });
  }
  return nextEventSequence(attempt);
}

function eventBase(
  attempt: LearningAttempt,
  eventId: OpaqueId<"event">,
  now: Instant,
  sequence: number,
) {
  return {
    eventId,
    attemptId: attempt.attemptId,
    learnerId: attempt.learnerId,
    sequence,
    occurredAt: now,
  };
}

export function startAttempt(
  session: LearningSession,
  input: {
    readonly attemptId: OpaqueId<"attempt">;
    readonly eventId: OpaqueId<"event">;
    readonly problemVersionId: ProblemVersionId;
    readonly manifestId: LanguageManifestId;
    readonly language: ProblemLanguage;
    readonly startedAt: Instant;
    readonly resetFromAttemptId?: OpaqueId<"attempt"> | null;
  },
): Result<AttemptTransition, AttemptFailure> {
  if (session.status !== "active") {
    return err({
      code: "invalid_state",
      message: "An attempt can only start in an active session.",
    });
  }
  if (!validLanguage(input.language)) {
    return err({ code: "invalid_language", message: "Attempt language is not supported." });
  }
  const attempt: LearningAttempt = {
    attemptId: input.attemptId,
    sessionId: session.sessionId,
    learnerId: session.learnerId,
    problemVersionId: input.problemVersionId,
    manifestId: input.manifestId,
    language: input.language,
    mode: session.mode,
    status: "active",
    terminalReason: null,
    resetFromAttemptId: input.resetFromAttemptId ?? null,
    version: 1,
    eventSequence: 1,
    startedAt: input.startedAt,
    updatedAt: input.startedAt,
    endedAt: null,
  };
  return ok({
    attempt,
    event: {
      ...eventBase(attempt, input.eventId, input.startedAt, 1),
      kind: "started",
      metadata: {
        reason:
          input.resetFromAttemptId === undefined || input.resetFromAttemptId === null
            ? "initial"
            : "language_reset",
        language: input.language,
        mode: session.mode,
        problemVersionId: input.problemVersionId,
        manifestId: input.manifestId,
        resetFromAttemptId: input.resetFromAttemptId ?? null,
      },
    },
  });
}

export function recordSourceSaved(
  attempt: LearningAttempt,
  input: {
    readonly eventId: OpaqueId<"event">;
    readonly sourceChecksum: ContentChecksum;
    readonly sourceLength: number;
    readonly occurredAt: Instant;
  },
): Result<AttemptTransition, AttemptFailure> {
  const sequence = activeAttempt(attempt);
  if (!sequence.ok) return sequence;
  if (
    !Number.isSafeInteger(input.sourceLength) ||
    input.sourceLength < 0 ||
    input.sourceLength > 1_048_576
  ) {
    return err({
      code: "invalid_event",
      message: "Saved source length exceeds the bounded limit.",
    });
  }
  const next = {
    ...attempt,
    version: attempt.version + 1,
    eventSequence: sequence.value,
    updatedAt: input.occurredAt,
  };
  return ok({
    attempt: next,
    event: {
      ...eventBase(attempt, input.eventId, input.occurredAt, sequence.value),
      kind: "source_saved",
      metadata: { sourceChecksum: input.sourceChecksum, sourceLength: input.sourceLength },
    },
  });
}

export function recordRunRequested(
  attempt: LearningAttempt,
  input: {
    readonly eventId: OpaqueId<"event">;
    readonly runId: CodeRunId;
    readonly sourceChecksum: ContentChecksum;
    readonly occurredAt: Instant;
  },
): Result<AttemptTransition, AttemptFailure> {
  const sequence = activeAttempt(attempt);
  if (!sequence.ok) return sequence;
  const next = {
    ...attempt,
    version: attempt.version + 1,
    eventSequence: sequence.value,
    updatedAt: input.occurredAt,
  };
  return ok({
    attempt: next,
    event: {
      ...eventBase(attempt, input.eventId, input.occurredAt, sequence.value),
      kind: "run_requested",
      metadata: { runId: input.runId, sourceChecksum: input.sourceChecksum },
    },
  });
}

export function submitAttempt(
  attempt: LearningAttempt,
  input: {
    readonly eventId: OpaqueId<"event">;
    readonly runId: CodeRunId;
    readonly sourceChecksum: ContentChecksum;
    readonly submittedAt: Instant;
  },
): Result<AttemptTransition, AttemptFailure> {
  const sequence = activeAttempt(attempt);
  if (!sequence.ok) return sequence;
  const next = {
    ...attempt,
    status: "submitted" as const,
    terminalReason: "submitted" as const,
    version: attempt.version + 1,
    eventSequence: sequence.value,
    updatedAt: input.submittedAt,
    endedAt: input.submittedAt,
  };
  return ok({
    attempt: next,
    event: {
      ...eventBase(attempt, input.eventId, input.submittedAt, sequence.value),
      kind: "submitted",
      metadata: { runId: input.runId, sourceChecksum: input.sourceChecksum },
    },
  });
}

function endAttempt(
  attempt: LearningAttempt,
  input: {
    readonly eventId: OpaqueId<"event">;
    readonly status: "abandoned" | "expired";
    readonly reason: "learner" | "language_changed" | "session_ended" | "expired";
    readonly endedAt: Instant;
  },
): Result<AttemptTransition, AttemptFailure> {
  const sequence = activeAttempt(attempt);
  if (!sequence.ok) return sequence;
  const kind = input.status === "abandoned" ? "abandoned" : "expired";
  const metadata =
    kind === "abandoned"
      ? { reason: input.reason as "learner" | "language_changed" | "session_ended" }
      : {
          reason:
            input.reason === "expired" ? ("idle_timeout" as const) : ("session_timeout" as const),
        };
  const next = {
    ...attempt,
    status: input.status,
    terminalReason: input.reason,
    version: attempt.version + 1,
    eventSequence: sequence.value,
    updatedAt: input.endedAt,
    endedAt: input.endedAt,
  };
  return ok({
    attempt: next,
    event: {
      ...eventBase(attempt, input.eventId, input.endedAt, sequence.value),
      kind,
      metadata,
    } as AttemptEvent,
  });
}

export function abandonAttempt(
  attempt: LearningAttempt,
  input: {
    readonly eventId: OpaqueId<"event">;
    readonly reason?: "learner" | "language_changed" | "session_ended";
    readonly endedAt: Instant;
  },
): Result<AttemptTransition, AttemptFailure> {
  return endAttempt(attempt, {
    ...input,
    status: "abandoned",
    reason: input.reason ?? "learner",
  });
}

export function expireAttempt(
  attempt: LearningAttempt,
  input: {
    readonly eventId: OpaqueId<"event">;
    readonly reason?: "expired";
    readonly endedAt: Instant;
  },
): Result<AttemptTransition, AttemptFailure> {
  return endAttempt(attempt, {
    ...input,
    status: "expired",
    reason: input.reason ?? "expired",
  });
}

export function resetAttemptForLanguage(
  session: LearningSession,
  current: LearningAttempt,
  input: {
    readonly nextAttemptId: OpaqueId<"attempt">;
    readonly previousEventId: OpaqueId<"event">;
    readonly nextEventId: OpaqueId<"event">;
    readonly problemVersionId: ProblemVersionId;
    readonly manifestId: LanguageManifestId;
    readonly language: ProblemLanguage;
    readonly resetAt: Instant;
  },
): Result<AttemptReset, AttemptFailure> {
  if (current.sessionId !== session.sessionId || current.learnerId !== session.learnerId) {
    return err({
      code: "invalid_state",
      message: "Attempt does not belong to the selected session.",
    });
  }
  if (current.problemVersionId !== input.problemVersionId) {
    return err({
      code: "problem_mismatch",
      message: "A language reset must keep the same problem version pinned.",
    });
  }
  if (current.language === input.language) {
    return err({
      code: "same_language",
      message: "Changing language requires a different language.",
    });
  }
  const previous = abandonAttempt(current, {
    eventId: input.previousEventId,
    reason: "language_changed",
    endedAt: input.resetAt,
  });
  if (!previous.ok) return previous;
  const next = startAttempt(session, {
    attemptId: input.nextAttemptId,
    eventId: input.nextEventId,
    problemVersionId: input.problemVersionId,
    manifestId: input.manifestId,
    language: input.language,
    startedAt: input.resetAt,
    resetFromAttemptId: current.attemptId,
  });
  if (!next.ok) return next;
  return ok({ previous: previous.value, next: next.value });
}
