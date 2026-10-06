import type {
  AllowedTutorAction,
  TutorInput,
  TutorModelConfiguration,
} from "@algocove/application";
import type { EvidencePackage } from "@algocove/retrieval";
import { PROMPT_VERSION } from "./validation.ts";
export type GenerationRequest = {
  intent: TutorInput["intent"];
  query: string;
  maximumTier: 1;
  maximumCandidateCharacters: 12000;
  policyVersion: string;
  promptVersion: string;
  retrievalConfigVersion: string;
  modelConfigVersion: string;
  evidence: {
    id: string;
    contentId: string;
    contentVersion: string;
    title: string;
    text: string;
  }[];
  privateCode?: string;
};
export type GenerationPort = {
  configuration: TutorModelConfiguration;
  generate(request: GenerationRequest, signal: AbortSignal): Promise<unknown>;
};
export function generationRequest(
  input: TutorInput,
  action: AllowedTutorAction,
  evidence: EvidencePackage,
  port: GenerationPort,
  code: string | null,
): GenerationRequest {
  if (
    port.configuration.kind === "approved" &&
    (!port.configuration.approvalReference ||
      !port.configuration.region ||
      !port.configuration.dataPolicy)
  )
    throw Error("unapproved");
  if (code && (!action.shareCode || !port.configuration.allowPrivateCode)) throw Error("privacy");
  const request: GenerationRequest = {
    intent: input.intent,
    query: input.query,
    maximumTier: 1,
    maximumCandidateCharacters: 12000,
    policyVersion: action.policyVersion,
    promptVersion: PROMPT_VERSION,
    retrievalConfigVersion: evidence.configuration.version,
    modelConfigVersion: port.configuration.version,
    evidence: evidence.selected
      .filter((e) => e.candidate.hintTier <= 1)
      .map((e) => ({
        id: e.evidenceItemId,
        contentId: e.candidate.problemId,
        contentVersion: e.candidate.contentVersionId,
        title: e.candidate.title,
        text: e.candidate.text,
      })),
    ...(code ? { privateCode: code } : {}),
  };
  if (!request.evidence.length || JSON.stringify(request).length > 16000)
    throw Error("context_budget");
  return request;
}
export async function boundedGeneration(
  port: GenerationPort,
  request: GenerationRequest,
  signal: AbortSignal,
  timeoutMs = 4000,
): Promise<unknown> {
  if (signal.aborted) throw new ProviderFailure("timeout");
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) controller.abort();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      port.generate(request, controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => {
            controller.abort();
            reject(Error("timeout"));
          },
          Math.min(4000, Math.max(1, timeoutMs)),
        );
        controller.signal.addEventListener("abort", () => reject(Error("cancelled")), {
          once: true,
        });
        if (controller.signal.aborted) reject(Error("cancelled"));
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    signal.removeEventListener("abort", abort);
    controller.abort();
  }
}
export const fixtureGenerationPort: GenerationPort = {
  configuration: {
    version: "generation.fixture.v1",
    provider: "fixture",
    model: "clarification.v1",
    kind: "fixture",
    approvalReference: null,
    region: "local",
    dataPolicy: "local-fixture-only",
    allowPrivateCode: true,
  },
  async generate(r, signal) {
    if (signal.aborted) throw Error("cancelled");
    const e = r.evidence[0]!;
    return {
      intent: r.intent,
      hintTier: 1,
      message:
        "Restate the known inputs and the quantity you need to compare before choosing a next step.",
      citations: [
        {
          contentId: e.contentId,
          contentVersion: e.contentVersion,
          evidenceItemId: e.id,
          title: e.title,
        },
      ],
      confidence: "medium",
      unsupported: false,
      policyVersion: r.policyVersion,
      retrievalConfigVersion: r.retrievalConfigVersion,
      promptVersion: r.promptVersion,
      modelConfigVersion: r.modelConfigVersion,
    };
  },
};
export type ProviderFailureCategory =
  | "timeout"
  | "rate_limited"
  | "unavailable"
  | "invalid_request"
  | "safety_refusal"
  | "malformed_output"
  | "budget_exceeded";
export class ProviderFailure extends Error {
  readonly category: ProviderFailureCategory;
  constructor(category: ProviderFailureCategory) {
    super("Generation is unavailable.");
    this.category = category;
  }
}
/** Vendor SDK/network code stays in a server-owned transport. No tools/callback
 * into application commands are exposed to it. Activation still needs Task45. */
export function approvedGenerationAdapter(
  configuration: GenerationPort["configuration"] & {
    kind: "approved";
    provider: string;
    model: string;
    approvalReference: string;
  },
  transport: (request: GenerationRequest, signal: AbortSignal) => Promise<unknown>,
): GenerationPort {
  if (
    !configuration.approvalReference.trim() ||
    !configuration.region.trim() ||
    !configuration.dataPolicy.trim() ||
    !configuration.provider.trim() ||
    !configuration.model.trim()
  )
    throw new ProviderFailure("invalid_request");
  const frozen = Object.freeze({ ...configuration });
  return {
    configuration: frozen,
    async generate(request, signal) {
      if (signal.aborted) throw new ProviderFailure("timeout");
      try {
        return await transport(structuredClone(request), signal);
      } catch (error) {
        if (error instanceof ProviderFailure) throw error;
        throw new ProviderFailure(signal.aborted ? "timeout" : "unavailable");
      }
    },
  };
}
