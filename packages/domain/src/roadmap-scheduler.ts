import { localStudyDay, validStudyDay } from "./consistency.ts";
import type { RoadmapPreferences } from "./roadmap.ts";
import type { Instant, ProblemLanguage } from "./index.ts";
export const ROADMAP_POLICY = { version: 1, bufferPercent: 15, candidateHours: 24 } as const;
export type PlanKind = "lesson" | "internal_problem" | "external_practice" | "review" | "buffer";
export type PlanUnit = {
  key: string;
  kind: Exclude<PlanKind, "buffer">;
  targetId: string;
  targetVersion?: number;
  title: string;
  href: string;
  minutes: number;
  required: boolean;
  prerequisites: string[];
  languages: ProblemLanguage[];
  available: boolean;
  rightsValid: boolean;
  linkHealthy: boolean;
  dueStart?: string;
  dueEnd?: string;
  reasonCodes: string[];
};
export type PlanningCatalog = {
  curriculumVersionId: string | null;
  units: PlanUnit[];
  masteredKeys: string[];
  coverage: string;
  fullCoverage: boolean;
  collections: {
    id: string;
    title?: string;
    total: number;
    supported: number;
    externalOnly: number;
    unavailable: number;
  }[];
};
export type PlanItem = {
  occurrenceId: string;
  key: string;
  kind: PlanKind;
  targetId: string | null;
  targetVersion?: number;
  language?: ProblemLanguage;
  title: string;
  href: string;
  day: string;
  dueEnd: string;
  minutes: number;
  required: boolean;
  prerequisites: string[];
  reasonCodes: string[];
  frozen: boolean;
  timezone: string;
};
export type PlanSchedule = {
  policyVersion: number;
  preferences: RoadmapPreferences;
  scope: "reviewed_pilot" | "full_dsa";
  curriculumVersionId: string | null;
  coverage: string;
  items: PlanItem[];
  collections: PlanningCatalog["collections"];
  beyondEndReviews: PlanUnit[];
  assumptions: string[];
  excludedDays: string[];
};
export type PlanFailure = { code: string; message: string; alternatives: string[] };
export type ScheduleResult =
  { ok: true; schedule: PlanSchedule } | { ok: false; failures: PlanFailure[] };
