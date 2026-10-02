import { PostgresRoadmapIntentRepository } from "@algocove/db";
import type { RoadmapIntentRepository } from "@algocove/application";
import { getPracticeRuntime } from "../practice/runtime";
export function getRoadmapIntentRepository(): RoadmapIntentRepository | null {
  const runtime = getPracticeRuntime();
  return runtime === null ? null : new PostgresRoadmapIntentRepository(runtime.pool);
}
