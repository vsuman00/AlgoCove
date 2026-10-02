import { PostgresRoadmapIntentRepository, PostgresRoadmapRepository } from "@algocove/db";
import type { RoadmapIntentRepository, RoadmapRepository } from "@algocove/application";
import { getPracticeRuntime } from "../practice/runtime";
export function getRoadmapIntentRepository(): RoadmapIntentRepository | null {
  const runtime = getPracticeRuntime();
  return runtime === null ? null : new PostgresRoadmapIntentRepository(runtime.pool);
}
export function getRoadmapRepository(): RoadmapRepository | null {
  const runtime = getPracticeRuntime();
  return runtime === null ? null : new PostgresRoadmapRepository(runtime.pool);
}
