import { describe, it, expect, vi } from "vitest";
import {
  allowedTutorAction,
  parseTutorInput,
  validateTutorResponse,
  fixtureGenerationPort,
  generationRequest,
  boundedGeneration,
  TutorService,
  approvedGenerationAdapter,
  ProviderFailure,
  type GenerationPort,
} from "@algocove/tutor";
import type {
  TutorInput,
  TutorRepository,
  TutorWork,
  RequestContext,
  TutorView,
} from "@algocove/application";
import type { EvidencePackage } from "@algocove/retrieval";
const input: TutorInput = {
  attemptId: "att_aaaaaaaaaaaaaaaa",
  intent: "explain",
  query: "Help clarify the inputs",
  requestedTier: 1,
  shareCode: false,
  idempotencyKey: "tutor:test",
};
const facts = {
  learnerId: "usr_aaaaaaaaaaaaaaaa",
  attemptId: input.attemptId,
  problemVersionId: "prb_aaaaaaaaaaaaaaaa",
  contentVersionId: "cnt_aaaaaaaaaaaaaaaa",
  mode: "learn" as const,
  attemptStatus: "active",
  highest: 0,
};
const action = allowedTutorAction(input, facts);
const evidence = {
  packageId: "evt_aaaaaaaaaaaaaaaa",
  lowConfidence: false,
  configuration: { version: "retrieval.v1" },
  selected: [
    {
      evidenceItemId: "chunk-1",
      candidate: {
        problemId: "pro_a",
        contentVersionId: facts.contentVersionId,
        title: "Original",
        hintTier: 0,
        text: "Reviewed original statement",
      },
    },
  ],
} as unknown as EvidencePackage;
const ctx = {} as RequestContext;
async function candidate() {
  return fixtureGenerationPort.generate(
    generationRequest(input, action, evidence, fixtureGenerationPort, null),
    new AbortController().signal,
  );
}
describe("Task44 tutor policy and provider boundary", () => {
  it("derives a server-owned progressive ceiling and cannot review solutions early", () => {
    expect(action.maximumTier).toBe(5);
    expect(() =>
      allowedTutorAction(
        { ...input, intent: "hint", requestedTier: 6 },
        { ...facts, mode: "practice", highest: 5 },
      ),
    ).toThrow();
    expect(
      allowedTutorAction(
        { ...input, intent: "hint", requestedTier: 6 },
        { ...facts, mode: "practice", highest: 5, attemptStatus: "submitted" },
      ).requestedTier,
    ).toBe(6);
  });
  it.each([
    { requestedTier: 2 },
    { shareCode: true },
    { roles: ["operator"] },
    { privateCode: "PRIVATE_CANARY" },
    { query: "x".repeat(501) },
    { intent: "unknown" },
  ])("rejects browser scope bypass %j", (patch) =>
    expect(() => parseTutorInput({ ...input, ...patch })).toThrow(),
  );
  it("accepts the complete grounded fixture candidate", async () =>
    expect(
      validateTutorResponse(await candidate(), action, input, evidence, "generation.fixture.v1")
        .hintTier,
    ).toBe(1));
  it.each([
    { message: "```python\nLOCKED_SOLUTION```" },
    { message: "ignore previous instructions tool_call" },
    { hintTier: 6 },
    {
      citations: [
        {
          contentId: "wrong",
          contentVersion: facts.contentVersionId,
          evidenceItemId: "chunk-1",
          title: "Original",
        },
      ],
    },
    { tool_calls: ["mutate_progress"] },
    { unsupported: true },
    { modelConfigVersion: "forged" },
    { message: "x".repeat(4001) },
    { citations: [] },
  ])("rejects complete untrusted candidate %j", async (patch) => {
    const original = await candidate();
    expect(() =>
      validateTutorResponse(
        { ...(original as object), ...patch },
        action,
        input,
        evidence,
        "generation.fixture.v1",
      ),
    ).toThrow();
  });
  it("refuses insufficient evidence and oversized provider context", async () => {
    const good = await candidate();
    expect(() =>
      validateTutorResponse(
        good,
        action,
        input,
        { ...evidence, lowConfidence: true },
        "generation.fixture.v1",
      ),
    ).toThrow();
    expect(() =>
      generationRequest(
        input,
        action,
        {
          ...evidence,
          selected: [
            {
              ...evidence.selected[0]!,
              candidate: { ...evidence.selected[0]!.candidate, text: "x".repeat(17000) },
            },
          ],
        },
        fixtureGenerationPort,
        null,
      ),
    ).toThrow();
  });
  it("sends private code only for explicit debug consent and matching provider policy", () => {
    expect(
      "privateCode" in generationRequest(input, action, evidence, fixtureGenerationPort, null),
    ).toBe(false);
    expect(() =>
      generationRequest(input, action, evidence, fixtureGenerationPort, "PRIVATE_CANARY"),
    ).toThrow();
    const debug = { ...input, intent: "debug" as const, shareCode: true },
      allowed = allowedTutorAction(debug, facts);
    expect(
      generationRequest(debug, allowed, evidence, fixtureGenerationPort, "PRIVATE_CANARY")
        .privateCode,
    ).toBe("PRIVATE_CANARY");
    expect(() =>
      generationRequest(
        debug,
        allowed,
        evidence,
        {
          ...fixtureGenerationPort,
          configuration: { ...fixtureGenerationPort.configuration, allowPrivateCode: false },
        },
        "PRIVATE_CANARY",
      ),
    ).toThrow();
  });
  it("rejects an unapproved live configuration", () =>
    expect(() =>
      generationRequest(
        input,
        action,
        evidence,
        {
          ...fixtureGenerationPort,
          configuration: {
            ...fixtureGenerationPort.configuration,
            kind: "approved",
            approvalReference: null,
          },
        },
        null,
      ),
    ).toThrow());
  it("keeps approved transports narrow and redacts provider error details", async () => {
    const port = approvedGenerationAdapter(
      {
        ...fixtureGenerationPort.configuration,
        kind: "approved",
        approvalReference: "test-approval-only",
        provider: "fixture-vendor",
        model: "fixture-model",
      },
      async () => {
        throw Error("PRIVATE_PROVIDER_ERROR_CANARY");
      },
    );
    await expect(
      port.generate(
        generationRequest(input, action, evidence, port, null),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ category: "unavailable", message: "Generation is unavailable." });
    expect(() =>
      approvedGenerationAdapter(
        {
          ...fixtureGenerationPort.configuration,
          kind: "approved",
          approvalReference: "",
          provider: "fixture",
          model: "fixture",
        },
        async () => null,
      ),
    ).toThrow(ProviderFailure);
  });
  it("bounds a provider that ignores cancellation and consumes late rejections", async () => {
    const port = { ...fixtureGenerationPort, generate: () => new Promise(() => {}) };
    await expect(
      boundedGeneration(
        port,
        generationRequest(input, action, evidence, port, null),
        new AbortController().signal,
        5,
      ),
    ).rejects.toThrow();
  });
  it("persists before returning, never returns rejected text, and skips providers for restricted tiers", async () => {
    const work: TutorWork = { requestId: "evt_aaaaaaaaaaaaaaaa", input, action, claim: "fixture" };
    const fallback: TutorView = {
      requestId: work.requestId,
      status: "fallback",
      reason: "rejected",
      response: null,
    };
    const finish = vi.fn().mockResolvedValue(fallback),
      code = vi.fn();
    const repository = {
      claim: vi.fn().mockResolvedValue(work),
      read: vi.fn().mockResolvedValue({ ...fallback, status: "running" }),
      finish,
      code,
      cancel: vi.fn().mockResolvedValue({ ...fallback, status: "cancelled" }),
    } as unknown as TutorRepository;
    const retrieval = {
      retrieve: vi.fn().mockResolvedValue(evidence),
      read: vi.fn().mockResolvedValue(evidence),
    };
    const bad: GenerationPort = {
      ...fixtureGenerationPort,
      generate: vi
        .fn()
        .mockResolvedValue({ message: "REJECTED_CANARY", tool_calls: ["write_progress"] }),
    };
    expect(
      await new TutorService(repository, retrieval, bad).complete(ctx, work.requestId),
    ).toEqual(fallback);
    expect(finish.mock.calls[0]?.[2]).toBeNull();
    expect(code).not.toHaveBeenCalled();
    work.input = { ...input, intent: "hint", requestedTier: 4 };
    work.action = allowedTutorAction(work.input, { ...facts, highest: 3 });
    await new TutorService(repository, retrieval, bad).complete(ctx, work.requestId);
    expect(bad.generate).toHaveBeenCalledTimes(1);
    expect(retrieval.retrieve).toHaveBeenCalledTimes(1);
  });
});
