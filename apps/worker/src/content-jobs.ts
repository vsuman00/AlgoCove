import { CHUNK_POLICY_VERSION } from "@algocove/content";
import { ContentIndexer, fixtureEmbeddingPort, type ContentDescriptor } from "@algocove/retrieval";
import { PostgresContentIndexRepository } from "@algocove/db";
import type { Pool } from "pg";
import type { Clock } from "@algocove/application";
import type { WorkerModuleConsumers } from "./job-handlers.ts";
export function createContentJobConsumers(input: {
  pool: Pool;
  relayId: string;
  clock: Clock;
  fixtureEmbeddings?: boolean;
}): WorkerModuleConsumers {
  const indexer = new ContentIndexer(
    new PostgresContentIndexRepository(input.pool, input.relayId, () => input.clock.now()),
    () => input.clock.now(),
  );
  return {
    "content.derivation.requested": {
      consume: ({ event, descriptor }) => indexer.derive(event, descriptor as ContentDescriptor),
    },
    ...(input.fixtureEmbeddings
      ? {
          "content.embedding.requested": {
            consume: ({
              event,
              descriptor,
            }: Parameters<
              NonNullable<WorkerModuleConsumers["content.embedding.requested"]>["consume"]
            >[0]) =>
              indexer.embed(
                event,
                descriptor as ContentDescriptor,
                CHUNK_POLICY_VERSION,
                fixtureEmbeddingPort,
              ),
          },
        }
      : {}),
  };
}
