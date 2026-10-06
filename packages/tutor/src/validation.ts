import type { AllowedTutorAction, TutorInput, TutorResponse } from "@algocove/application";
import type { EvidencePackage } from "@algocove/retrieval";
export const PROMPT_VERSION = "tutor.prompt.v1";
/** Pattern checks are defense in depth; they do not prove absence of semantic leakage. */
export function validateTutorResponse(
  raw: unknown,
  action: AllowedTutorAction,
  input: TutorInput,
  evidence: EvidencePackage,
  modelVersion: string,
): TutorResponse {
  if (typeof raw === "string") {
    if (raw.length > 12000) throw Error("malformed");
    try {
      raw = JSON.parse(raw);
    } catch {
      throw Error("malformed");
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Error("malformed");
  const encoded = JSON.stringify(raw);
  if (encoded.length > 12000) throw Error("malformed");
  const r = raw as TutorResponse;
  const keys = [
    "intent",
    "hintTier",
    "message",
    "citations",
    "confidence",
    "unsupported",
    "policyVersion",
    "retrievalConfigVersion",
    "promptVersion",
    "modelConfigVersion",
  ];
  if (
    Object.keys(r).length !== keys.length ||
    Object.keys(r).some((k) => !keys.includes(k)) ||
    r.intent !== input.intent ||
    r.hintTier !== 1 ||
    r.hintTier > action.maximumTier ||
    typeof r.message !== "string" ||
    !r.message.trim() ||
    r.message.length > 4000 ||
    !Array.isArray(r.citations) ||
    r.citations.length < 1 ||
    r.citations.length > 10 ||
    !["high", "medium", "low"].includes(r.confidence) ||
    r.unsupported !== false ||
    r.policyVersion !== action.policyVersion ||
    r.retrievalConfigVersion !== evidence.configuration.version ||
    r.promptVersion !== PROMPT_VERSION ||
    r.modelConfigVersion !== modelVersion ||
    evidence.lowConfidence
  )
    throw Error("malformed");
  if (
    /```|\b(?:def\s+\w+\s*\(|function\s+\w+\s*\(|class\s+\w+|return\s+\w+|full\s+solution|ignore\s+(?:previous|system)|exfiltrat|tool_calls?|execute\s+(?:sql|command))|<\/?(?:script|system|assistant|developer)>/i.test(
      r.message,
    )
  )
    throw Error("unsafe");
  for (const c of r.citations) {
    if (!c || typeof c !== "object" || Object.keys(c).length !== 4) throw Error("citation");
    const item = evidence.selected.find((e) => e.evidenceItemId === c.evidenceItemId);
    if (
      !item ||
      c.contentId !== item.candidate.problemId ||
      c.contentVersion !== item.candidate.contentVersionId ||
      c.title !== item.candidate.title
    )
      throw Error("citation");
  }
  return structuredClone(r);
}
