import { authorizationError, dependencyUnavailableError } from "@algocove/application";
import { PostgresOperationalRepository } from "@algocove/db";
import { OPERATIONS, calculateSlo, evaluateOperationalAlerts } from "@algocove/observability";
import { authenticatedWebRequestContext } from "../../../../src/auth/request-context";
import { getPracticeRuntime } from "../../../../src/practice/runtime";
import { learningError, learningResponse } from "../../../../src/mastery/learning-http";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<Response> {
  try {
    const ctx = await authenticatedWebRequestContext(request);
    const runtime = getPracticeRuntime();
    if (!runtime) throw dependencyUnavailableError("Operations persistence unavailable.");
    const grant = await runtime.pool.query(
      "SELECT 1 FROM platform.role_grant WHERE learner_id=$1 AND role='operator' AND revoked_at IS NULL",
      [ctx.actor.userId],
    );
    if (!ctx.actor.roles.includes("operator") || !grant.rowCount)
      throw authorizationError("Operator access required.");
    const snapshot = await new PostgresOperationalRepository(runtime.pool).snapshot(),
      now = Date.now();
    return learningResponse({
      policy: "local-operational-targets.v1",
      scope: "local measurements; hosted reliability not qualified",
      slo: Object.fromEntries(
        OPERATIONS.map((op) => [op, calculateSlo(snapshot.samples, op, now, 60 * 60 * 1000)]),
      ),
      alerts: evaluateOperationalAlerts({
        ...snapshot,
        now,
        workerEnabled: process.env.WORKER_CONTENT_ENABLED === "true",
      }),
      privacy: snapshot.privacy,
      learning: snapshot.learning,
      truncated: snapshot.truncated,
    });
  } catch (error) {
    return learningError(request, error);
  }
}
