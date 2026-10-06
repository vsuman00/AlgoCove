import type { PlanProposalPort, TutorModelConfiguration } from "@algocove/application";
import type { PlanSchedule } from "@algocove/domain";
import { canonicalJson } from "@algocove/retrieval";
import { ProviderFailure } from "./provider-gateway.ts";
export const ROADMAP_PROMPT_VERSION = "roadmap.prompt.v1";
export const ROADMAP_POLICY_VERSION = "roadmap.policy.v1";
/** No learner identity, goals, titles, links, code, history or free text. Indices
 * refer only to immutable server-owned baseline items for this request. */
export type RoadmapGenerationRequest = {
  operation: "roadmap-proposal";
  promptVersion: typeof ROADMAP_PROMPT_VERSION;
  policyVersion: typeof ROADMAP_POLICY_VERSION;
  modelConfigVersion: string;
  maximumCandidateCharacters: 12000;
  horizonMonths: number;
  startDay: string;
  endDay: string;
  dailyCapacityMinutes: number;
  studyWeekdays: readonly number[];
  excludedDays: string[];
  items: {
    index: number;
    kind: string;
    day: string;
    dueEnd: string;
    minutes: number;
    frozen: boolean;
    prerequisites: number[];
  }[];
};
export type RoadmapGenerationPort = {
  readonly transportReference?: string;
  configuration: TutorModelConfiguration;
  generate(input: RoadmapGenerationRequest, signal: AbortSignal): Promise<unknown>;
};
export type RoadmapProposalEvidence = {
  schemaVersion: 1;
  bundleVersion: string;
  modelVersion: string;
  provider: string;
  model: string;
  promptVersion: string;
  policyVersion: string;
  outcome: "validated" | "rejected";
  latencyMs: number;
  promptCharacters: number;
  candidateCharacters: number;
};
export function roadmapModelManifest(
  primary: RoadmapGenerationPort,
  fallback: RoadmapGenerationPort | null,
): string {
  const safe = (port: RoadmapGenerationPort) => {
    const c = port.configuration;
    return {
      version: c.version,
      provider: c.provider,
      model: c.model,
      kind: c.kind,
      approvalReference: c.approvalReference,
      region: c.region,
      dataPolicy: c.dataPolicy,
      allowPrivateCode: c.allowPrivateCode,
      transportReference: port.transportReference ?? "fixture-injected",
    };
  };
  return canonicalJson({
    primary: safe(primary),
    fallback: fallback ? safe(fallback) : null,
    promptVersion: ROADMAP_PROMPT_VERSION,
    policyVersion: ROADMAP_POLICY_VERSION,
  });
}
export function approvedRoadmapGenerationAdapter(
  configuration: TutorModelConfiguration & { kind: "approved" },
  transport: RoadmapGenerationPort["generate"],
  transportReference = "synthetic-injected",
): RoadmapGenerationPort {
  if (
    !configuration.approvalReference?.trim() ||
    !configuration.region.trim() ||
    !configuration.dataPolicy.trim() ||
    !configuration.provider.trim() ||
    !configuration.model.trim() ||
    configuration.allowPrivateCode
  )
    throw new ProviderFailure("invalid_request");
  const c = configuration;
  const safe = Object.freeze({
    version: c.version,
    provider: c.provider,
    model: c.model,
    kind: c.kind,
    approvalReference: c.approvalReference,
    region: c.region,
    dataPolicy: c.dataPolicy,
    allowPrivateCode: false,
  });
  return {
    transportReference,
    configuration: safe,
    async generate(input, signal) {
      if (signal.aborted) throw new ProviderFailure("timeout");
      try {
        return await transport(structuredClone(input), signal);
      } catch {
        throw new ProviderFailure(signal.aborted ? "timeout" : "unavailable");
      }
    },
  };
}
function request(schedule: PlanSchedule, modelVersion: string): RoadmapGenerationRequest {
  const indices = new Map(schedule.items.map((item, i) => [item.key, i]));
  const r: RoadmapGenerationRequest = {
    operation: "roadmap-proposal",
    promptVersion: ROADMAP_PROMPT_VERSION,
    policyVersion: ROADMAP_POLICY_VERSION,
    modelConfigVersion: modelVersion,
    maximumCandidateCharacters: 12000,
    horizonMonths: schedule.preferences.horizonMonths,
    startDay: schedule.preferences.startDay,
    endDay: schedule.preferences.endDay,
    dailyCapacityMinutes: schedule.preferences.dailyCapacityMinutes,
    studyWeekdays: [...schedule.preferences.studyWeekdays],
    excludedDays: [...schedule.excludedDays],
    items: schedule.items.map((item, index) => ({
      index,
      kind: item.kind,
      day: item.day,
      dueEnd: item.dueEnd,
      minutes: item.minutes,
      frozen: item.frozen,
      prerequisites: item.prerequisites.flatMap((key) =>
        indices.has(key) ? [indices.get(key)!] : [],
      ),
    })),
  };
  if (r.items.length > 200 || JSON.stringify(r).length > 16000)
    throw new ProviderFailure("budget_exceeded");
  return r;
}
function reconstruct(raw: unknown, schedule: PlanSchedule): { items: PlanSchedule["items"] } {
  if (typeof raw === "string") {
    if (raw.length > 12000) throw Error("malformed");
    raw = JSON.parse(raw);
  }
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    Object.keys(raw).join() !== "items" ||
    JSON.stringify(raw).length > 12000
  )
    throw Error("malformed");
  const rows = (raw as { items: unknown }).items;
  if (!Array.isArray(rows) || rows.length !== schedule.items.length) throw Error("membership");
  const seen = new Set<number>();
  const items = rows.map((row) => {
    if (
      !row ||
      typeof row !== "object" ||
      Array.isArray(row) ||
      Object.keys(row).sort().join() !== "day,index" ||
      !Number.isSafeInteger(row.index) ||
      row.index < 0 ||
      row.index >= schedule.items.length ||
      seen.has(row.index) ||
      typeof row.day !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(row.day)
    )
      throw Error("malformed");
    seen.add(row.index);
    const original = schedule.items[row.index]!;
    if (original.frozen && row.day !== original.day) throw Error("frozen");
    return {
      ...structuredClone(original),
      day: row.day,
      // Non-review baseline dueEnd may be a display copy of its scheduled day.
      // Real catalog deadlines remain authoritative in validateRoadmap.
      ...(original.kind !== "review" && !original.frozen && original.dueEnd === original.day
        ? { dueEnd: row.day }
        : {}),
    };
  });
  return { items };
}
export function createRoadmapProposalAdapter(input: {
  bundleVersion: string;
  primary: RoadmapGenerationPort;
  fallback: RoadmapGenerationPort | null;
  authorize: (schedule: PlanSchedule) => Promise<boolean>;
  validate: (candidate: { items: PlanSchedule["items"] }, schedule: PlanSchedule) => boolean;
  record: (evidence: RoadmapProposalEvidence) => Promise<void>;
  attemptTimeoutMs?: number;
}): PlanProposalPort {
  return {
    lineage: `gateway_validated:${input.bundleVersion}`,
    async propose({ schedule, signal }) {
      if (signal.aborted || !(await input.authorize(schedule)))
        throw new ProviderFailure("invalid_request");
      for (const port of [input.primary, input.fallback].filter(
        (p): p is RoadmapGenerationPort => p !== null,
      )) {
        if (signal.aborted) throw new ProviderFailure("timeout");
        const r = request(schedule, port.configuration.version),
          started = performance.now(),
          controller = new AbortController();
        const abort = () => controller.abort();
        signal.addEventListener("abort", abort, { once: true });
        let timer: ReturnType<typeof setTimeout> | undefined,
          candidateCharacters = 0;
        try {
          if (signal.aborted) controller.abort();
          const raw = await Promise.race([
            Promise.resolve().then(() => {
              if (controller.signal.aborted) throw Error("cancelled");
              return port.generate(r, controller.signal);
            }),
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () => {
                  controller.abort();
                  reject(Error("timeout"));
                },
                Math.min(600, Math.max(1, input.attemptTimeoutMs ?? 600)),
              );
              controller.signal.addEventListener("abort", () => reject(Error("cancelled")), {
                once: true,
              });
              if (controller.signal.aborted) reject(Error("cancelled"));
            }),
          ]);
          candidateCharacters = Math.min(
            (typeof raw === "string" ? raw : JSON.stringify(raw))?.length ?? 0,
            12000,
          );
          const candidate = reconstruct(raw, schedule);
          if (
            !input.validate(candidate, schedule) ||
            !(await input.authorize(schedule)) ||
            signal.aborted
          )
            throw Error("invalid");
          await input.record({
            schemaVersion: 1,
            bundleVersion: input.bundleVersion,
            modelVersion: port.configuration.version,
            provider: port.configuration.provider,
            model: port.configuration.model,
            promptVersion: ROADMAP_PROMPT_VERSION,
            policyVersion: ROADMAP_POLICY_VERSION,
            outcome: "validated",
            latencyMs: performance.now() - started,
            promptCharacters: JSON.stringify(r).length,
            candidateCharacters,
          });
          return candidate;
        } catch {
          if (signal.aborted) throw new ProviderFailure("timeout");
          // Failure evidence is bounded metadata only. A recording outage closes this optional path.
          await input.record({
            schemaVersion: 1,
            bundleVersion: input.bundleVersion,
            modelVersion: port.configuration.version,
            provider: port.configuration.provider,
            model: port.configuration.model,
            promptVersion: ROADMAP_PROMPT_VERSION,
            policyVersion: ROADMAP_POLICY_VERSION,
            outcome: "rejected",
            latencyMs: performance.now() - started,
            promptCharacters: JSON.stringify(r).length,
            candidateCharacters,
          });
        } finally {
          if (timer) clearTimeout(timer);
          signal.removeEventListener("abort", abort);
          controller.abort();
        }
      }
      throw new ProviderFailure("unavailable");
    },
  };
}
