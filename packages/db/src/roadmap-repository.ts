import type { Pool } from "pg";
import {
  localStudyDay,
  validateRoadmap,
  type LearnerId,
  type Instant,
  type PlanSchedule,
  type PlanItem,
  type RoadmapIntentVersion,
} from "@algocove/domain";
import {
  conflictError,
  notFoundError,
  validationError,
  type RoadmapRepository,
  type RoadmapView,
  type PlanningSource,
  type PlanState,
  type PlanCandidate,
  type PlanJournalEvent,
} from "@algocove/application";
import { withTransaction, type Transaction } from "./transaction.ts";
import {
  lockStudyOwner,
  parsedId,
  sourceInstant,
  sourceDigest,
} from "./learning-source-repository.ts";
import { loadPlanningCatalog } from "./planning-catalog.ts";
async function currentState(tx: Transaction, owner: LearnerId): Promise<PlanState | null> {
  const r = await tx.query<{
    version_id: string;
    token: string;
    status: PlanState["status"];
    schedule: PlanSchedule;
  }>(
    "SELECT s.*,v.schedule FROM planning.plan_state s JOIN planning.accepted_version v USING(version_id,learner_id) WHERE s.learner_id=$1",
    [owner],
  );
  const row = r.rows[0];
  return row
    ? { versionId: row.version_id, token: row.token, status: row.status, schedule: row.schedule }
    : null;
}
async function journal(tx: Transaction, owner: LearnerId): Promise<PlanJournalEvent[]> {
  const rows = await tx.query<{
    event_id: string;
    version_id: string;
    kind: string;
    occurrence_id: string | null;
    reverses_id: string | null;
    local_day: string;
    timezone: string;
    occurred_at: Date;
  }>(
    "SELECT *,to_char(local_day,'YYYY-MM-DD') AS local_day FROM planning.plan_journal WHERE learner_id=$1 ORDER BY occurred_at,event_id",
    [owner],
  );
  return rows.rows.map((r) => ({
    eventId: r.event_id,
    versionId: r.version_id,
    kind: r.kind,
    occurrenceId: r.occurrence_id,
    reversesId: r.reverses_id,
    localDay: r.local_day,
    timezone: r.timezone,
    occurredAt: sourceInstant(r.occurred_at),
  }));
}
export function effectivePlanOutcomes(events: PlanJournalEvent[]): PlanJournalEvent[] {
  const reversed = new Set(events.filter((e) => e.kind === "reversed").map((e) => e.reversesId));
  return events.filter((e) => ["done", "missed"].includes(e.kind) && !reversed.has(e.eventId));
}
async function source(tx: Transaction, owner: LearnerId, now: Instant): Promise<PlanningSource> {
  const rows = await tx.query<{
    plan_id: string;
    learner_id: string;
    version: number;
    preferences: RoadmapIntentVersion["preferences"];
    saved_at: Date;
  }>(
    `SELECT v.* FROM planning.roadmap_intent i JOIN planning.roadmap_intent_version v ON v.plan_id=i.plan_id AND v.version=i.current_version AND v.learner_id=i.learner_id WHERE i.learner_id=$1 FOR SHARE OF i`,
    [owner],
  );
  const row = rows.rows[0];
  if (!row) throw notFoundError("Save planning preferences first.");
  const intent: RoadmapIntentVersion = {
    planId: parsedId("roadmapPlan", row.plan_id),
    learnerId: owner,
    version: row.version,
    preferences: row.preferences,
    savedAt: sourceInstant(row.saved_at),
  };
  const state = await currentState(tx, owner),
    today = localStudyDay(now, state?.schedule.preferences.timezone ?? intent.preferences.timezone),
    events = await journal(tx, owner),
    done = new Set(
      effectivePlanOutcomes(events)
        .filter((e) => e.kind === "done")
        .map((e) => e.occurrenceId),
    );
  // Occurrence IDs survive revisions; completed and past windows are pinned to their original dates/timezone.
  const fixed = (state?.schedule.items ?? [])
    .filter((i) => i.day < localStudyDay(now, i.timezone) || done.has(i.occurrenceId))
    .map((i) => ({ ...i, frozen: true }));
  const effective = effectivePlanOutcomes(events),
    missedDays = effective.filter((e) => e.kind === "missed").map((e) => e.localDay);
  const catalog = await loadPlanningCatalog(tx, owner, intent.preferences, now, true);
  for (const unit of [...catalog.units].filter((u) => u.kind === "internal_problem")) {
    const language = intent.preferences.preferredLanguages.find((l) => unit.languages.includes(l));
    const completed = fixed.find(
      (i) =>
        i.targetId === unit.targetId && i.kind === "internal_problem" && done.has(i.occurrenceId),
    );
    if (language && completed && completed.language !== language) {
      const key = `language:${language}:${unit.targetId}`;
      catalog.units.push({
        ...unit,
        key,
        title: `${language} practice: ${unit.title}`,
        reasonCodes: [...unit.reasonCodes, "language_changed_practice"],
      });
    }
  }
  // Recovery is a deliberate new occurrence, never a rewrite of the missed due window.
  for (const event of effective.filter((e) => e.kind === "missed")) {
    const historical = (
      await tx.query<{ body: PlanItem }>(
        "SELECT body FROM planning.plan_item WHERE version_id=$1 AND occurrence_id=$2 AND learner_id=$3",
        [event.versionId, event.occurrenceId, owner],
      )
    ).rows[0]?.body;
    if (!historical || historical.day >= today || !historical.required) continue;
    const original = catalog.units.find(
      (u) => u.kind === historical.kind && u.targetId === historical.targetId,
    );
    if (!original) continue;
    const key = `recovery:${event.eventId}`;
    if (effective.some((e) => e.kind === "done" && e.occurrenceId === key)) continue;
    catalog.units.push({
      ...original,
      key,
      title: `Recovery: ${original.title}`,
      reasonCodes: [...original.reasonCodes, "deliberate_missed_session_recovery"],
    });
  }
  return { intent, state, fixed, missedDays, catalog };
}
export async function readRoadmapView(
  tx: Transaction,
  owner: LearnerId,
  now: Instant,
): Promise<RoadmapView> {
  const candidates = await tx.query<{
    body: PlanCandidate;
    status: PlanCandidate["status"];
    expires_at: Date;
  }>(
    "SELECT body,status,expires_at FROM planning.plan_candidate WHERE learner_id=$1 ORDER BY created_at DESC,candidate_id DESC LIMIT 20",
    [owner],
  );
  const history = await tx.query<{ version_id: string; schedule: PlanSchedule; accepted_at: Date }>(
    "SELECT * FROM planning.accepted_version WHERE learner_id=$1 ORDER BY accepted_at,version_id",
    [owner],
  );
  const state = await currentState(tx, owner),
    intent = (
      await tx.query<{ current_version: number }>(
        "SELECT current_version FROM planning.roadmap_intent WHERE learner_id=$1",
        [owner],
      )
    ).rows[0];
  return {
    state,
    candidates: candidates.rows.map((r) => ({
      ...r.body,
      status:
        r.status === "valid" &&
        (r.expires_at.getTime() <= Date.parse(now) ||
          r.body.intentVersion !== intent?.current_version ||
          r.body.expectedToken !== (state?.token ?? null))
          ? "expired"
          : r.status,
    })),
    history: history.rows.map((r) => ({
      versionId: r.version_id,
      schedule: r.schedule,
      acceptedAt: sourceInstant(r.accepted_at),
    })),
    journal: await journal(tx, owner),
  };
}
async function receipt(
  tx: Transaction,
  owner: LearnerId,
  key: string,
  facts: unknown,
): Promise<unknown | null> {
  const r = await tx.query<{ digest: string; receipt: unknown }>(
    "SELECT digest,receipt FROM planning.plan_command WHERE learner_id=$1 AND command_key=$2",
    [owner, key],
  );
  if (!r.rows[0]) return null;
  if (r.rows[0].digest !== sourceDigest(facts))
    throw conflictError("This command key already has different planning facts.");
  return r.rows[0].receipt;
}
async function saveReceipt(
  tx: Transaction,
  owner: LearnerId,
  key: string,
  facts: unknown,
  body: unknown,
): Promise<void> {
  await tx.query(
    "INSERT INTO planning.plan_command(learner_id,command_key,digest,receipt) VALUES($1,$2,$3,$4::jsonb)",
    [owner, key, sourceDigest(facts), JSON.stringify(body)],
  );
}
export class PostgresRoadmapRepository implements RoadmapRepository {
  private readonly pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }
  view(owner: LearnerId, now: Instant): Promise<RoadmapView> {
    return withTransaction(this.pool, (tx) => readRoadmapView(tx, owner, now), {
      isolationLevel: "repeatable read",
      readOnly: true,
    });
  }
  source(owner: LearnerId, now: Instant): Promise<PlanningSource> {
    return withTransaction(this.pool, (tx) => source(tx, owner, now), {
      isolationLevel: "repeatable read",
    });
  }
  receipt(owner: LearnerId, key: string, facts: unknown): Promise<unknown | null> {
    return withTransaction(this.pool, (tx) => receipt(tx, owner, key, facts), { readOnly: true });
  }
  saveCandidate(input: Parameters<RoadmapRepository["saveCandidate"]>[0]): Promise<PlanCandidate> {
    return withTransaction(this.pool, async (tx) => {
      await lockStudyOwner(tx, input.learnerId);
      const replay = await receipt(tx, input.learnerId, input.idempotencyKey, input.facts);
      if (replay) return replay as PlanCandidate;
      const fresh = await source(tx, input.learnerId, input.now);
      if (
        fresh.intent.version !== input.source.intent.version ||
        (fresh.state?.token ?? null) !== input.candidate.expectedToken
      )
        throw conflictError("Preferences or active plan changed. Build a fresh preview.");
      if (input.candidate.schedule) {
        if (
          sourceDigest(input.candidate.schedule.preferences) !==
            sourceDigest(fresh.intent.preferences) ||
          sourceDigest(input.candidate.schedule.excludedDays) !==
            sourceDigest([...new Set(fresh.missedDays)].sort())
        )
          throw validationError("Preview preferences or missed-day facts changed.");
        const errors = validateRoadmap(input.candidate.schedule, fresh.catalog, {
          today: localStudyDay(input.now, fresh.intent.preferences.timezone),
          fixed: fresh.fixed,
        });
        if (errors.length) throw validationError(errors[0]!.message, { reason: errors[0]!.code });
      }
      await tx.query(
        "INSERT INTO planning.plan_candidate(candidate_id,plan_id,learner_id,intent_version,expected_token,status,body,created_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)",
        [
          input.candidateId,
          fresh.intent.planId,
          input.learnerId,
          fresh.intent.version,
          input.candidate.expectedToken,
          input.candidate.status,
          JSON.stringify(input.candidate),
          input.now,
          input.candidate.expiresAt,
        ],
      );
      await saveReceipt(tx, input.learnerId, input.idempotencyKey, input.facts, input.candidate);
      return input.candidate;
    });
  }
  command(input: Parameters<RoadmapRepository["command"]>[0]): Promise<RoadmapView> {
    return withTransaction(this.pool, async (tx) => {
      const owner = input.learnerId,
        c = input.command;
      await lockStudyOwner(tx, owner);
      const replay = await receipt(tx, owner, c.idempotencyKey, c);
      if (replay) return replay as RoadmapView;
      const state = await currentState(tx, owner);
      if ((state?.token ?? null) !== c.expectedToken)
        throw conflictError("Active plan changed. Reload before applying this command.");
      let versionId = state?.versionId,
        schedule = state?.schedule,
        kind: string =
          c.action === "reverse"
            ? "reversed"
            : c.action === "complete"
              ? "completed"
              : c.action === "archive"
                ? "archived"
                : c.action === "pause"
                  ? "paused"
                  : c.action === "resume"
                    ? "resumed"
                    : c.action;
      if (c.action === "accept") {
        const row = (
          await tx.query<{
            body: PlanCandidate;
            status: string;
            plan_id: string;
            expires_at: Date;
          }>(
            "SELECT * FROM planning.plan_candidate WHERE candidate_id=$1 AND learner_id=$2 FOR UPDATE",
            [c.candidateId ?? null, owner],
          )
        ).rows[0];
        if (!row) throw notFoundError("Candidate is unavailable.");
        if (
          row.status !== "valid" ||
          row.expires_at.getTime() <= Date.parse(input.now) ||
          !row.body.schedule
        )
          throw validationError("Only a current valid preview can be accepted.");
        const fresh = await source(tx, owner, input.now);
        if (
          row.body.expectedToken !== c.expectedToken ||
          row.body.intentVersion !== fresh.intent.version
        )
          throw conflictError(
            "Preview is stale. Rebuild using current preferences and active version.",
          );
        if (
          sourceDigest(row.body.schedule.preferences) !== sourceDigest(fresh.intent.preferences) ||
          sourceDigest(row.body.schedule.excludedDays) !==
            sourceDigest([...new Set(fresh.missedDays)].sort())
        )
          throw conflictError("Preview preferences or missed-day facts changed.");
        const errors = validateRoadmap(row.body.schedule, fresh.catalog, {
          today: localStudyDay(input.now, fresh.intent.preferences.timezone),
          fixed: fresh.fixed,
        });
        if (errors.length) throw validationError(errors[0]!.message, { reason: errors[0]!.code });
        versionId = row.body.candidateId;
        schedule = row.body.schedule;
        kind = "accepted";
        await tx.query(
          "INSERT INTO planning.accepted_version(version_id,learner_id,plan_id,schedule,accepted_at) VALUES($1,$2,$3,$4::jsonb,$5)",
          [versionId, owner, row.plan_id, JSON.stringify(schedule), input.now],
        );
        for (const item of schedule.items)
          await tx.query(
            "INSERT INTO planning.plan_item(version_id,learner_id,occurrence_id,kind,lesson_id,problem_id,reference_id,reference_version,review_id,body) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)",
            [
              versionId,
              owner,
              item.occurrenceId,
              item.kind,
              item.kind === "lesson" ? item.targetId : null,
              item.kind === "internal_problem" ? item.targetId : null,
              item.kind === "external_practice" ? item.targetId : null,
              item.kind === "external_practice" ? item.targetVersion : null,
              item.kind === "review" ? item.targetId : null,
              JSON.stringify(item),
            ],
          );
        await tx.query(
          "UPDATE planning.plan_candidate SET status='accepted' WHERE candidate_id=$1",
          [versionId],
        );
        if (state)
          await tx.query(
            "INSERT INTO planning.plan_journal(event_id,learner_id,version_id,kind,local_day,timezone,occurred_at) VALUES($1,$2,$3,'superseded',$4,$5,$6)",
            [
              `${input.eventId}:superseded`,
              owner,
              state.versionId,
              localStudyDay(input.now, state.schedule.preferences.timezone),
              state.schedule.preferences.timezone,
              input.now,
            ],
          );
        await tx.query(
          "INSERT INTO planning.plan_state(learner_id,version_id,token,status) VALUES($1,$2,$3,'active') ON CONFLICT(learner_id) DO UPDATE SET version_id=$2,token=$3,status='active'",
          [owner, versionId, input.eventId],
        );
      } else {
        if (!state || !schedule) throw notFoundError("No accepted plan is available.");
        const events = await journal(tx, owner),
          effective = effectivePlanOutcomes(events),
          today = localStudyDay(input.now, schedule.preferences.timezone);
        const transitions: Record<string, string> = {
          pause: "paused",
          resume: "active",
          complete: "completed",
          archive: "archived",
        };
        if (
          (c.action === "pause" && state.status !== "active") ||
          (c.action === "resume" && state.status !== "paused") ||
          (["done", "missed", "complete"].includes(c.action) &&
            !["active", "paused"].includes(state.status)) ||
          (c.action === "archive" && state.status === "archived")
        )
          throw validationError("This command is not allowed in the current plan state.");
        if (
          c.action === "complete" &&
          schedule.items.some(
            (i) =>
              i.required &&
              !effective.some((e) => e.occurrenceId === i.occurrenceId && e.kind === "done") &&
              i.day >= today,
          )
        )
          throw validationError("Required future work remains. Complete it or review a replan.");
        if (["done", "missed", "reverse"].includes(c.action)) {
          const item = schedule.items.find((i) => i.occurrenceId === c.occurrenceId);
          if (!item || item.kind === "buffer")
            throw notFoundError("Scheduled learning activity is unavailable.");
          if (state.status === "paused" && c.action === "missed")
            throw validationError("Paused obligations cannot be recorded as missed.");
          if (c.action === "missed" && item.day > today)
            throw validationError("Future work cannot be marked missed.");
          if (c.action === "reverse") {
            const original = effective.find(
              (e) => e.eventId === c.reversesId && e.occurrenceId === c.occurrenceId,
            );
            if (!original)
              throw validationError("Only an owned unreversed outcome can be corrected.");
            versionId = original.versionId;
          } else if (effective.some((e) => e.occurrenceId === c.occurrenceId))
            throw conflictError("This activity already has an outcome. Append a correction first.");
        }
        await tx.query("UPDATE planning.plan_state SET status=$2,token=$3 WHERE learner_id=$1", [
          owner,
          transitions[c.action] ?? state.status,
          input.eventId,
        ]);
      }
      if (!versionId || !schedule) throw Error("Missing accepted schedule");
      await tx.query(
        "INSERT INTO planning.plan_journal(event_id,learner_id,version_id,kind,occurrence_id,reverses_id,local_day,timezone,occurred_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          input.eventId,
          owner,
          versionId,
          kind,
          ["done", "missed", "reversed"].includes(kind) ? c.occurrenceId : null,
          kind === "reversed" ? c.reversesId : null,
          localStudyDay(input.now, schedule.preferences.timezone),
          schedule.preferences.timezone,
          input.now,
        ],
      );
      await tx.query(
        "INSERT INTO platform.outbox_event(event_id,topic,aggregate_id,payload,occurred_at) VALUES($1,'planning.plan.changed',$2,$3::jsonb,$4)",
        [input.eventId, owner, JSON.stringify({ versionId, kind, policyVersion: 1 }), input.now],
      );
      const result = await readRoadmapView(tx, owner, input.now);
      await saveReceipt(tx, owner, c.idempotencyKey, c, result);
      return result;
    });
  }
}
