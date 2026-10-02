import { PROBLEM_LANGUAGES, type ProblemLanguage } from "./language-manifest.ts";
import { isId, type OpaqueId, type LearnerId, type Instant } from "./primitives.ts";
import { localStudyDay, validStudyDay } from "./consistency.ts";
export const ROADMAP_HORIZONS = [1, 2, 3, 4, 6] as const;
export type RoadmapHorizon = (typeof ROADMAP_HORIZONS)[number];
export type RoadmapPreferences = {
  readonly goal: string;
  readonly targetRole: string;
  readonly horizonMonths: RoadmapHorizon;
  readonly startDay: string;
  readonly endDay: string;
  readonly timezone: string;
  readonly dailyCapacityMinutes: number;
  readonly bufferPercent?: number;
  readonly studyWeekdays: readonly number[];
  readonly preferredLanguages: readonly ProblemLanguage[];
  readonly collectionIds: readonly OpaqueId<"collection">[];
};
export type RoadmapIntentVersion = {
  readonly planId: OpaqueId<"roadmapPlan">;
  readonly learnerId: LearnerId;
  readonly version: number;
  readonly preferences: RoadmapPreferences;
  readonly savedAt: Instant;
};
export function addCalendarMonths(startDay: string, months: RoadmapHorizon): string {
  if (!validStudyDay(startDay) || !ROADMAP_HORIZONS.includes(months))
    throw Error("Invalid calendar horizon.");
  const [year, month, day] = startDay.split("-").map(Number) as [number, number, number];
  const absolute = year * 12 + month - 1 + months;
  const endYear = Math.floor(absolute / 12),
    endMonth = absolute % 12;
  if (endYear > 9999) throw Error("Calendar horizon exceeds the supported date range.");
  const last = new Date(0);
  last.setUTCFullYear(endYear, endMonth + 1, 0);
  const clamped = Math.min(day, last.getUTCDate());
  return `${String(endYear).padStart(4, "0")}-${String(endMonth + 1).padStart(2, "0")}-${String(clamped).padStart(2, "0")}`;
}
/** Normalize only declared learner preferences; this does not generate or validate a schedule. */
export function parseRoadmapPreferences(
  input: unknown,
  now: Instant,
  options: { allowPastStart?: boolean } = {},
): RoadmapPreferences {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    throw Error("Planning preferences must be an object.");
  const value = input as Record<string, unknown>;
  if (
    typeof value.goal !== "string" ||
    value.goal.trim().length < 1 ||
    value.goal.length > 500 ||
    typeof value.targetRole !== "string" ||
    value.targetRole.trim().length < 1 ||
    value.targetRole.length > 120
  )
    throw Error("A bounded goal and target role are required.");
  if (!ROADMAP_HORIZONS.includes(value.horizonMonths as RoadmapHorizon))
    throw Error("Choose a 1, 2, 3, 4, or 6 month horizon.");
  if (typeof value.timezone !== "string" || value.timezone.length > 128)
    throw Error("A valid IANA timezone is required.");
  let today: string;
  try {
    today = localStudyDay(now, value.timezone);
  } catch {
    throw Error("A valid IANA timezone is required.");
  }
  if (
    typeof value.startDay !== "string" ||
    !validStudyDay(value.startDay) ||
    (!options.allowPastStart && value.startDay < today)
  )
    throw Error("Start day must be a valid prospective date in the selected timezone.");
  const horizonMonths = value.horizonMonths as RoadmapHorizon,
    endDay = addCalendarMonths(value.startDay, horizonMonths);
  if (value.targetDay !== undefined && value.targetDay !== null && value.targetDay !== endDay)
    throw Error("Target date conflicts with the chosen calendar-month horizon.");
  if (
    !Number.isInteger(value.dailyCapacityMinutes) ||
    Number(value.dailyCapacityMinutes) < 15 ||
    Number(value.dailyCapacityMinutes) > 480
  )
    throw Error("Daily capacity must be 15 to 480 minutes.");
  if (
    !Array.isArray(value.studyWeekdays) ||
    value.studyWeekdays.length < 1 ||
    value.studyWeekdays.length > 7 ||
    value.studyWeekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7) ||
    new Set(value.studyWeekdays).size !== value.studyWeekdays.length
  )
    throw Error("Choose distinct study weekdays from Monday (1) to Sunday (7).");
  if (
    !Array.isArray(value.preferredLanguages) ||
    value.preferredLanguages.length < 1 ||
    value.preferredLanguages.length > 6 ||
    value.preferredLanguages.some(
      (language) => !PROBLEM_LANGUAGES.includes(language as ProblemLanguage),
    ) ||
    new Set(value.preferredLanguages).size !== value.preferredLanguages.length
  )
    throw Error("Choose distinct supported implementation languages.");
  if (
    !Array.isArray(value.collectionIds) ||
    value.collectionIds.length > 16 ||
    value.collectionIds.some((id) => !isId("collection", id)) ||
    new Set(value.collectionIds).size !== value.collectionIds.length
  )
    throw Error("Choose at most sixteen distinct collection identifiers.");
  if (
    value.bufferPercent !== undefined &&
    (!Number.isInteger(value.bufferPercent) ||
      Number(value.bufferPercent) < 5 ||
      Number(value.bufferPercent) > 40)
  )
    throw Error("Recovery buffer must reserve 5 to 40 percent of capacity.");
  return {
    ...(value.bufferPercent === undefined ? {} : { bufferPercent: Number(value.bufferPercent) }),
    goal: value.goal.trim(),
    targetRole: value.targetRole.trim(),
    horizonMonths,
    startDay: value.startDay,
    endDay,
    timezone: value.timezone,
    dailyCapacityMinutes: Number(value.dailyCapacityMinutes),
    studyWeekdays: [...value.studyWeekdays].sort((a, b) => a - b) as number[],
    preferredLanguages: [...value.preferredLanguages] as ProblemLanguage[],
    collectionIds: [...value.collectionIds].sort() as OpaqueId<"collection">[],
  };
}
