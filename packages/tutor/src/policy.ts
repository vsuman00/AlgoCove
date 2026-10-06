import { HINT_CEILINGS, parseId } from "@algocove/domain";
import { validationError, type TutorInput, type AllowedTutorAction } from "@algocove/application";
export function parseTutorInput(raw: unknown): TutorInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw validationError("A bounded tutor request is required.");
  const v = raw as Record<string, unknown>,
    keys = ["attemptId", "intent", "query", "requestedTier", "shareCode", "idempotencyKey"];
  if (
    Object.keys(v).length !== keys.length ||
    Object.keys(v).some((k) => !keys.includes(k)) ||
    !parseId("attempt", v.attemptId).ok ||
    typeof v.intent !== "string" ||
    !["explain", "hint", "debug", "compare", "review"].includes(v.intent) ||
    typeof v.query !== "string" ||
    !v.query.trim() ||
    v.query.length > 500 ||
    !Number.isInteger(v.requestedTier) ||
    Number(v.requestedTier) < 1 ||
    Number(v.requestedTier) > 6 ||
    (v.intent !== "hint" && v.requestedTier !== 1) ||
    typeof v.shareCode !== "boolean" ||
    (v.shareCode && v.intent !== "debug") ||
    typeof v.idempotencyKey !== "string" ||
    !/^[A-Za-z0-9._:-]{8,128}$/.test(v.idempotencyKey)
  )
    throw validationError("A bounded tutor request is required.");
  return { ...v } as TutorInput;
}
export function allowedTutorAction(
  input: TutorInput,
  facts: Omit<
    AllowedTutorAction,
    "maximumTier" | "generatedTier" | "requestedTier" | "shareCode" | "policyVersion"
  > & { highest: number },
): AllowedTutorAction {
  const ceiling = Math.min(HINT_CEILINGS[facts.mode], facts.attemptStatus === "submitted" ? 6 : 5);
  if (input.requestedTier > ceiling || input.requestedTier > facts.highest + 1)
    throw validationError("Reveal guidance progressively within the allowed tier.");
  if (input.intent !== "hint" && input.requestedTier !== 1)
    throw validationError("Generated feedback is restricted to clarification.");
  const { highest: _highest, ...scope } = facts;
  return {
    ...scope,
    maximumTier: ceiling,
    generatedTier: 1,
    requestedTier: input.requestedTier,
    shareCode: input.shareCode && input.intent === "debug",
    policyVersion: "tutor.policy.v1",
  };
}
