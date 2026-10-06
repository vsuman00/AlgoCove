import {
  parseWorkerJobDescriptor,
  type Clock,
  type WorkerJobDescriptor,
} from "@algocove/application";
import type { ClaimedOutboxEvent, PostgresWorkerEffectsRepository } from "@algocove/db";
import { WorkerJobRegistry, type WorkerJobHandler, type WorkerJobTopic } from "./job-registry.ts";

export type WorkerModuleConsumer = {
  /** Module-owned consumer: reload canonical state; impose provider deadlines;
   * use eventId as idempotency identity; commit result/lineage/receipt atomically.
   * External calls must occur outside database transactions. */
  readonly consume: (input: {
    event: ClaimedOutboxEvent;
    descriptor: WorkerJobDescriptor;
  }) => Promise<void>;
};
export type WorkerModuleConsumers = Partial<
  Record<
    "content.derivation.requested" | "content.embedding.requested" | "evaluation.requested",
    WorkerModuleConsumer
  >
>;

export function createWorkerJobHandlers(input: {
  readonly effects: PostgresWorkerEffectsRepository;
  readonly relayId: string;
  readonly clock: Clock;
  readonly modules?: WorkerModuleConsumers;
  readonly enableRetention?: boolean;
}): WorkerJobRegistry {
  const handler = (
    topic: WorkerJobTopic,
    handle: WorkerJobHandler["handle"],
  ): WorkerJobHandler => ({
    topic,
    validate(event): boolean {
      try {
        parseWorkerJobDescriptor(topic, event.payload);
        return true;
      } catch {
        return false;
      }
    },
    handle,
  });
  const handlers: WorkerJobHandler[] = [
    handler("platform.reconciliation.requested", async (event) => {
      await input.effects.reconcile(event, input.relayId, input.clock.now());
    }),
  ];
  if (input.enableRetention)
    handlers.push(
      handler("privacy.retention.requested", async (event) => {
        await input.effects.retainExpiredDrafts(event, input.relayId, input.clock.now());
      }),
    );
  for (const topic of [
    "content.derivation.requested",
    "content.embedding.requested",
    "evaluation.requested",
  ] as const) {
    const consumer = input.modules?.[topic];
    if (consumer)
      handlers.push(
        handler(topic, async (event) => {
          if (
            topic !== "evaluation.requested" &&
            !(await input.effects.admitContent(event, input.relayId, input.clock.now()))
          )
            return;
          await consumer.consume({
            event,
            descriptor: parseWorkerJobDescriptor(topic, event.payload),
          });
        }),
      );
  }
  return new WorkerJobRegistry(handlers);
}
