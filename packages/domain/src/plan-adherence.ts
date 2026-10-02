import { localStudyDay } from "./consistency.ts";
import type { Instant } from "./primitives.ts";
import type { PlanSchedule } from "./roadmap-scheduler.ts";
export type AdherenceSource = {
  state: { status: string } | null;
  history: { versionId: string; schedule: PlanSchedule }[];
  journal: {
    eventId: string;
    versionId: string;
    kind: string;
    occurrenceId: string | null;
    reversesId: string | null;
    localDay: string;
    occurredAt: Instant;
  }[];
};
/** Activity check-ins remain learner reported. No mastery or attempt side effects. */
export function projectPlanAdherence(
  source: AdherenceSource,
  now: Instant,
): {
  status: "no_accepted_plan" | "accepted_plan";
  completedOnTime: number | null;
  totalDue: number | null;
} {
  if (source.history.length === 0)
    return { status: "no_accepted_plan", completedOnTime: null, totalDue: null };
  const reversed = new Set(
    source.journal.filter((e) => e.kind === "reversed").map((e) => e.reversesId),
  );
  const done = source.journal.filter((e) => e.kind === "done" && !reversed.has(e.eventId)),
    counted = new Set<string>();
  let totalDue = 0,
    completedOnTime = 0;
  for (const version of source.history) {
    const events = source.journal.filter((e) => e.versionId === version.versionId),
      superseded = events.find((e) => e.kind === "superseded" || e.kind === "archived");
    for (const item of version.schedule.items) {
      if (
        item.kind === "buffer" ||
        counted.has(item.occurrenceId) ||
        item.day > localStudyDay(now, item.timezone)
      )
        continue;
      const outcome = done.find((e) => e.occurrenceId === item.occurrenceId);
      if (superseded && item.day >= superseded.localDay && !item.frozen && !outcome) continue;
      const pause = events.find(
        (e) =>
          e.kind === "paused" &&
          e.localDay <= item.day &&
          !events.some(
            (r) => r.kind === "resumed" && r.occurredAt > e.occurredAt && r.localDay <= item.day,
          ),
      );
      if (pause && !outcome) continue;
      counted.add(item.occurrenceId);
      totalDue++;
      if (outcome && outcome.localDay <= item.dueEnd) completedOnTime++;
    }
  }
  return { status: "accepted_plan", completedOnTime, totalDue };
}
