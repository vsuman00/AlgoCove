import { PostgresRetrievalRepository, PostgresTutorRepository } from "@algocove/db";
import { embeddingConfigurationId, type EmbeddingPort } from "@algocove/retrieval";
import { TutorService, type GenerationPort } from "@algocove/tutor";
import type { Pool } from "pg";
import { getPracticeRuntime } from "../practice/runtime";
export function createTutorRuntime(
  pool: Pool,
  approved: {
    generation: GenerationPort;
    embeddings: EmbeddingPort;
    retrievalVersion: string;
    curriculumVersionId: string;
  } | null = null,
): { repository: PostgresTutorRepository; service: TutorService } {
  const repository = new PostgresTutorRepository(pool),
    retrieval = new PostgresRetrievalRepository(pool);
  const service = new TutorService(
    repository,
    approved
      ? {
          async retrieve(ctx, input) {
            const controller = new AbortController();
            let timer: ReturnType<typeof setTimeout> | undefined;
            const vectors = await Promise.race([
              approved.embeddings.embed([input.query], controller.signal),
              new Promise<never>((_, reject) => {
                timer = setTimeout(() => {
                  controller.abort();
                  reject(Error("Embedding unavailable."));
                }, 2000);
              }),
            ]).finally(() => {
              if (timer) clearTimeout(timer);
              controller.abort();
            });
            return retrieval.retrieve(
              ctx,
              {
                ...input,
                configurationVersion: approved.retrievalVersion,
                curriculumVersionId: approved.curriculumVersionId,
              },
              {
                configurationId: embeddingConfigurationId(approved.embeddings.configuration),
                vector: vectors[0] ?? [],
              },
            );
          },
          read: (ctx, id) => retrieval.read(ctx, id),
        }
      : null,
    approved?.generation ?? null,
  );
  return { repository, service };
}
let runtime: ReturnType<typeof createTutorRuntime> | undefined;
/** Live adapters remain absent until provider/data approval and Task45 promotion. */
export function getTutorRuntime(): ReturnType<typeof createTutorRuntime> | null {
  if (runtime) return runtime;
  const practice = getPracticeRuntime();
  if (!practice) return null;
  runtime = createTutorRuntime(practice.pool);
  return runtime;
}
