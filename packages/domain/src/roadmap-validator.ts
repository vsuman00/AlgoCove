import { validStudyDay } from "./consistency.ts";
import { addCalendarMonths } from "./roadmap.ts";
import {
  ROADMAP_POLICY,
  studyDays,
  type PlanFailure,
  type PlanSchedule,
  type PlanningCatalog,
  type PlanItem,
} from "./roadmap-scheduler.ts";
export function validateRoadmap(
  schedule: PlanSchedule,
  catalog: PlanningCatalog,
  input: { today: string; fixed?: PlanItem[] },
): PlanFailure[] {
  const errors: PlanFailure[] = [];
  const fail = (code: string, message: string) =>
    errors.push({
      code,
      message,
      alternatives: ["Rebuild a deterministic preview from the current preferences."],
    });
  const p = schedule.preferences,
    units = new Map(catalog.units.map((u) => [u.key, u])),
    seen = new Set<string>(),
    targets = new Set<string>(),
    totals = new Map<string, number>();
  const fixed = new Map((input.fixed ?? []).map((i) => [i.occurrenceId, { ...i, frozen: true }]));
  if (
    schedule.policyVersion !== ROADMAP_POLICY.version ||
    schedule.curriculumVersionId !== catalog.curriculumVersionId
  )
    fail("snapshot_changed", "Planning policy or curriculum changed.");
  if (p.endDay !== addCalendarMonths(p.startDay, p.horizonMonths))
    fail("horizon_changed", "The resolved target conflicts with the selected horizon.");
  if (schedule.scope === "full_dsa" && !catalog.fullCoverage)
    fail("insufficient_coverage", "The reviewed curriculum cannot support full DSA.");
  if (JSON.stringify(schedule.collections) !== JSON.stringify(catalog.collections))
    fail("collection_snapshot_changed", "Collection coverage changed; rebuild before publication.");
  if (
    JSON.stringify(schedule.beyondEndReviews) !==
    JSON.stringify(catalog.units.filter((u) => u.kind === "review" && u.dueStart! > p.endDay))
  )
    fail(
      "beyond_end_review_missing",
      "Review obligations beyond the deadline must remain visible.",
    );
  if (schedule.coverage !== catalog.coverage)
    fail("coverage_changed", "Coverage must use the reviewed catalog.");
  for (const item of schedule.items) {
    if (seen.has(item.occurrenceId))
      fail("duplicate_occurrence", "Activity occurrences must be unique.");
    seen.add(item.occurrenceId);
    if (fixed.has(item.occurrenceId)) {
      if (item.day >= input.today) totals.set(item.day, (totals.get(item.day) ?? 0) + item.minutes);
      if (JSON.stringify(item) !== JSON.stringify(fixed.get(item.occurrenceId)))
        fail("history_changed", "Past or completed activities must remain fixed.");
      continue;
    }
    if (item.timezone !== p.timezone)
      fail("timezone_changed", "Future activities must use the selected timezone.");
    if (schedule.excludedDays.includes(item.day) && item.kind !== "buffer")
      fail("missed_day", "Missed sessions require moving future work, not catch-up overload.");
    if (item.frozen)
      fail("untrusted_history", "A proposal cannot invent completed or historical work.");
    if (
      !validStudyDay(item.day) ||
      !validStudyDay(item.dueEnd) ||
      item.day < input.today ||
      item.day < p.startDay ||
      item.day > p.endDay ||
      item.dueEnd < item.day ||
      !studyDays(p).includes(item.day)
    )
      fail("invalid_date", "Future work must respect study days and the horizon.");
    if (
      !Number.isSafeInteger(item.minutes) ||
      item.minutes < 1 ||
      item.minutes > p.dailyCapacityMinutes
    )
      fail("indivisible_session", "An activity must fit its declared session.");
    totals.set(item.day, (totals.get(item.day) ?? 0) + item.minutes);
    if (item.kind === "buffer") {
      if (
        item.title !== "Recovery buffer" ||
        item.href !== "/plan" ||
        item.key !== `buffer:${item.day}:${p.timezone}` ||
        item.occurrenceId !== item.key ||
        JSON.stringify(item.reasonCodes) !== JSON.stringify(["reserved_recovery_capacity"])
      )
        fail(
          "unapproved_buffer",
          "Recovery buffers use authored labels and have no external links.",
        );
      if (item.targetId !== null || item.required || item.prerequisites.length)
        fail("invalid_target", "Buffers have no content target or prerequisites.");
      continue;
    }
    const unit = units.get(item.key);
    if (
      !unit ||
      unit.kind !== item.kind ||
      unit.targetId !== item.targetId ||
      unit.targetVersion !== item.targetVersion
    ) {
      fail("unapproved_target", "Only catalog-approved targets and versions can be scheduled.");
      continue;
    }
    if (item.occurrenceId !== item.key)
      fail("occurrence_changed", "Reviewed occurrences cannot be renamed by a proposal.");
    if (
      JSON.stringify(item.reasonCodes) !==
      JSON.stringify([...unit.reasonCodes, "prerequisites_satisfied", "capacity_reserved"])
    )
      fail("reason_changed", "Use bounded reviewed explanations.");
    if (targets.has(item.key))
      fail("duplicate_work", "Overlapping collection memberships must not duplicate work.");
    targets.add(item.key);
    if (!unit.available) fail("content_unavailable", "Content is unavailable.");
    if (!unit.rightsValid) fail("rights_unavailable", "Content rights are unavailable.");
    if (!unit.linkHealthy) fail("link_unavailable", "External links must be reviewed and healthy.");
    if (unit.languages.length && !p.preferredLanguages.some((l) => unit.languages.includes(l)))
      fail("language_unavailable", "No selected implementation language is available.");
    const language =
      unit.kind === "internal_problem"
        ? p.preferredLanguages.find((l) => unit.languages.includes(l))
        : undefined;
    const href = language
      ? `${unit.href}${unit.href.includes("?") ? "&" : "?"}language=${language}`
      : unit.href;
    if (item.language !== language)
      fail(
        "language_changed",
        "Activities must pin the selected supported implementation language.",
      );
    if (
      item.minutes !== unit.minutes ||
      item.required !== unit.required ||
      JSON.stringify(item.prerequisites) !== JSON.stringify(unit.prerequisites) ||
      item.title !== unit.title ||
      item.href !== href
    )
      fail(
        "unit_changed",
        "Proposals cannot rewrite reviewed estimates, targets or prerequisites.",
      );
    if (
      item.day < (unit.dueStart ?? p.startDay) ||
      item.day > (unit.dueEnd ?? p.endDay) ||
      (unit.kind === "review" && item.dueEnd !== unit.dueEnd)
    )
      fail("review_window", "Review spacing and due windows must be preserved.");
    for (const key of unit.prerequisites)
      if (
        !catalog.masteredKeys.includes(key) &&
        !schedule.items.some(
          (i, index) =>
            i.key === key &&
            (i.day < item.day || (i.day === item.day && index < schedule.items.indexOf(item))),
        )
      )
        fail("prerequisite_order", "A required prerequisite must be completed or scheduled first.");
  }
  for (const id of fixed.keys())
    if (!seen.has(id))
      fail("history_removed", "A proposal cannot remove past or completed activities.");
  for (const total of totals.values())
    if (total > p.dailyCapacityMinutes)
      fail("capacity_exceeded", "Daily workload exceeds capacity.");
  for (const unit of catalog.units)
    if (
      unit.required &&
      !catalog.masteredKeys.includes(unit.key) &&
      !(unit.kind === "review" && unit.dueStart! > p.endDay) &&
      !schedule.items.some((i) => i.key === unit.key)
    )
      fail("required_missing", "A required reviewed unit is missing.");
  const futureDays = studyDays(p, input.today).filter(
      (day) => !schedule.excludedDays.includes(day),
    ),
    frozenMinutes = (input.fixed ?? [])
      .filter((i) => futureDays.includes(i.day))
      .reduce((n, i) => n + i.minutes, 0);
  const bufferNeeded = Math.ceil(
    (Math.max(0, futureDays.length * p.dailyCapacityMinutes - frozenMinutes) *
      (p.bufferPercent ?? ROADMAP_POLICY.bufferPercent)) /
      100,
  );
  const bufferMinutes = schedule.items
    .filter((i) => i.kind === "buffer" && !i.frozen)
    .reduce((n, i) => n + i.minutes, 0);
  if (bufferMinutes < bufferNeeded)
    fail("buffer_missing", "Reserve recovery capacity before optional work.");
  return errors;
}
