import type { NextResponse } from "next/server";
import {
  PostgresLearningReleaseRepository,
  PostgresDestinationRepository,
  withTransaction,
} from "@algocove/db";
import { dependencyUnavailableError, validationError } from "@algocove/application";
import { authenticatedWebRequestContext } from "../../../../src/auth/request-context";
import { getPracticeRuntime } from "../../../../src/practice/runtime";
import {
  boundedLearningBody,
  learningError,
  learningResponse,
} from "../../../../src/mastery/learning-http";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const ctx = await authenticatedWebRequestContext(request),
      runtime = getPracticeRuntime();
    if (!runtime) throw dependencyUnavailableError("Content persistence is unavailable.");
    const p = new URL(request.url).searchParams;
    if (
      [...p.keys()].some((k) => !["versionId", "destinations"].includes(k)) ||
      [...p.keys()].some((k) => p.getAll(k).length !== 1)
    )
      throw validationError("Unsupported preview filter.");
    return learningResponse(
      await withTransaction<unknown>(runtime.pool, (tx) =>
        p.get("destinations") === "pending"
          ? new PostgresDestinationRepository(tx).pending(ctx)
          : new PostgresLearningReleaseRepository(tx).preflight(ctx, p.get("versionId") ?? ""),
      ),
    );
  } catch (e) {
    return learningError(request, e);
  }
}
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const ctx = await authenticatedWebRequestContext(request),
      body = await boundedLearningBody(request),
      runtime = getPracticeRuntime();
    if (!runtime) throw dependencyUnavailableError("Content persistence is unavailable.");
    const fields =
      body.command === "set"
        ? ["command", "versionId", "expectedChecksum", "packet", "walkthrough"]
        : ["command", "referenceId", "expectedVersion", "solveUrl", "notes"];
    if (Object.keys(body).some((k) => !fields.includes(k)))
      throw validationError("Unsupported release field.");
    return learningResponse(
      await withTransaction(runtime.pool, async (tx) => {
        if (
          body.command === "set" &&
          typeof body.versionId === "string" &&
          (body.expectedChecksum === null || typeof body.expectedChecksum === "string")
        )
          return new PostgresLearningReleaseRepository(tx).set(ctx, {
            versionId: body.versionId,
            expectedChecksum: body.expectedChecksum,
            packet: body.packet,
            walkthrough: body.walkthrough,
          });
        if (
          body.command === "reconcile" &&
          typeof body.referenceId === "string" &&
          Number.isInteger(body.expectedVersion) &&
          typeof body.solveUrl === "string" &&
          typeof body.notes === "string"
        )
          return new PostgresDestinationRepository(tx).reconcile(ctx, {
            referenceId: body.referenceId,
            expectedVersion: body.expectedVersion as number,
            solveUrl: body.solveUrl,
            notes: body.notes,
          });
        throw validationError("Choose a complete release command.");
      }),
    );
  } catch (e) {
    return learningError(request, e);
  }
}
