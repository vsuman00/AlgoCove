import { NextResponse } from "next/server";
import {
  dependencyUnavailableError,
  startOwnedPseudocode,
  startPracticeAttempt,
  startPracticeDraft,
  startPracticeSession,
  toErrorEnvelope,
  toHttpStatus,
  validationError,
} from "@algocove/application";
import { parseId, PROBLEM_LANGUAGES, type ProblemLanguage } from "@algocove/domain";
import { authenticatedWebRequestContext } from "../../../../src/auth/request-context";
import { getPracticeRuntime, type PracticeRuntime } from "../../../../src/practice/runtime";

export const dynamic = "force-dynamic";

const PROBLEM_VERSION_BY_SLUG = {
  "arrays-two-pointer": "prb_dddddddddddddddd",
} as const;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const context = await authenticatedWebRequestContext(request);
    const input = await request.json();
    if (!isRecord(input)) throw validationError("Workspace input must be an object.");
    const problemVersionId = problemVersionFrom(input.problemId);
    if (!PROBLEM_LANGUAGES.includes(input.language as ProblemLanguage)) {
      throw validationError("Workspace language is not supported.", { field: "language" });
    }
    const language = input.language as ProblemLanguage;
    const runtime = getPracticeRuntime();
    if (runtime === null) throw dependencyUnavailableError("Practice persistence is unavailable.");
    const manifest = await manifestFor(runtime.pool, problemVersionId, language);
    if (manifest === null) {
      throw dependencyUnavailableError("This problem is not available for practice yet.");
    }

    let session = await runtime.practice.findActiveSession(context.actor.userId, "learn");
    if (session === null) {
      try {
        session = await startPracticeSession(context, runtime.practice, "learn");
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        session = await runtime.practice.findActiveSession(context.actor.userId, "learn");
        if (session === null) throw error;
      }
    }

    let attempt = await runtime.practice.findActiveAttempt({
      learnerId: context.actor.userId,
      problemVersionId,
      manifestId: manifest.manifestId,
      language,
    });
    if (attempt === null) {
      try {
        attempt = await startPracticeAttempt(context, runtime.practice, {
          sessionId: session.sessionId,
          problemVersionId,
          manifestId: manifest.manifestId,
          language,
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        attempt = await runtime.practice.findActiveAttempt({
          learnerId: context.actor.userId,
          problemVersionId,
          manifestId: manifest.manifestId,
          language,
        });
        if (attempt === null) throw error;
      }
    }

    let sourceDraft = await runtime.drafts.findDraftByAttempt({
      attemptId: attempt.attemptId,
      learnerId: context.actor.userId,
      kind: "source",
    });
    if (sourceDraft === null) {
      try {
        sourceDraft = await startPracticeDraft(context, runtime.drafts, {
          draftId: context.ids.generate("draft"),
          attemptId: attempt.attemptId,
          kind: "source",
          localRecoveryEnabled: true,
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        sourceDraft = await runtime.drafts.findDraftByAttempt({
          attemptId: attempt.attemptId,
          learnerId: context.actor.userId,
          kind: "source",
        });
        if (sourceDraft === null) throw error;
      }
    }

    let pseudocode = await runtime.pseudocode.findPseudocodeByAttempt({
      attemptId: attempt.attemptId,
      learnerId: context.actor.userId,
    });
    if (pseudocode === null) {
      try {
        pseudocode = await startOwnedPseudocode(context, runtime.pseudocode, {
          pseudocodeId: context.ids.generate("pseudocode"),
          attemptId: attempt.attemptId,
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        pseudocode = await runtime.pseudocode.findPseudocodeByAttempt({
          attemptId: attempt.attemptId,
          learnerId: context.actor.userId,
        });
        if (pseudocode === null) throw error;
      }
    }

    const latestRun = await runtime.practice.getLatestRun({
      attemptId: attempt.attemptId,
      learnerId: context.actor.userId,
    });
    const activeRun =
      latestRun === null
        ? null
        : latestRun.terminalResultId === null
          ? { runId: latestRun.runId, mode: latestRun.mode, status: "queued" as const }
          : latestRun.terminalCategory !== null &&
              latestRun.classification !== null &&
              latestRun.completedAt !== null
            ? {
                runId: latestRun.runId,
                mode: latestRun.mode,
                status: "completed" as const,
                result: {
                  resultId: latestRun.terminalResultId,
                  terminalCategory: latestRun.terminalCategory,
                  classification: latestRun.classification,
                  passed:
                    latestRun.terminalCategory === "pass" && latestRun.classification === "success",
                  completedAt: latestRun.completedAt,
                },
              }
            : null;
    if (latestRun !== null && latestRun.terminalResultId !== null && activeRun === null) {
      throw dependencyUnavailableError("Execution result is temporarily unavailable.");
    }

    return NextResponse.json(
      {
        attempt,
        sourceDraft,
        pseudocode,
        activeRun,
        starterTemplate: manifest.starterTemplate,
        firstHintId: "hint-arrays-1",
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(request, error);
  }
}

async function manifestFor(
  pool: PracticeRuntime["pool"],
  problemVersionId: string,
  language: ProblemLanguage,
) {
  const result = await pool.query<{ manifest_id: string; starter_template: string }>(
    `SELECT manifest.manifest_id, manifest.starter_template
       FROM content.problem_language_manifest AS manifest
       JOIN content.problem_version AS problem
         ON problem.problem_version_id = manifest.problem_version_id
       JOIN content.content_version AS version
         ON version.content_version_id = problem.content_version_id
      WHERE manifest.problem_version_id = $1
        AND manifest.language = $2
        AND manifest.status = 'published'
        AND version.status = 'published'
        AND version.payload_status = 'available'`,
    [problemVersionId, language],
  );
  const row = result.rows[0];
  if (row === undefined) return null;
  const manifestId = parseId("languageManifest", row.manifest_id);
  if (!manifestId.ok) throw new Error("Published manifest identifier is invalid.");
  return { manifestId: manifestId.value, starterTemplate: row.starter_template };
}

function problemVersionFrom(value: unknown) {
  if (typeof value !== "string" || !(value in PROBLEM_VERSION_BY_SLUG)) {
    throw validationError("Problem workspace is not available.", { field: "problem_id" });
  }
  const raw = PROBLEM_VERSION_BY_SLUG[value as keyof typeof PROBLEM_VERSION_BY_SLUG];
  const problemVersionId = parseId("problemVersion", raw);
  if (!problemVersionId.ok) throw new Error("Practice catalog identifier is invalid.");
  return problemVersionId.value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === "23505"
  );
}

function errorResponse(request: Request, error: unknown): NextResponse {
  const traceId = request.headers.get("x-trace-id") ?? "req_0000000000000000";
  return NextResponse.json(toErrorEnvelope(error, traceId), {
    status:
      error instanceof Error && "code" in error && error.code === "unauthenticated"
        ? 401
        : toHttpStatus(error),
    headers: { "Cache-Control": "no-store" },
  });
}
