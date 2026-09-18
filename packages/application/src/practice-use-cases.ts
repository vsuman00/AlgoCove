import {
  abandonAttempt,
  abandonLearningSession,
  completeLearningSession,
  expireAttempt,
  expireLearningSession,
  recordRunRequested,
  recordSourceSaved,
  resetAttemptForLanguage,
  startAttempt,
  startLearningSession,
  submitAttempt,
  type AttemptEvent,
  type CodeRunId,
  type LanguageManifestId,
  type LearningAttempt,
  type LearningMode,
  type LearningSession,
  type ProblemLanguage,
  type ProblemVersionId,
  type Result,
} from "@algocove/domain";
import { conflictError, notFoundError, validationError } from "./errors.ts";
import type { RequestContext } from "./request-context.ts";

export type PracticeRepository = {
  createSession(session: LearningSession): Promise<LearningSession>;
  getSession(
    sessionId: LearningSession["sessionId"],
    learnerId: LearningSession["learnerId"],
  ): Promise<LearningSession | null>;
  updateSession(input: {
    readonly session: LearningSession;
    readonly expectedVersion: number;
  }): Promise<LearningSession | null>;
  createAttempt(input: {
    readonly attempt: LearningAttempt;
    readonly event: AttemptEvent;
  }): Promise<LearningAttempt>;
  getAttempt(
    attemptId: LearningAttempt["attemptId"],
    learnerId: LearningAttempt["learnerId"],
  ): Promise<LearningAttempt | null>;
  listAttempts(
    learnerId: LearningAttempt["learnerId"],
    limit?: number,
  ): Promise<readonly LearningAttempt[]>;
  saveAttempt(input: {
    readonly attempt: LearningAttempt;
    readonly event: AttemptEvent;
    readonly expectedVersion: number;
  }): Promise<LearningAttempt | null>;
  resetAttemptForLanguage(input: {
    readonly previous: {
      readonly attempt: LearningAttempt;
      readonly event: AttemptEvent;
      readonly expectedVersion: number;
    };
    readonly next: {
      readonly attempt: LearningAttempt;
      readonly event: AttemptEvent;
    };
  }): Promise<LearningAttempt | null>;
};

export async function startPracticeSession(
  context: RequestContext,
  repository: PracticeRepository,
  mode: LearningMode,
): Promise<LearningSession> {
  return persistResult(
    startLearningSession({
      sessionId: context.ids.generate("session"),
      learnerId: context.actor.userId,
      mode,
      startedAt: context.now,
    }),
    (session) => repository.createSession(session),
  );
}

export async function startPracticeAttempt(
  context: RequestContext,
  repository: PracticeRepository,
  input: {
    readonly sessionId: LearningSession["sessionId"];
    readonly problemVersionId: ProblemVersionId;
    readonly manifestId: LanguageManifestId;
    readonly language: ProblemLanguage;
  },
): Promise<LearningAttempt> {
  const session = await ownedSession(context, repository, input.sessionId);
  const result = startAttempt(session, {
    attemptId: context.ids.generate("attempt"),
    eventId: context.ids.generate("event"),
    problemVersionId: input.problemVersionId,
    manifestId: input.manifestId,
    language: input.language,
    startedAt: context.now,
  });
  if (!result.ok) throw validationError(result.error.message, { field: result.error.code });
  return repository.createAttempt(result.value);
}

export async function completePracticeSession(
  context: RequestContext,
  repository: PracticeRepository,
  sessionId: LearningSession["sessionId"],
): Promise<LearningSession> {
  return updateSession(context, repository, sessionId, completeLearningSession);
}

export async function abandonPracticeSession(
  context: RequestContext,
  repository: PracticeRepository,
  sessionId: LearningSession["sessionId"],
): Promise<LearningSession> {
  return updateSession(context, repository, sessionId, abandonLearningSession);
}

export async function expirePracticeSession(
  context: RequestContext,
  repository: PracticeRepository,
  sessionId: LearningSession["sessionId"],
): Promise<LearningSession> {
  return updateSession(context, repository, sessionId, expireLearningSession);
}

export async function saveAttemptSource(
  context: RequestContext,
  repository: PracticeRepository,
  input: {
    readonly attemptId: LearningAttempt["attemptId"];
    readonly expectedVersion: number;
    readonly sourceChecksum: Parameters<typeof recordSourceSaved>[1]["sourceChecksum"];
    readonly sourceLength: number;
  },
): Promise<LearningAttempt> {
  const attempt = await ownedAttempt(context, repository, input.attemptId);
  const result = recordSourceSaved(attempt, {
    eventId: context.ids.generate("event"),
    sourceChecksum: input.sourceChecksum,
    sourceLength: input.sourceLength,
    occurredAt: context.now,
  });
  return persistAttemptTransition(repository, attempt, input.expectedVersion, result);
}

export async function requestAttemptRun(
  context: RequestContext,
  repository: PracticeRepository,
  input: {
    readonly attemptId: LearningAttempt["attemptId"];
    readonly expectedVersion: number;
    readonly runId: CodeRunId;
    readonly sourceChecksum: Parameters<typeof recordRunRequested>[1]["sourceChecksum"];
  },
): Promise<LearningAttempt> {
  const attempt = await ownedAttempt(context, repository, input.attemptId);
  const result = recordRunRequested(attempt, {
    eventId: context.ids.generate("event"),
    runId: input.runId,
    sourceChecksum: input.sourceChecksum,
    occurredAt: context.now,
  });
  return persistAttemptTransition(repository, attempt, input.expectedVersion, result);
}

