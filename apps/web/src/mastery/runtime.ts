import type { MasteryRepository, MasteryConceptSource } from "@algocove/application";
import { PostgresMasteryRepository, PostgresMasteryConceptSource } from "@algocove/db";
import { getPracticeRuntime } from "../practice/runtime";

export function getMasteryRepository(): MasteryRepository | null {
  const runtime = getPracticeRuntime();
  return runtime === null ? null : new PostgresMasteryRepository(runtime.pool);
}

export function getMasteryRuntime(): {
  mastery: MasteryRepository;
  curriculum: MasteryConceptSource;
} | null {
  const runtime = getPracticeRuntime();
  return runtime === null
    ? null
    : {
        mastery: new PostgresMasteryRepository(runtime.pool),
        curriculum: new PostgresMasteryConceptSource(runtime.pool),
      };
}
