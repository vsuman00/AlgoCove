import { createHash } from "node:crypto";
import type { Pool } from "pg";
import {
  PostgresBudgetRepository,
  PostgresEvaluationRepository,
  PostgresRoadmapGenerationRepository,
} from "@algocove/db";
import type {
  RequestContext,
  RoadmapRepository,
  PlanProposalPort,
  PlanningBudgetPort,
} from "@algocove/application";
import { localStudyDay, validateRoadmap } from "@algocove/domain";
import {
  approvedRoadmapGenerationAdapter,
  createRoadmapProposalAdapter,
  roadmapModelManifest,
  ROADMAP_POLICY_VERSION,
  ROADMAP_PROMPT_VERSION,
  type RoadmapGenerationPort,
  type EvaluationConfiguration,
} from "@algocove/tutor";
import { getPracticeRuntime } from "../practice/runtime";
import { createHttpRoadmapTransport } from "./proposal-gateway";
export function roadmapBundleIdentity(
  primary: RoadmapGenerationPort,
  fallback: RoadmapGenerationPort | null,
): string {
  return (
    "sha256:" + createHash("sha256").update(roadmapModelManifest(primary, fallback)).digest("hex")
  );
}
/** Ports are server-owned. Fixture channel is available only to explicit test composition. */
export async function createRoadmapOptional(input: {
  pool: Pool;
  context: RequestContext;
  repository: RoadmapRepository;
  primary: RoadmapGenerationPort;
  fallback: RoadmapGenerationPort | null;
  channel?: "fixture" | "production";
}): Promise<{ provider: PlanProposalPort; budget: PlanningBudgetPort } | undefined> {
  const evaluations = new PostgresEvaluationRepository(input.pool),
    channel = input.channel ?? "production",
    bundle = roadmapBundleIdentity(input.primary, input.fallback);
  const matches = (c: EvaluationConfiguration, curriculumVersion: string | null) =>
    c.generationVersion === bundle &&
    c.promptVersion === ROADMAP_PROMPT_VERSION &&
    c.policyVersion === ROADMAP_POLICY_VERSION &&
    c.retrievalVersion === "roadmap.catalog.v1" &&
    c.indexVersion === "roadmap.catalog.v1" &&
    c.corpusVersion === (curriculumVersion ?? "synthetic.catalog.v1") &&
    (channel === "fixture" ||
      (!c.fixture &&
        input.primary.configuration.kind === "approved" &&
        input.primary.transportReference?.startsWith("https-route:sha256:") === true &&
        (!input.fallback ||
          (input.fallback.configuration.kind === "approved" &&
            input.fallback.transportReference?.startsWith("https-route:sha256:") === true))));
  const source = await input.repository.source(input.context.actor.userId, input.context.now);
  const active = await evaluations.promotedConfiguration(channel);
  if (!active || !matches(active, source.catalog.curriculumVersionId)) return undefined;
  const evidence = new PostgresRoadmapGenerationRepository(input.pool);
  const provider = createRoadmapProposalAdapter({
    bundleVersion: active.version,
    primary: input.primary,
    fallback: input.fallback,
    authorize: async (schedule) => {
      const current = await evaluations.promotedConfiguration(channel);
      return current?.version === active.version && matches(current, schedule.curriculumVersionId);
    },
    validate: (candidate, schedule) =>
      !validateRoadmap({ ...schedule, items: candidate.items }, source.catalog, {
        today: localStudyDay(input.context.now, schedule.preferences.timezone),
        fixed: source.fixed,
      }).length,
    record: (metadata) => evidence.record(input.context, metadata),
  });
  return { provider, budget: new PostgresBudgetRepository(input.pool) };
}
/** No test-provider selector, default credentials, or browser-supplied model metadata. */
export async function getRoadmapOptional(
  context: RequestContext,
  repository: RoadmapRepository,
): Promise<{ provider: PlanProposalPort; budget: PlanningBudgetPort } | undefined> {
  if (process.env.ROADMAP_PROPOSAL_ENABLED !== "true") return undefined;
  const runtime = getPracticeRuntime();
  if (!runtime) return undefined;
  try {
    const raw = JSON.parse(process.env.ROADMAP_MODEL_CONFIGURATION_JSON ?? "null");
    if (!raw || Object.keys(raw).sort().join() !== "fallback,primary") return undefined;
    const routeIdentity = (url: string) =>
      "https-route:sha256:" + createHash("sha256").update(new URL(url).toString()).digest("hex");
    const primary = approvedRoadmapGenerationAdapter(
      raw.primary,
      createHttpRoadmapTransport({
        url: process.env.ROADMAP_PRIMARY_GATEWAY_URL ?? "",
        token: process.env.ROADMAP_PRIMARY_GATEWAY_TOKEN ?? "",
      }),
      routeIdentity(process.env.ROADMAP_PRIMARY_GATEWAY_URL ?? ""),
    );
    const fallback =
      raw.fallback === null
        ? null
        : approvedRoadmapGenerationAdapter(
            raw.fallback,
            createHttpRoadmapTransport({
              url: process.env.ROADMAP_FALLBACK_GATEWAY_URL ?? "",
              token: process.env.ROADMAP_FALLBACK_GATEWAY_TOKEN ?? "",
            }),
            routeIdentity(process.env.ROADMAP_FALLBACK_GATEWAY_URL ?? ""),
          );
    return await createRoadmapOptional({
      pool: runtime.pool,
      context,
      repository,
      primary,
      fallback,
    });
  } catch {
    return undefined;
  }
}
