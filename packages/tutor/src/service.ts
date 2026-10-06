import type { RequestContext, TutorRepository, TutorView } from "@algocove/application";
import type { EvidencePackage } from "@algocove/retrieval";
import { boundedGeneration, generationRequest, type GenerationPort } from "./provider-gateway.ts";
import { validateTutorResponse } from "./validation.ts";
export type TutorRetrievalPort = {
  retrieve(
    ctx: RequestContext,
    input: { attemptId: string; query: string; intent: string; idempotencyKey: string },
  ): Promise<EvidencePackage>;
  read(ctx: RequestContext, id: string): Promise<EvidencePackage>;
};
export class TutorService {
  private readonly repository: TutorRepository;
  private readonly retrieval: TutorRetrievalPort | null;
  private readonly provider: GenerationPort | null;
  private readonly timeoutMs: number;
  constructor(
    repository: TutorRepository,
    retrieval: TutorRetrievalPort | null,
    provider: GenerationPort | null,
    timeoutMs = 4000,
  ) {
    this.repository = repository;
    this.retrieval = retrieval;
    this.provider = provider;
    this.timeoutMs = timeoutMs;
  }
  async complete(
    ctx: RequestContext,
    id: string,
    signal: AbortSignal = new AbortController().signal,
  ): Promise<TutorView> {
    const work = await this.repository.claim(ctx, id);
    if (!work) return this.repository.read(ctx, id);
    if (work.input.intent === "hint" && work.action.requestedTier > 1)
      return this.repository.finish(ctx, work, null, null, "authored_only");
    if (!this.provider || !this.retrieval)
      return this.repository.finish(ctx, work, null, null, "unavailable");
    let evidence: EvidencePackage | null = null;
    try {
      evidence = await this.retrieval.retrieve(ctx, {
        attemptId: work.action.attemptId,
        query: work.input.query,
        intent: work.input.intent,
        idempotencyKey: work.requestId,
      });
      if (evidence.lowConfidence) throw Error("insufficient_evidence");
      const status = await this.repository.read(ctx, id);
      if (status.status !== "running") return status;
      if (signal.aborted) return this.repository.cancel(ctx, id);
      const code = work.action.shareCode ? await this.repository.code(ctx, work) : null;
      if (work.action.shareCode && code === null) throw Error("privacy");
      const candidate = await boundedGeneration(
        this.provider,
        generationRequest(work.input, work.action, evidence, this.provider, code),
        signal,
        this.timeoutMs,
      );
      const response = validateTutorResponse(
        candidate,
        work.action,
        work.input,
        evidence,
        this.provider.configuration.version,
      );
      await this.retrieval.read(ctx, evidence.packageId);
      if (signal.aborted) return this.repository.cancel(ctx, id);
      return await this.repository.finish(
        ctx,
        work,
        response,
        evidence.packageId,
        null,
        this.provider.configuration,
      );
    } catch {
      if (signal.aborted) return this.repository.cancel(ctx, id);
      return this.repository.finish(ctx, work, null, null, "unavailable_or_rejected");
    }
  }
}
