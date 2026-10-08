import type { NextResponse } from "next/server";
import { PostgresPilotRepository, withTransaction, type PilotReviewKind } from "@algocove/db";
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
    const ctx = await authenticatedWebRequestContext(request);
    const runtime = getPracticeRuntime();
    if (!runtime) throw dependencyUnavailableError("Content persistence is unavailable.");
    const exporting = new URL(request.url).searchParams.get("export") === "published";
    const records = await withTransaction<readonly Record<string, unknown>[]>(runtime.pool, (tx) =>
      exporting
        ? new PostgresPilotRepository(tx).exportPublished(ctx)
        : new PostgresPilotRepository(tx).list(ctx),
    );
    return learningResponse(exporting ? records : { records });
  } catch (e) {
    return learningError(request, e);
  }
}
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const ctx = await authenticatedWebRequestContext(request);
    const body = await boundedLearningBody(request);
    const runtime = getPracticeRuntime();
    if (!runtime) throw dependencyUnavailableError("Content persistence is unavailable.");
    const allowed = ["import", "collection"].includes(String(body.command))
      ? ["command", "bundle"]
      : ["command", "versionId", "checksum", "kind", "decision", "notes"];
    if (Object.keys(body).some((k) => !allowed.includes(k)))
      throw validationError("Unsupported command field.");
    return learningResponse(
      await withTransaction<Record<string, unknown>>(runtime.pool, async (tx) => {
        const repo = new PostgresPilotRepository(tx);
        if (body.command === "import") return repo.import(ctx, body.bundle);
        if (body.command === "collection") return repo.importCollection(ctx, body.bundle);
        if (
          body.command !== "review" ||
          typeof body.versionId !== "string" ||
          typeof body.checksum !== "string" ||
          typeof body.notes !== "string" ||
          (body.decision !== "approved" && body.decision !== "rejected")
        )
          throw validationError("Choose a bounded pilot command.");
        return repo.review(ctx, {
          versionId: body.versionId,
          checksum: body.checksum,
          kind: body.kind as PilotReviewKind,
          decision: body.decision,
          notes: body.notes,
        });
      }),
    );
  } catch (e) {
    return learningError(request, e);
  }
}
