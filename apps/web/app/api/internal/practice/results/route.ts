import { getLearningRuntime } from "../../../../../src/mastery/learning-runtime";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  authenticationRequired,
  consumePracticeAssessment,
  createActor,
  dependencyUnavailableError,
  ingestTrustedPracticeResult,
  toErrorEnvelope,
  toHttpStatus,
  validationError,
} from "@algocove/application";
import { loadConfigFromProcess } from "@algocove/config";
import { parseExecutionResult, type SignedExecutionResult } from "@algocove/execution-contracts";
import { parseId } from "@algocove/domain";
import { createWebRequestContext } from "../../../../../src/auth/request-context";
import { getPracticeRuntime } from "../../../../../src/practice/runtime";
import {
  executionVerificationKeys,
  verifyCommittedExecutionResult,
} from "../../../../../src/adapters/execution-result-verifier";

export const dynamic = "force-dynamic";

/**
 * Internal callback from the execution worker. The worker-side control plane
 * confirms teardown before calling this endpoint; the web verifies the result
 * signature against the atomically committed descriptor, requires a separate
 * server-only callback token and reuses the
 * owner-scoped application result boundary before changing learner state.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let currentStage = "authenticate_callback";
  try {
    const callbackToken = loadCallbackToken();
    if (!matchesBearer(request.headers.get("authorization"), callbackToken)) {
      throw authenticationRequired("Execution result callback authentication failed.");
    }
    currentStage = "parse_signed_result";
    const input = await request.json();
    const signed = signedResultFrom(input);
    const parsed = parseExecutionResult(signed.payload);
    if (!parsed.ok) throw validationError(parsed.error.message, { field: "result" });

    const runId = parseId("codeRun", parsed.value.runId);
    if (!runId.ok) throw validationError("Execution run identifier is invalid.");
    currentStage = "load_practice_runtime";
    const runtime = getPracticeRuntime();
    if (runtime === null) throw dependencyUnavailableError("Practice persistence is unavailable.");
    currentStage = "load_committed_run";
    const run = await runtime.practice.getRunById(runId.value);
    if (run === null) throw validationError("Execution run is not available.", { field: "run" });
    currentStage = "verify_committed_result";
    try {
      const dispatch = await runtime.practice.getRunDispatch(runId.value);
      verifyCommittedExecutionResult(
        signed,
        dispatch,
        run,
        executionVerificationKeys(process.env.EXECUTION_VERIFICATION_KEYS_JSON),
        new Date().toISOString(),
      );
    } catch {
      throw validationError("Execution result signature or committed binding is invalid.", {
        field: "result",
      });
    }
    currentStage = "load_attempt";
    const attempt = await runtime.practice.getAttempt(run.attemptId, run.learnerId);
    if (attempt === null) {
      throw validationError("Execution attempt is not available.", { field: "attempt" });
    }

    const context = createWebRequestContext(
      createActor({
        userId: run.learnerId,
        sessionId: attempt.sessionId,
        roles: ["learner"],
      }),
      request.headers.get("x-trace-id") ?? undefined,
    );
    currentStage = "persist_trusted_result";
    const receipt = await ingestTrustedPracticeResult(context, runtime.practice, {
      result: {
        resultId: parsed.value.resultId,
        runId: parsed.value.runId,
        attemptId: parsed.value.attemptId,
        problemVersionId: run.problemVersionId,
        manifestId: run.manifestId,
        language: run.language,
        sourceChecksum: run.sourceChecksum,
        terminalCategory: parsed.value.terminalCategory,
        classification: parsed.value.classification,
        descriptorDigest: parsed.value.descriptorDigest,
        replayId: parsed.value.replayId,
        leaseEpoch: parsed.value.leaseEpoch,
        completedAt: parsed.value.issuedAt,
      },
    });
    if (receipt.observation !== null) {
      // The source commit is durable before projection delivery. The leased relay retries failures.
      try {
        currentStage = "project_assessment";
        const learning = getLearningRuntime();
        const eventId = await runtime.practice.getAssessmentEventId(
          receipt.observation.observationId,
        );
        if (learning !== null && eventId !== null)
          await consumePracticeAssessment(context, learning.ingestion, eventId);
      } catch {
        /* Durable outbox delivery remains pending. */
      }
    }
    return NextResponse.json(
      {
        disposition: receipt.disposition,
        attempt: receipt.attempt,
        observation: receipt.observation,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (toHttpStatus(error) >= 500) logCallbackFailure(request, currentStage, error);
    return errorResponse(request, error);
  }
}

function logCallbackFailure(request: Request, currentStage: string, error: unknown): void {
  const errorName =
    error instanceof Error ? error.name.replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 80) : "unknown";
  const errorCode =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    /^[A-Za-z0-9_.-]{1,40}$/.test(error.code)
      ? error.code
      : "unknown";
  const traceId = request.headers.get("x-trace-id") ?? "req_0000000000000000";
  process.stderr.write(
    "[api] execution_result_callback_failed " +
      JSON.stringify({ traceId, stage: currentStage, errorName, errorCode }) +
      "\n",
  );
}

function loadCallbackToken(): string {
  const config = loadConfigFromProcess({
    ...process.env,
    SERVICE_NAME: process.env.SERVICE_NAME ?? "algocove-web",
    APP_ORIGIN: process.env.APP_ORIGIN ?? "http://localhost:3000",
  });
  const token = config.execution.resultCallbackToken?.reveal();
  if (token === undefined) {
    throw dependencyUnavailableError("Execution result callback is not configured.");
  }
  return token;
}

function matchesBearer(header: string | null, expected: string): boolean {
  if (header === null || !header.startsWith("Bearer ")) return false;
  const provided = Buffer.from(header.slice("Bearer ".length), "utf8");
  const target = Buffer.from(expected, "utf8");
  return provided.length === target.length && timingSafeEqual(provided, target);
}

function signedResultFrom(input: unknown): SignedExecutionResult {
  if (!isRecord(input) || !isRecord(input.result)) {
    throw validationError("Execution result callback body is invalid.", { field: "result" });
  }
  const result = input.result;
  if (
    result.algorithm !== "ed25519" ||
    typeof result.keyId !== "string" ||
    !isRecord(result.payload) ||
    typeof result.signature !== "string"
  ) {
    throw validationError("Signed execution result envelope is invalid.", { field: "result" });
  }
  return {
    algorithm: "ed25519",
    keyId: result.keyId,
    payload: result.payload as SignedExecutionResult["payload"],
    signature: result.signature,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
