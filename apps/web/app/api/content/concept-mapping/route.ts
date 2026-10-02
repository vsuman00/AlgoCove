import type { NextResponse } from "next/server";
import {
  authorProblemConceptMapping,
  validationError,
  dependencyUnavailableError,
} from "@algocove/application";
import { PostgresConceptMappingRepository } from "@algocove/db";
import { parseId } from "@algocove/domain";
import { authenticatedWebRequestContext } from "../../../../src/auth/request-context";
import { getPracticeRuntime } from "../../../../src/practice/runtime";
import {
  learningBody,
  learningResponse,
  learningError,
} from "../../../../src/mastery/learning-http";
export const dynamic = "force-dynamic";
export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const context = await authenticatedWebRequestContext(request);
    const body = await learningBody(request);
    const problem = parseId("problemVersion", body.problemVersionId);
    if (!problem.ok || !Array.isArray(body.mappings))
      throw validationError("Problem version and concept mappings are required.");
    const mappings = body.mappings.map((value: unknown) => {
      if (
        typeof value !== "object" ||
        value === null ||
        !("conceptId" in value) ||
        !("rationale" in value) ||
        typeof value.rationale !== "string"
      )
        throw validationError("Invalid concept mapping.");
      const concept = parseId("concept", value.conceptId);
      if (!concept.ok) throw validationError("Invalid concept identifier.");
      return { conceptId: concept.value, rationale: value.rationale };
    });
    const runtime = getPracticeRuntime();
    if (runtime === null) throw dependencyUnavailableError("Content persistence is unavailable.");
    await authorProblemConceptMapping(context, new PostgresConceptMappingRepository(runtime.pool), {
      problemVersionId: problem.value,
      mappings,
    });
    return learningResponse({ status: "saved", reviewsInvalidated: true });
  } catch (e) {
    return learningError(request, e);
  }
}
