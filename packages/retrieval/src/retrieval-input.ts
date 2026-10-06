import { normalizeLearnerText, parseId } from "@algocove/domain";
import type { RetrievalInput } from "./evidence-package.ts";
export function parseRetrievalInput(value: unknown): RetrievalInput {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw Error("Invalid retrieval request.");
  const v = value as Record<string, unknown>;
  const keys = [
    "attemptId",
    "curriculumVersionId",
    "configurationVersion",
    "intent",
    "query",
    "idempotencyKey",
  ];
  if (
    Object.keys(v).length !== keys.length ||
    Object.keys(v).some((k) => !keys.includes(k)) ||
    !parseId("attempt", v.attemptId).ok ||
    !parseId("curriculumVersion", v.curriculumVersionId).ok ||
    typeof v.configurationVersion !== "string" ||
    !/^[A-Za-z0-9._:-]{1,128}$/.test(v.configurationVersion) ||
    typeof v.intent !== "string" ||
    !["explain", "hint", "debug", "compare", "review"].includes(v.intent) ||
    typeof v.query !== "string" ||
    !v.query.trim() ||
    v.query.length > 500 ||
    typeof v.idempotencyKey !== "string" ||
    !/^[A-Za-z0-9._:-]{8,128}$/.test(v.idempotencyKey)
  )
    throw Error("Invalid retrieval request.");
  return { ...v } as RetrievalInput;
}
export function normalizeRetrievalQuery(value: string): string {
  return normalizeLearnerText(value).normalize("NFC").replace(/\s+/g, " ").toLowerCase();
}
