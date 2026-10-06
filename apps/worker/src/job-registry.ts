import type { ClaimedOutboxEvent } from "@algocove/db";

import { WORKER_JOB_TOPICS } from "@algocove/application";
import type { WorkerJobTopic } from "@algocove/application";
export { WORKER_JOB_TOPICS } from "@algocove/application";
export type { WorkerJobTopic } from "@algocove/application";

export type WorkerJobHandler = {
  readonly topic: WorkerJobTopic;
  /** Reject malformed descriptors before any effects; do not trust publication claims. */
  readonly validate: (event: ClaimedOutboxEvent) => boolean;
  /**
   * Reload current canonical inputs/permissions and deduplicate effects by eventId.
   * Commit effects before returning. No exactly-once execution is promised.
   * Concrete handlers must impose their own bounded operation deadlines.
   */
  readonly handle: (event: ClaimedOutboxEvent) => Promise<void>;
};

/** Immutable registration: absent handlers are never claimed or silently acknowledged. */
export class WorkerJobRegistry {
  private readonly handlers: ReadonlyMap<WorkerJobTopic, WorkerJobHandler>;
  readonly topics: readonly WorkerJobTopic[];

  constructor(handlers: readonly WorkerJobHandler[]) {
    const registered = new Map<WorkerJobTopic, WorkerJobHandler>();
    for (const handler of handlers) {
      if (
        !WORKER_JOB_TOPICS.includes(handler.topic) ||
        registered.has(handler.topic) ||
        typeof handler.validate !== "function" ||
        typeof handler.handle !== "function"
      )
        throw new Error("Invalid or duplicate worker job registration.");
      registered.set(handler.topic, Object.freeze({ ...handler }));
    }
    this.handlers = registered;
    this.topics = Object.freeze([...registered.keys()]);
  }

  get(topic: WorkerJobTopic): WorkerJobHandler | undefined {
    return this.handlers.get(topic);
  }
}
