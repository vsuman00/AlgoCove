import { readRoadmapView, effectivePlanOutcomes } from "./roadmap-repository.ts";
import { loadPlanningCatalog } from "./planning-catalog.ts";
import type { Pool } from "pg";
import {
  createOutboxEvent,
  notFoundError,
  conflictError,
  validationError,
  type LearningProgressRepository,
  type ProgressSnapshot,
  type LearnerHomeSource,
} from "@algocove/application";
import {
  localStudyDay,
  validStudyDay,
  reviewTiming,
  projectPlanAdherence,
  type MasteryProjection,
  type StudyActivity,
  type ProblemLanguage,
} from "@algocove/domain";
import { withTransaction } from "./transaction.ts";
import { lockStudyOwner, parsedId, sourceInstant } from "./learning-source-repository.ts";
export class PostgresProgressRepository implements LearningProgressRepository {
  private readonly pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }
  async getProgress(
    input: Parameters<LearningProgressRepository["getProgress"]>[0],
  ): Promise<ProgressSnapshot> {
    return withTransaction(
      this.pool,
      async (tx) => {
        const profile = await tx.query<{ timezone: string }>(
          "SELECT timezone FROM platform.learner_profile WHERE learner_id=$1",
          [input.learnerId],
        );
        const timezone = profile.rows[0]?.timezone ?? "UTC";
        const projections = await tx.query<{
          title: string;
          body: MasteryProjection;
          count: number;
        }>(
          `SELECT c.title,p.body,(SELECT count(*)::integer FROM mastery.evidence e WHERE e.learner_id=p.learner_id AND e.concept_id=p.concept_id) AS count FROM mastery.projection p JOIN learning.concept c USING(concept_id) WHERE p.learner_id=$1 AND p.policy_version=1 ORDER BY c.title`,
          [input.learnerId],
        );
        const pending = await tx.query<{ concept_id: string }>(
          `SELECT DISTINCT m.concept_id FROM (SELECT observation_id,problem_version_id FROM practice.assessment_observation WHERE learner_id=$1 UNION ALL SELECT observation_id,problem_version_id FROM practice.learning_observation WHERE learner_id=$1) s JOIN learning.problem_concept m USING(problem_version_id) WHERE NOT EXISTS(SELECT 1 FROM mastery.evidence e WHERE e.learner_id=$1 AND e.concept_id=m.concept_id AND e.observation_id=s.observation_id)`,
          [input.learnerId],
        );
        const activities = await tx.query<{
          observation_id: string;
          occurred_at: Date;
          local_day: string;
          timezone: string;
          kind: StudyActivity["kind"];
        }>(
          "SELECT observation_id,occurred_at,to_char(local_day,'YYYY-MM-DD') AS local_day,timezone,kind FROM practice.study_activity WHERE learner_id=$1 ORDER BY occurred_at,observation_id",
          [input.learnerId],
        );
        const pauses = await tx.query<{ start_day: string; end_day: string; timezone: string }>(
          "SELECT to_char(start_day,'YYYY-MM-DD') AS start_day,to_char(end_day,'YYYY-MM-DD') AS end_day,timezone FROM practice.study_pause WHERE learner_id=$1 ORDER BY start_day",
          [input.learnerId],
        );
        const sessions = await tx.query<{ count: number }>(
          "SELECT count(*)::integer AS count FROM practice.learning_session WHERE learner_id=$1 AND status='completed'",
          [input.learnerId],
        );
        const external = await tx.query<{ kind: string }>(
          "SELECT DISTINCT ON(reference_id) kind FROM practice.external_practice_event WHERE learner_id=$1 AND kind IN ('completed','corrected') ORDER BY reference_id,occurred_at DESC,event_id DESC",
          [input.learnerId],
        );
        const requests = await tx.query<{ count: number }>(
          "SELECT count(*)::integer AS count FROM practice.external_practice_event WHERE learner_id=$1 AND kind='handoff_requested'",
          [input.learnerId],
        );
        const references = await tx.query<{
          external_reference_id: string;
          title: string;
          canonical_url: string;
        }>(
          "SELECT external_reference_id,title,canonical_url FROM content.external_reference r WHERE EXISTS(SELECT 1 FROM practice.external_practice_event e WHERE e.reference_id=r.external_reference_id AND e.learner_id=$1 AND e.kind='handoff_requested' AND e.attempt_id IS NOT NULL) ORDER BY title",
          [input.learnerId],
        );
        const reviews = await tx.query<{ status: string; due_start: Date; due_end: Date }>(
          "SELECT status,due_start,due_end FROM mastery.review_item WHERE learner_id=$1 AND status<>'superseded'",
          [input.learnerId],
        );
        const calibration = await tx.query<{
          facts: {
            confidence: "low" | "medium" | "high";
            correct: boolean;
            observedAt: ProgressSnapshot["asOf"];
          };
        }>(
          "SELECT DISTINCT ON(observation_id) facts FROM mastery.evidence WHERE learner_id=$1 AND facts->>'confidenceProvenance'='learner_reported' ORDER BY observation_id,observed_at DESC",
          [input.learnerId],
        );
        const health = { due: 0, overdue: 0, deferred: 0, completed: 0, pending: 0 };
        for (const r of reviews.rows) {
          if (r.status === "completed") {
            health.completed++;
            continue;
          }
          if (r.status === "awaiting_projection") {
            health.pending++;
            continue;
          }
          if (r.status === "deferred") health.deferred++;
          const timing = reviewTiming(
            {
              dueStart: sourceInstant(r.due_start),
              dueEnd: sourceInstant(r.due_end),
              status: r.status as "due" | "deferred",
            },
            input.now,
          );
          if (timing === "due") health.due++;
          if (timing === "overdue") health.overdue++;
        }
        return {
          asOf: input.now,
          policyVersion: 1,
          timezone,
          pendingConcepts: pending.rows.map((p) => parsedId("concept", p.concept_id)),
          mastery: projections.rows.map((r) => ({
            title: r.title,
            projection: r.body,
            status:
              r.count === r.body.evidenceCount &&
              !pending.rows.some((p) => p.concept_id === r.body.conceptId)
                ? "ready"
                : "projection_pending",
          })),
          calibration: calibration.rows.map(({ facts }) => ({
            confidence: facts.confidence,
            correct: facts.correct,
            observedAt: facts.observedAt,
            provenance: "learner_reported",
          })),
          activities: activities.rows.map((a) => ({
            observationId: a.observation_id,
            occurredAt: sourceInstant(a.occurred_at),
            localDay: a.local_day,
            timezone: a.timezone,
            kind: a.kind,
          })),
          pauses: pauses.rows.map((p) => ({
            startDay: p.start_day,
            endDay: p.end_day,
            timezone: p.timezone,
          })),
          completedSessions: sessions.rows[0]!.count,
          externalPractice: {
            provenance: "learner_reported",
            requested: requests.rows[0]!.count,
            completed: external.rows.filter((e) => e.kind === "completed").length,
            references: references.rows.map((r) => ({
              referenceId: parsedId("externalReference", r.external_reference_id),
              title: r.title,
              url: r.canonical_url,
            })),
          },
          planAdherence: projectPlanAdherence(
            await readRoadmapView(tx, input.learnerId, input.now),
            input.now,
          ),
          reviewHealth: health,
        };
      },
      { isolationLevel: "repeatable read", readOnly: true },
    );
  }
  async getHome(
    input: Parameters<LearningProgressRepository["getHome"]>[0],
  ): Promise<LearnerHomeSource> {
    return withTransaction(
      this.pool,
      async (tx) => {
        const profile = await tx.query<{ goal: string; preferred_languages: ProblemLanguage[] }>(
          "SELECT goal,preferred_languages FROM platform.learner_profile WHERE learner_id=$1",
          [input.learnerId],
        );
        const rows = await tx.query<{
          problem_version_id: string;
          concept_id: string;
          title: string;
          languages: ProblemLanguage[];
          body: MasteryProjection | null;
          prerequisites: string[];
          pending: boolean;
        }>(
          `SELECT p.problem_version_id,m.concept_id,v.title,ARRAY(SELECT l.language FROM content.problem_language_manifest l WHERE l.problem_version_id=p.problem_version_id AND l.status='published' ORDER BY l.language) AS languages,x.body,ARRAY(SELECT DISTINCT e.from_concept_id FROM learning.curriculum_edge e JOIN learning.curriculum_graph_version g USING(curriculum_version_id) WHERE e.to_concept_id=m.concept_id AND e.edge_kind='required' AND g.status='published') AS prerequisites,EXISTS(SELECT 1 FROM (SELECT observation_id,problem_version_id,learner_id FROM practice.assessment_observation UNION ALL SELECT observation_id,problem_version_id,learner_id FROM practice.learning_observation) a WHERE a.learner_id=$1 AND a.problem_version_id=p.problem_version_id AND NOT EXISTS(SELECT 1 FROM mastery.evidence e WHERE e.observation_id=a.observation_id AND e.concept_id=m.concept_id)) AS pending FROM content.problem_version p JOIN content.content_version v USING(content_version_id) JOIN learning.problem_concept m USING(problem_version_id) LEFT JOIN mastery.projection x ON x.concept_id=m.concept_id AND x.learner_id=$1 AND x.policy_version=1 WHERE v.status='published' AND v.payload_status='available' AND (v.rights_expires_at IS NULL OR v.rights_expires_at>$2) ORDER BY p.problem_version_id,m.concept_id`,
          [input.learnerId, input.now],
        );
        const verified = await tx.query<{ concept_id: string }>(
          `SELECT p.concept_id FROM mastery.projection p WHERE p.learner_id=$1 AND p.policy_version=1 AND p.body->>'band' IN ('independent_completion','independent_delayed_transfer') AND (p.body->>'evidenceCount')::integer=(SELECT count(*) FROM mastery.evidence e WHERE e.learner_id=$1 AND e.concept_id=p.concept_id) AND NOT EXISTS(SELECT 1 FROM (SELECT observation_id,problem_version_id,learner_id FROM practice.assessment_observation UNION ALL SELECT observation_id,problem_version_id,learner_id FROM practice.learning_observation) a JOIN learning.problem_concept m USING(problem_version_id) WHERE a.learner_id=$1 AND m.concept_id=p.concept_id AND NOT EXISTS(SELECT 1 FROM mastery.evidence e WHERE e.observation_id=a.observation_id AND e.concept_id=p.concept_id))`,
          [input.learnerId],
        );
        const due = await tx.query(
          "SELECT 1 FROM mastery.review_item r WHERE r.learner_id=$1 AND r.status IN ('due','deferred') AND r.due_start<=$2 AND EXISTS(SELECT 1 FROM content.review_exercise e WHERE e.concept_id=r.concept_id AND e.status='published' AND (e.rights_expires_at IS NULL OR e.rights_expires_at>$2)) LIMIT 1",
          [input.learnerId, input.now],
        );
        const roadmap = await readRoadmapView(tx, input.learnerId, input.now),
          state = roadmap.state;
        const outcomes = effectivePlanOutcomes(roadmap.journal);
        const catalog =
          state?.status === "active"
            ? await loadPlanningCatalog(tx, input.learnerId, state.schedule.preferences, input.now)
            : null;
        const planned =
          state?.status === "active"
            ? state.schedule.items.find(
                (item) =>
                  item.kind !== "buffer" &&
                  item.day <= localStudyDay(input.now, item.timezone) &&
                  !outcomes.some((e) => e.occurrenceId === item.occurrenceId) &&
                  catalog?.units.some(
                    (u) =>
                      (u.key === item.key ||
                        ((item.reasonCodes.includes("deliberate_missed_session_recovery") ||
                          item.reasonCodes.includes("language_changed_practice")) &&
                          u.targetId === item.targetId &&
                          u.kind === item.kind)) &&
                      u.available &&
                      u.rightsValid &&
                      u.linkHealthy &&
                      (u.languages.length === 0 ||
                        state.schedule.preferences.preferredLanguages.some((l) =>
                          u.languages.includes(l),
                        )) &&
                      u.prerequisites.every(
                        (key) =>
                          outcomes.some((e) => e.kind === "done" && e.occurrenceId === key) ||
                          catalog.masteredKeys.includes(key),
                      ),
                  ),
              )
            : undefined;
        return {
          hasAcceptedPlan: state !== null,
          ...(planned
            ? {
                plannedAction: {
                  kind: "planned" as const,
                  href: planned.href,
                  title: `Scheduled: ${planned.title}`,
                  reasonCodes: ["active_accepted_plan", ...planned.reasonCodes],
                  reasons: [
                    `Scheduled for ${planned.day} in ${planned.timezone}; estimated ${planned.minutes} minutes.`,
                  ],
                },
              }
            : {}),
          verifiedConcepts: verified.rows.map((r) => parsedId("concept", r.concept_id)),
          goal: profile.rows[0]?.goal ?? null,
          preferredLanguages: profile.rows[0]?.preferred_languages ?? [],
          dueReview: due.rowCount !== 0,
          candidates: rows.rows.map((r) => ({
            problemVersionId: parsedId("problemVersion", r.problem_version_id),
            conceptId: parsedId("concept", r.concept_id),
            title: r.title,
            href: "/learn/arrays-two-pointer",
            languages: r.languages,
            available: r.problem_version_id === "prb_dddddddddddddddd",
            prerequisites: r.prerequisites.map((id) => parsedId("concept", id)),
            band: r.pending ? "projection_pending" : (r.body?.band ?? "unassessed"),
            lastPracticed: r.body?.lastPracticed ?? null,
          })),
        };
      },
      { isolationLevel: "repeatable read", readOnly: true },
    );
  }
  async pauseStudy(input: Parameters<LearningProgressRepository["pauseStudy"]>[0]): Promise<void> {
    await withTransaction(this.pool, async (tx) => {
      await lockStudyOwner(tx, input.learnerId);
      const profile = await tx.query<{ timezone: string }>(
        "SELECT timezone FROM platform.learner_profile WHERE learner_id=$1",
        [input.learnerId],
      );
      const timezone = profile.rows[0]?.timezone ?? "UTC";
      if (input.timezone !== timezone)
        throw conflictError("Profile timezone changed. Refresh before scheduling a pause.");
      const today = localStudyDay(input.now, timezone);
      if (
        !validStudyDay(input.startDay) ||
        !validStudyDay(input.endDay) ||
        input.startDay < today ||
        input.endDay < input.startDay ||
        Date.parse(input.endDay) - Date.parse(input.startDay) >= 365 * 86400000
      )
        throw validationError("Pause dates must be prospective and at most 365 days.");
      const inserted = await tx.query(
        "INSERT INTO practice.study_pause(pause_id,learner_id,start_day,end_day,timezone,created_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
        [input.eventId, input.learnerId, input.startDay, input.endDay, timezone, input.now],
      );
      if (inserted.rowCount === 1)
        await tx.query(
          "INSERT INTO platform.outbox_event(event_id,topic,aggregate_id,payload,occurred_at) VALUES($1,'practice.study.paused',$2,$3::jsonb,$4)",
          [
            input.eventId,
            input.learnerId,
            JSON.stringify({
              startDay: input.startDay,
              endDay: input.endDay,
              timezone,
              policyVersion: 1,
            }),
            input.now,
          ],
        );
    });
  }
  async recordExternal(
    input: Parameters<LearningProgressRepository["recordExternal"]>[0],
  ): Promise<void> {
    await withTransaction(this.pool, async (tx) => {
      await lockStudyOwner(tx, input.learnerId);
      const existing = await tx.query<{ reference_id: string; kind: string }>(
        "SELECT reference_id,kind FROM practice.external_practice_event WHERE learner_id=$1 AND idempotency_key=$2",
        [input.learnerId, input.idempotencyKey],
      );
      if (existing.rows[0] !== undefined) {
        if (
          existing.rows[0].reference_id !== input.referenceId ||
          existing.rows[0].kind !== input.kind
        )
          throw conflictError("External journal key already has another intent.");
        return;
      }
      if (input.kind === "handoff_requested")
        throw validationError("Open external practice from the preparation gate.");
      const handoff = await tx.query(
        "SELECT 1 FROM practice.external_practice_event WHERE learner_id=$1 AND reference_id=$2 AND kind='handoff_requested' AND attempt_id IS NOT NULL LIMIT 1",
        [input.learnerId, input.referenceId],
      );
      if (!handoff.rowCount)
        throw validationError("Record a gated handoff before external completion.");
      if (input.kind === "corrected") {
        const latest = await tx.query<{ kind: string }>(
          "SELECT kind FROM practice.external_practice_event WHERE learner_id=$1 AND reference_id=$2 AND kind IN ('completed','corrected') ORDER BY occurred_at DESC,event_id DESC LIMIT 1",
          [input.learnerId, input.referenceId],
        );
        if (latest.rows[0]?.kind !== "completed")
          throw validationError("Only a completion can be corrected.");
      }
      const reference = await tx.query(
        "SELECT 1 FROM content.external_reference WHERE external_reference_id=$1 AND url_status='reviewed' FOR SHARE",
        [input.referenceId],
      );
      if (reference.rowCount === 0)
        throw notFoundError("Reviewed outbound reference is unavailable.");
      await tx.query(
        "INSERT INTO practice.external_practice_event(event_id,learner_id,reference_id,kind,idempotency_key,occurred_at) VALUES($1,$2,$3,$4,$5,$6)",
        [
          input.eventId,
          input.learnerId,
          input.referenceId,
          input.kind,
          input.idempotencyKey,
          input.now,
        ],
      );
      const event = createOutboxEvent({
        eventId: input.eventId,
        topic: "practice.external.reported",
        aggregateId: input.referenceId,
        occurredAt: input.now,
        payload: { learnerId: input.learnerId, kind: input.kind, provenance: "learner_reported" },
      });
      await tx.query(
        "INSERT INTO platform.outbox_event(event_id,topic,aggregate_id,payload,occurred_at) VALUES($1,$2,$3,$4::jsonb,$5)",
        [
          event.eventId,
          event.topic,
          event.aggregateId,
          JSON.stringify(event.payload),
          event.occurredAt,
        ],
      );
    });
  }
}