export function calendarDays(start: string, end: string): string[] {
  if (!validStudyDay(start) || !validStudyDay(end) || end < start) return [];
  const days: string[] = [];
  for (let time = Date.parse(start); time <= Date.parse(end); time += 86400000) {
    if (days.length > 190) throw Error("Calendar exceeds supported horizon.");
    days.push(new Date(time).toISOString().slice(0, 10));
  }
  return days;
}
export function studyDays(p: RoadmapPreferences, from = p.startDay): string[] {
  return calendarDays(from > p.startDay ? from : p.startDay, p.endDay).filter((day) =>
    p.studyWeekdays.includes(new Date(day).getUTCDay() || 7),
  );
}
const failure = (code: string, message: string): PlanFailure => ({
  code,
  message,
  alternatives: [
    "Choose the reviewed pilot scope.",
    "Increase study time or change study weekdays.",
    "Edit preferences and review a new preview.",
  ],
});
export function buildBaselinePlan(input: {
  preferences: RoadmapPreferences;
  catalog: PlanningCatalog;
  scope: PlanSchedule["scope"];
  today: string;
  fixed?: PlanItem[];
  missedDays?: string[];
}): ScheduleResult {
  const { preferences: p, catalog: c } = input;
  if (input.scope === "full_dsa" && !c.fullCoverage)
    return {
      ok: false,
      failures: [
        failure(
          "insufficient_coverage",
          "Reviewed content cannot support a comprehensive DSA course. The pilot scope is an explicit alternative.",
        ),
      ],
    };
  const fixed = input.fixed ?? [];
  const days = studyDays(p, input.today);
  const excludedDays = [...new Set(input.missedDays ?? [])].sort();
  const remaining = new Map(days.map((day) => [day, p.dailyCapacityMinutes]));
  for (const day of excludedDays) if (remaining.has(day)) remaining.set(day, 0);
  const items: PlanItem[] = fixed.map((i) => ({ ...i, frozen: true }));
  for (const item of fixed)
    if (remaining.has(item.day))
      remaining.set(item.day, Math.max(0, remaining.get(item.day)! - item.minutes));
  let buffer = Math.ceil(
    ([...remaining.values()].reduce((a, b) => a + b, 0) *
      (p.bufferPercent ?? ROADMAP_POLICY.bufferPercent)) /
      100,
  );
  // Reserve recovery sessions before required and optional work, without manufacturing content.
  for (const day of [...days].reverse()) {
    const minutes = Math.min(buffer, remaining.get(day)!);
    if (!minutes) continue;
    items.push({
      occurrenceId: `buffer:${day}:${p.timezone}`,
      key: `buffer:${day}:${p.timezone}`,
      kind: "buffer",
      targetId: null,
      title: "Recovery buffer",
      href: "/plan",
      day,
      dueEnd: day,
      minutes,
      required: false,
      prerequisites: [],
      reasonCodes: ["reserved_recovery_capacity"],
      frozen: false,
      timezone: p.timezone,
    });
    remaining.set(day, remaining.get(day)! - minutes);
    buffer -= minutes;
  }
  const scheduled = new Map(fixed.filter((i) => i.kind !== "buffer").map((i) => [i.key, i.day]));
  const mastered = new Set(c.masteredKeys);
  const unique = [...new Map(c.units.map((unit) => [unit.key, unit])).values()];
  const beyondEndReviews = unique.filter((u) => u.kind === "review" && u.dueStart! > p.endDay);
  const pending = unique
    .filter((u) => !scheduled.has(u.key) && !mastered.has(u.key) && !beyondEndReviews.includes(u))
    .sort(
      (a, b) =>
        Number(b.kind === "review") - Number(a.kind === "review") ||
        Number(b.required) - Number(a.required) ||
        (a.dueEnd ?? "").localeCompare(b.dueEnd ?? "") ||
        a.key.localeCompare(b.key),
    );
  const failures: PlanFailure[] = [];
  while (pending.length) {
    const index = pending.findIndex((u) =>
      u.prerequisites.every((key) => scheduled.has(key) || mastered.has(key)),
    );
    if (index < 0) {
      failures.push(
        failure("prerequisite_missing", "Required prerequisites are missing or cyclic."),
      );
      break;
    }
    const unit = pending.splice(index, 1)[0]!;
    if (
      !unit.available ||
      !unit.rightsValid ||
      !unit.linkHealthy ||
      (unit.languages.length > 0 && !p.preferredLanguages.some((l) => unit.languages.includes(l)))
    ) {
      if (unit.required)
        failures.push(
          failure(
            !unit.rightsValid
              ? "rights_unavailable"
              : !unit.linkHealthy
                ? "link_unavailable"
                : !unit.available
                  ? "content_unavailable"
                  : "language_unavailable",
            `${unit.title} is unavailable for this plan.`,
          ),
        );
      continue;
    }
    if (
      !Number.isSafeInteger(unit.minutes) ||
      unit.minutes < 1 ||
      unit.minutes > p.dailyCapacityMinutes
    ) {
      if (unit.required)
        failures.push(
          failure(
            "indivisible_session",
            `${unit.title} needs an uninterrupted ${unit.minutes}-minute session.`,
          ),
        );
      continue;
    }
    const day = days.find(
      (day) =>
        remaining.get(day)! >= unit.minutes &&
        day >= (unit.dueStart ?? p.startDay) &&
        day <= (unit.dueEnd ?? p.endDay) &&
        unit.prerequisites.every((key) => mastered.has(key) || scheduled.get(key)! <= day),
    );
    if (!day) {
      if (unit.required)
        failures.push(
          failure(
            unit.kind === "review" ? "review_window" : "capacity_exceeded",
            `${unit.title} cannot fit without exceeding capacity or its due window.`,
          ),
        );
      continue;
    }
    const language =
      unit.kind === "internal_problem"
        ? p.preferredLanguages.find((l) => unit.languages.includes(l))
        : undefined;
    items.push({
      occurrenceId: unit.key,
      key: unit.key,
      kind: unit.kind,
      targetId: unit.targetId,
      ...(unit.targetVersion === undefined ? {} : { targetVersion: unit.targetVersion }),
      title: unit.title,
      href: language
        ? `${unit.href}${unit.href.includes("?") ? "&" : "?"}language=${language}`
        : unit.href,
      ...(language === undefined ? {} : { language }),
      day,
      dueEnd: unit.dueEnd ?? day,
      minutes: unit.minutes,
      required: unit.required,
      prerequisites: [...unit.prerequisites],
      reasonCodes: [...unit.reasonCodes, "prerequisites_satisfied", "capacity_reserved"],
      frozen: false,
      timezone: p.timezone,
    });
    remaining.set(day, remaining.get(day)! - unit.minutes);
    scheduled.set(unit.key, day);
  }
  if (
    failures.length === 0 &&
    !items.some((i) => i.kind !== "buffer") &&
    c.masteredKeys.length === 0
  )
    failures.push(failure("insufficient_coverage", "No reviewed learning units are available."));
  if (failures.length) return { ok: false, failures };
  return {
    ok: true,
    schedule: {
      policyVersion: ROADMAP_POLICY.version,
      preferences: p,
      scope: input.scope,
      curriculumVersionId: c.curriculumVersionId,
      coverage: c.coverage,
      items: items.sort((a, b) => a.day.localeCompare(b.day)),
      collections: c.collections,
      beyondEndReviews,
      excludedDays,
      assumptions: [
        "Estimates include reading, reasoning, visualization and coding; actual time varies.",
        "Only reviewed supported content is scheduled. Empty days are not padded with repeated work.",
        `${p.bufferPercent ?? ROADMAP_POLICY.bufferPercent}% of remaining capacity is reserved for recovery.`,
        "Completion reports adherence separately from mastery and learner-reported external practice.",
      ],
    },
  };
}
export function planToday(now: Instant, preferences: RoadmapPreferences): string {
  return localStudyDay(now, preferences.timezone);
}
export type ReplanPreview = {
  moved: string[];
  removed: string[];
  added: string[];
  retained: string[];
  blocked: string[];
};
export function previewReplan(old: PlanSchedule | null, next: PlanSchedule): ReplanPreview {
  const before = new Map(old?.items.map((i) => [i.occurrenceId, i]) ?? []),
    after = new Map(next.items.map((i) => [i.occurrenceId, i]));
  return {
    moved: next.items
      .filter((i) => before.has(i.occurrenceId) && before.get(i.occurrenceId)!.day !== i.day)
      .map((i) => i.occurrenceId),
    removed: [...before.keys()].filter((k) => !after.has(k)),
    added: [...after.keys()].filter((k) => !before.has(k)),
    retained: next.items
      .filter((i) => before.has(i.occurrenceId) && before.get(i.occurrenceId)!.day === i.day)
      .map((i) => i.occurrenceId),
    blocked: [],
  };
}