export async function submitPracticeAttempt(
  context: RequestContext,
  repository: PracticeRepository,
  input: {
    readonly attemptId: LearningAttempt["attemptId"];
    readonly expectedVersion: number;
    readonly runId: CodeRunId;
    readonly sourceChecksum: Parameters<typeof submitAttempt>[1]["sourceChecksum"];
  },
): Promise<LearningAttempt> {
  const attempt = await ownedAttempt(context, repository, input.attemptId);
  const result = submitAttempt(attempt, {
    eventId: context.ids.generate("event"),
    runId: input.runId,
    sourceChecksum: input.sourceChecksum,
    submittedAt: context.now,
  });
  return persistAttemptTransition(repository, attempt, input.expectedVersion, result);
}

export async function abandonPracticeAttempt(
  context: RequestContext,
  repository: PracticeRepository,
  input: {
    readonly attemptId: LearningAttempt["attemptId"];
    readonly expectedVersion: number;
    readonly reason?: "learner" | "session_ended";
  },
): Promise<LearningAttempt> {
  const attempt = await ownedAttempt(context, repository, input.attemptId);
  const result = abandonAttempt(
    attempt,
    input.reason === undefined
      ? { eventId: context.ids.generate("event"), endedAt: context.now }
      : { eventId: context.ids.generate("event"), reason: input.reason, endedAt: context.now },
  );
  return persistAttemptTransition(repository, attempt, input.expectedVersion, result);
}

export async function expirePracticeAttempt(
  context: RequestContext,
  repository: PracticeRepository,
  input: {
    readonly attemptId: LearningAttempt["attemptId"];
    readonly expectedVersion: number;
  },
): Promise<LearningAttempt> {
  const attempt = await ownedAttempt(context, repository, input.attemptId);
  const result = expireAttempt(attempt, {
    eventId: context.ids.generate("event"),
    endedAt: context.now,
  });
  return persistAttemptTransition(repository, attempt, input.expectedVersion, result);
}

export async function resetPracticeAttemptLanguage(
  context: RequestContext,
  repository: PracticeRepository,
  input: {
    readonly attemptId: LearningAttempt["attemptId"];
    readonly expectedVersion: number;
    readonly problemVersionId: ProblemVersionId;
    readonly manifestId: LanguageManifestId;
    readonly language: ProblemLanguage;
  },
): Promise<LearningAttempt> {
  const current = await ownedAttempt(context, repository, input.attemptId);
  const session = await ownedSession(context, repository, current.sessionId);
  const result = resetAttemptForLanguage(session, current, {
    nextAttemptId: context.ids.generate("attempt"),
    previousEventId: context.ids.generate("event"),
    nextEventId: context.ids.generate("event"),
    problemVersionId: input.problemVersionId,
    manifestId: input.manifestId,
    language: input.language,
    resetAt: context.now,
  });
  if (!result.ok) throw validationError(result.error.message, { field: result.error.code });
  const saved = await repository.resetAttemptForLanguage({
    previous: {
      attempt: result.value.previous.attempt,
      event: result.value.previous.event,
      expectedVersion: input.expectedVersion,
    },
    next: result.value.next,
  });
  if (saved === null) throwVersionConflict(input.expectedVersion);
  return saved;
}

export function getOwnedAttemptHistory(
  context: RequestContext,
  repository: PracticeRepository,
  limit?: number,
): Promise<readonly LearningAttempt[]> {
  return repository.listAttempts(context.actor.userId, limit);
}

async function ownedSession(
  context: RequestContext,
  repository: PracticeRepository,
  sessionId: LearningSession["sessionId"],
): Promise<LearningSession> {
  const session = await repository.getSession(sessionId, context.actor.userId);
  if (session === null) throw notFoundError("Learning session is not available.");
  return session;
}

async function ownedAttempt(
  context: RequestContext,
  repository: PracticeRepository,
  attemptId: LearningAttempt["attemptId"],
): Promise<LearningAttempt> {
  const attempt = await repository.getAttempt(attemptId, context.actor.userId);
  if (attempt === null) throw notFoundError("Learning attempt is not available.");
  return attempt;
}

async function updateSession(
  context: RequestContext,
  repository: PracticeRepository,
  sessionId: LearningSession["sessionId"],
  transition: (
    session: LearningSession,
    now: LearningSession["updatedAt"],
  ) => Result<LearningSession, { readonly code: string; readonly message: string }>,
): Promise<LearningSession> {
  const session = await ownedSession(context, repository, sessionId);
  const result = transition(session, context.now);
  if (!result.ok) throw validationError(result.error.message, { field: result.error.code });
  const updated = await repository.updateSession({
    session: result.value,
    expectedVersion: session.version,
  });
  if (updated === null) throwVersionConflict(session.version);
  return updated;
}

function persistResult<T, F>(result: Result<T, F>, persist: (value: T) => Promise<T>): Promise<T> {
  if (!result.ok) {
    const failure = result.error as { readonly code?: string; readonly message: string };
    throw validationError(
      failure.message,
      failure.code === undefined ? undefined : { field: failure.code },
    );
  }
  return persist(result.value);
}

async function persistAttemptTransition(
  repository: PracticeRepository,
  previous: LearningAttempt,
  expectedVersion: number,
  result: Result<
    { readonly attempt: LearningAttempt; readonly event: AttemptEvent },
    { readonly code: string; readonly message: string }
  >,
): Promise<LearningAttempt> {
  if (!result.ok) throw validationError(result.error.message, { field: result.error.code });
  const saved = await repository.saveAttempt({
    attempt: result.value.attempt,
    event: result.value.event,
    expectedVersion,
  });
  if (saved === null) throwVersionConflict(previous.version);
  return saved;
}

function throwVersionConflict(expectedVersion: number): never {
  throw conflictError("Practice state changed since it was loaded.", { expectedVersion });
}
