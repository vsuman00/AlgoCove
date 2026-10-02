import {
  buildBaselinePlan,
  validateRoadmap,
  previewReplan,
  planToday,
  type RoadmapIntentVersion,
  type PlanningCatalog,
  type PlanSchedule,
  type PlanItem,
  type PlanFailure,
  type ReplanPreview,
  type LearnerId,
  type Instant,
  type OpaqueId,
  type BudgetAdmission,
} from "@algocove/domain";
import { requireRole, type RequestContext } from "./request-context.ts";
import { validationError, conflictError } from "./errors.ts";
export type PlanState = {
  versionId: string;
  token: string;
  status: "active" | "paused" | "completed" | "archived";
  schedule: PlanSchedule;
};
export type PlanCandidate = {
  candidateId: string;
  status: "valid" | "invalid" | "failed" | "expired" | "accepted";
  intentVersion: number;
  expectedToken: string | null;
  schedule: PlanSchedule | null;
  failures: PlanFailure[];
  preview: ReplanPreview | null;
  lineage: string;
  createdAt: Instant;
  expiresAt: Instant;
};
export type PlanJournalEvent = {
  eventId: string;
  versionId: string;
  kind: string;
  occurrenceId: string | null;
  reversesId: string | null;
  localDay: string;
  timezone: string;
  occurredAt: Instant;
};
export type RoadmapView = {
  state: PlanState | null;
  candidates: PlanCandidate[];
  history: { versionId: string; schedule: PlanSchedule; acceptedAt: Instant }[];
  journal: PlanJournalEvent[];
};
export type PlanningSource = {
  intent: RoadmapIntentVersion;
  catalog: PlanningCatalog;
  state: PlanState | null;
  fixed: PlanItem[];
  missedDays: string[];
};
export type PlanCommand = {
  action: "accept" | "pause" | "resume" | "complete" | "archive" | "done" | "missed" | "reverse";
  candidateId?: string;
  occurrenceId?: string;
  reversesId?: string;
  expectedToken: string | null;
  idempotencyKey: string;
};
export type RoadmapRepository = {
  view(learnerId: LearnerId, now: Instant): Promise<RoadmapView>;
  source(learnerId: LearnerId, now: Instant): Promise<PlanningSource>;
  receipt(learnerId: LearnerId, key: string, digestFacts: unknown): Promise<unknown | null>;
  saveCandidate(input: {
    learnerId: LearnerId;
    now: Instant;
    candidateId: OpaqueId<"event">;
    idempotencyKey: string;
    facts: unknown;
    source: PlanningSource;
    candidate: PlanCandidate;
  }): Promise<PlanCandidate>;
  command(input: {
    learnerId: LearnerId;
    now: Instant;
    eventId: OpaqueId<"event">;
    command: PlanCommand;
  }): Promise<RoadmapView>;
};
export type PlanProposalPort = {
  propose(input: { schedule: PlanSchedule; signal: AbortSignal }): Promise<unknown>;
};
export type PlanningBudgetPort = {
  reserve(input: {
    learnerId: LearnerId;
    operation: "plan_proposal";
    key: string;
    digest: string;
    now: Instant;
  }): Promise<BudgetAdmission>;
  finish(input: {
    learnerId: LearnerId;
    operation: "plan_proposal";
    key: string;
    now: Instant;
    outcome: "success" | "failure";
  }): Promise<void>;
};
export function validPlanCommandKey(key: string): boolean {
  return /^[A-Za-z0-9._:-]{8,128}$/.test(key);
}
export async function getOwnedRoadmap(
  context: RequestContext,
  repository: RoadmapRepository,
): Promise<RoadmapView> {
  requireRole(context, "learner");
  return repository.view(context.actor.userId, context.now);
}
/** Optional fixture adapter only. The port cannot persist, activate, or alter learner evidence. */
export async function proposeValidatedPlan(input: {
  baseline: PlanSchedule;
  catalog: PlanningCatalog;
  fixed: PlanItem[];
  today: string;
  provider: PlanProposalPort;
  timeoutMs?: number;
}): Promise<{ schedule: PlanSchedule; lineage: string; success: boolean }> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const raw = await Promise.race([
      input.provider.propose({
        schedule: structuredClone(input.baseline),
        signal: controller.signal,
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(Error("timeout"));
        }, input.timeoutMs ?? 1500);
      }),
    ]);
    if (
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw) ||
      Object.keys(raw).some((k) => k !== "items") ||
      JSON.stringify(raw).length > 128000
    )
      throw Error("malformed");
    const items = (raw as { items: unknown }).items;
    if (!Array.isArray(items) || items.length > 1500) throw Error("malformed");
    const allowedKeys = [
      "occurrenceId",
      "key",
      "kind",
      "targetId",
      "targetVersion",
      "language",
      "title",
      "href",
      "day",
      "dueEnd",
      "minutes",
      "required",
      "prerequisites",
      "reasonCodes",
      "frozen",
      "timezone",
    ];
    if (
      items.some(
        (item) =>
          !item ||
          typeof item !== "object" ||
          Array.isArray(item) ||
          Object.keys(item).some((key) => !allowedKeys.includes(key)),
      )
    )
      throw Error("malformed");
    const schedule = { ...input.baseline, items: items as PlanItem[] };
    if (validateRoadmap(schedule, input.catalog, { today: input.today, fixed: input.fixed }).length)
      throw Error("invalid");
    return { schedule, lineage: "fixture_validated", success: true };
  } catch {
    return { schedule: input.baseline, lineage: "baseline_provider_fallback", success: false };
  } finally {
    if (timer) clearTimeout(timer);
    controller.abort();
  }
}
export async function buildOwnedRoadmap(
  context: RequestContext,
  repository: RoadmapRepository,
  input: {
    scope: PlanSchedule["scope"];
    expectedToken: string | null;
    idempotencyKey: string;
    useProposal?: boolean;
  },
  optional?: { provider: PlanProposalPort; budget: PlanningBudgetPort },
): Promise<PlanCandidate> {
  requireRole(context, "learner");
  if (
    !validPlanCommandKey(input.idempotencyKey) ||
    !["reviewed_pilot", "full_dsa"].includes(input.scope)
  )
    throw validationError("Choose a supported planning scope and command key.");
  const facts = {
    scope: input.scope,
    expectedToken: input.expectedToken,
    useProposal: input.useProposal === true,
  };
  const receipt = await repository.receipt(context.actor.userId, input.idempotencyKey, facts);
  if (receipt !== null) return receipt as PlanCandidate;
  const source = await repository.source(context.actor.userId, context.now);
  if ((source.state?.token ?? null) !== input.expectedToken)
    throw conflictError("Active plan changed. Reload before building a preview.");
  const today = planToday(context.now, source.intent.preferences),
    result = buildBaselinePlan({
      preferences: source.intent.preferences,
      catalog: source.catalog,
      scope: input.scope,
      today,
      fixed: source.fixed,
      missedDays: source.missedDays,
    });
  let schedule = result.ok ? result.schedule : null,
    lineage = "baseline_ai_off";
  if (schedule && input.useProposal && optional) {
    const reservation = {
      learnerId: context.actor.userId,
      operation: "plan_proposal" as const,
      key: input.idempotencyKey,
      digest: JSON.stringify(facts),
      now: context.now,
    };
    try {
      const admission = await optional.budget.reserve(reservation);
      if (!admission.allowed) lineage = `baseline_budget_${admission.reason}`;
      else if (admission.replayed) {
        lineage = "baseline_reconciled_reservation";
      } else {
        const proposal = await proposeValidatedPlan({
          baseline: schedule,
          catalog: source.catalog,
          fixed: source.fixed,
          today,
          provider: optional.provider,
        });
        schedule = proposal.schedule;
        lineage = proposal.lineage;
        await optional.budget.finish({
          ...reservation,
          outcome: proposal.success ? "success" : "failure",
        });
      }
    } catch {
      schedule = result.ok ? result.schedule : null;
      lineage = "baseline_budget_unavailable";
    }
  }
  const candidateId = context.ids.generate("event"),
    candidate: PlanCandidate = {
      candidateId,
      status: schedule ? "valid" : "invalid",
      intentVersion: source.intent.version,
      expectedToken: input.expectedToken,
      schedule,
      failures: result.ok ? [] : result.failures,
      preview: schedule
        ? previewReplan(source.state?.schedule ?? null, schedule)
        : {
            moved: [],
            removed: [],
            added: [],
            retained: source.fixed.map((i) => i.occurrenceId),
            blocked: result.ok ? [] : result.failures.map((f) => f.code),
          },
      lineage,
      createdAt: context.now,
      expiresAt: new Date(Date.parse(context.now) + 86400000).toISOString() as Instant,
    };
  return repository.saveCandidate({
    learnerId: context.actor.userId,
    now: context.now,
    candidateId,
    idempotencyKey: input.idempotencyKey,
    facts,
    source,
    candidate,
  });
}
export async function commandOwnedRoadmap(
  context: RequestContext,
  repository: RoadmapRepository,
  command: PlanCommand,
): Promise<RoadmapView> {
  requireRole(context, "learner");
  if (
    !validPlanCommandKey(command.idempotencyKey) ||
    !["accept", "pause", "resume", "complete", "archive", "done", "missed", "reverse"].includes(
      command.action,
    )
  )
    throw validationError("Invalid planning command.");
  return repository.command({
    learnerId: context.actor.userId,
    now: context.now,
    eventId: context.ids.generate("event"),
    command,
  });
}
