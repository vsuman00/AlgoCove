import type { Instant } from "./primitives.ts";

export const CONSISTENCY_POLICY_V1 = {
  version: 1,
  graceDays: 0,
  reviewOnlyCounts: true,
  restDays: "none",
} as const;
export type StudyActivity = {
  readonly observationId: string;
  readonly occurredAt: Instant;
  readonly localDay: string;
  readonly timezone: string;
  readonly kind: "assessment" | "explanation" | "review";
};
export type StudyPause = {
  readonly startDay: string;
  readonly endDay: string;
  readonly timezone: string;
};
export function localStudyDay(time: Instant, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(time));
  const value = (kind: string) => parts.find((p) => p.type === kind)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
export function validStudyDay(day: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(`${day}T00:00:00Z`)) &&
    new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day
  );
}
function shift(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}
export function projectConsistency(input: {
  readonly now: Instant;
  readonly timezone: string;
  readonly activities: readonly StudyActivity[];
  readonly pauses: readonly StudyPause[];
}): {
  readonly policyVersion: number;
  readonly asOf: Instant;
  readonly timezone: string;
  readonly activeDays: number;
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly graceDays: number;
} {
  const today = localStudyDay(input.now, input.timezone);
  const days = [
    ...new Set(
      input.activities
        .filter((a) => a.timezone === input.timezone && a.localDay <= today)
        .map((a) => a.localDay),
    ),
  ].sort();
  const active = new Set(days);
  const paused = (day: string) =>
    input.pauses.some((p) => p.timezone === input.timezone && day >= p.startDay && day <= p.endDay);
  let longestStreak = 0,
    run = 0,
    previous: string | undefined;
  for (const day of days) {
    let contiguous = previous !== undefined;
    if (previous !== undefined)
      for (let cursor = shift(previous, 1); cursor < day; cursor = shift(cursor, 1))
        if (!paused(cursor)) {
          contiguous = false;
          break;
        }
    run = contiguous ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    previous = day;
  }
  let cursor = today,
    currentStreak = 0;
  if (!active.has(cursor) && !paused(cursor)) cursor = shift(cursor, -1);
  const oldest = days[0] ?? today;
  while (cursor >= oldest) {
    if (active.has(cursor)) currentStreak++;
    else if (!paused(cursor)) break;
    cursor = shift(cursor, -1);
  }
  return {
    policyVersion: 1,
    asOf: input.now,
    timezone: input.timezone,
    activeDays: days.length,
    currentStreak,
    longestStreak,
    graceDays: 0,
  };
}
