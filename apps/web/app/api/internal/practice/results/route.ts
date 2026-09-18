import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  authenticationRequired,
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

export const dynamic = "force-dynamic";

/**
 * Internal callback from the execution worker. The worker-side control plane
 * verifies the signature and teardown before calling this endpoint; the web
 * surface still requires a separate server-only callback token and reuses the
 * owner-scoped application result boundary before changing learner state.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const callbackToken = loadCallbackToken();
    if (!matchesBearer(request.headers.get("authorization"), callbackToken)) {
      throw authenticationRequired("Execution result callback authentication failed.");
    }
    const input = await request.json();
    const signed = signedResultFrom(input);
    const parsed = parseExecutionResult(signed.payload);
    if (!parsed.ok) throw validationError(parsed.error.message, { field: "result" });

    const runId = parseId("codeRun", parsed.value.runId);
    if (!runId.ok) throw validationError("Execution run identifier is invalid.");
    const runtime = getPracticeRuntime();
    if (runtime === null) throw dependencyUnavailableError("Practice persistence is unavailable.");
    const run = await runtime.practice.getRunById(runId.value);
    if (run === null) throw validationError("Execution run is not available.", { field: "run" });
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
    return NextResponse.json(
      {
        disposition: receipt.disposition,
        attempt: receipt.attempt,
        observation: receipt.observation,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(request, error);
  }
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
