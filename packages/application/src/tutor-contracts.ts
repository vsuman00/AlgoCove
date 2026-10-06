import type { RequestContext } from "./request-context.ts";
export type TutorInput = {
  attemptId: string;
  intent: "explain" | "hint" | "debug" | "compare" | "review";
  query: string;
  requestedTier: number;
  shareCode: boolean;
  idempotencyKey: string;
};
export type AllowedTutorAction = {
  learnerId: string;
  attemptId: string;
  problemVersionId: string;
  contentVersionId: string;
  mode: "learn" | "practice" | "rescue";
  attemptStatus: string;
  maximumTier: number;
  generatedTier: 1;
  requestedTier: number;
  shareCode: boolean;
  draftId?: string;
  codeRevision?: number;
  policyVersion: "tutor.policy.v1";
};
export type TutorResponse = {
  intent: TutorInput["intent"];
  hintTier: number;
  message: string;
  citations: { contentId: string; contentVersion: string; evidenceItemId: string; title: string }[];
  confidence: "high" | "medium" | "low";
  unsupported: boolean;
  policyVersion: string;
  retrievalConfigVersion: string;
  promptVersion: string;
  modelConfigVersion: string;
};
export type TutorView = {
  requestId: string;
  status: "pending" | "running" | "completed" | "fallback" | "cancelled";
  reason: string | null;
  response: TutorResponse | null;
};
export type TutorWork = {
  requestId: string;
  input: TutorInput;
  action: AllowedTutorAction;
  claim: string;
};
export type TutorModelConfiguration = {
  version: string;
  kind: "fixture" | "approved";
  provider: string;
  model: string;
  approvalReference: string | null;
  region: string;
  dataPolicy: string;
  allowPrivateCode: boolean;
};
export type TutorRepository = {
  start(ctx: RequestContext, input: TutorInput): Promise<TutorView>;
  claim(ctx: RequestContext, id: string): Promise<TutorWork | null>;
  read(ctx: RequestContext, id: string): Promise<TutorView>;
  cancel(ctx: RequestContext, id: string): Promise<TutorView>;
  code(ctx: RequestContext, work: TutorWork): Promise<string | null>;
  finish(
    ctx: RequestContext,
    work: TutorWork,
    response: TutorResponse | null,
    evidenceId: string | null,
    reason: string | null,
    model?: TutorModelConfiguration,
  ): Promise<TutorView>;
};
