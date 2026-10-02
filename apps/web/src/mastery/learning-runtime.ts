import {
  PostgresMasteryRepository,
  PostgresMasteryConceptSource,
  PostgresReviewRepository,
  PostgresProgressRepository,
} from "@algocove/db";
import type {
  MasteryIngestionPorts,
  LearningReviewRepository,
  LearningProgressRepository,
} from "@algocove/application";
import { getPracticeRuntime } from "../practice/runtime";
export function getLearningRuntime(): {
  readonly reviews: LearningReviewRepository;
  readonly progress: LearningProgressRepository;
  readonly ingestion: MasteryIngestionPorts;
} | null {
  const practice = getPracticeRuntime();
  if (practice === null) return null;
  return {
    reviews: new PostgresReviewRepository(practice.pool),
    progress: new PostgresProgressRepository(practice.pool),
    ingestion: {
      practice: practice.practice,
      mastery: new PostgresMasteryRepository(practice.pool),
      curriculum: new PostgresMasteryConceptSource(practice.pool),
    },
  };
}
