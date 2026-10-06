import { createHash } from "node:crypto";
import { normalizeLearnerText, parseId, parseContentChecksum } from "@algocove/domain";

export const CHUNK_POLICY_VERSION = "pedagogical.problem.v1";
export const INJECTION_SCAN_VERSION = "instruction-markers.v1";
export type IndexSource = {
  contentVersionId: string;
  problemVersionId: string;
  sourceChecksum: string;
  title: string;
  statement: string | null;
  provenance: string;
  status: string;
  payloadStatus: string;
  publishedAt: string | null;
  rightsExpiresAt: string | null;
  concepts: readonly string[];
  curricula: readonly string[];
  languages: readonly string[];
  hints: readonly { hintId: string; tier: number; kind: string; body: string }[];
};
export type PedagogicalChunk = {
  chunkId: string;
  kind: "problem_statement" | "hint_tier";
  ordinal: number;
  text: string;
  textChecksum: string;
  hintTier: number;
  sourceObjectId: string;
  language: "neutral";
  targetLevel: "unspecified";
  visibility: "published_curriculum";
  scanStatus: "passed";
};
export type Derivation = {
  indexId: string;
  contentVersionId: string;
  problemVersionId: string;
  policyVersion: string;
  sourceChecksum: string;
  normalizedChecksum: string;
  scanVersion: string;
  concepts: readonly string[];
  curricula: readonly string[];
  languages: readonly string[];
  validFrom: string;
  validUntil: string | null;
  chunks: readonly PedagogicalChunk[];
};
export class DerivationFailure extends Error {
  readonly code: "unavailable" | "invalid_source" | "injection_detected" | "unsupported_policy";
  constructor(code: DerivationFailure["code"]) {
    super("Content derivation rejected.");
    this.code = code;
  }
}
export function checksum(value: string): string {
  return "sha256:" + createHash("sha256").update(value, "utf8").digest("hex");
}
export function identity(prefix: string, value: unknown): string {
  return prefix + createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 40);
}
function normalize(text: string): string {
  const normalized = normalizeLearnerText(text).normalize("NFC");
  if (!normalized || normalized.length > 20000) throw new DerivationFailure("invalid_source");
  // This deterministic scan is defense in depth, not a semantic safety proof.
  if (
    /(?:ignore|disregard|override)\s+(?:all\s+)?(?:previous|prior|system|developer)\s+(?:instructions|prompts)|<\/?(?:system|assistant|developer)>|\[INST\]|exfiltrat|reveal\s+(?:the\s+)?(?:system\s+prompt|secrets|api\s+key)/i.test(
      normalized,
    )
  )
    throw new DerivationFailure("injection_detected");
  return normalized;
}
export function deriveChunks(source: IndexSource, policyVersion: string, now: string): Derivation {
  if (!Number.isFinite(Date.parse(now))) throw new DerivationFailure("invalid_source");
  if (policyVersion !== CHUNK_POLICY_VERSION) throw new DerivationFailure("unsupported_policy");
  if (
    source.status !== "published" ||
    source.payloadStatus !== "available" ||
    source.provenance !== "original" ||
    !source.publishedAt ||
    !Number.isFinite(Date.parse(source.publishedAt)) ||
    (source.rightsExpiresAt !== null &&
      (!Number.isFinite(Date.parse(source.rightsExpiresAt)) ||
        Date.parse(source.rightsExpiresAt) <= Date.parse(now)))
  )
    throw new DerivationFailure("unavailable");
  if (
    !parseId("contentVersion", source.contentVersionId).ok ||
    !parseId("problemVersion", source.problemVersionId).ok ||
    !parseContentChecksum(source.sourceChecksum).ok ||
    typeof source.statement !== "string" ||
    source.hints.length > 6 ||
    !source.concepts.length ||
    !source.curricula.length ||
    !source.languages.length
  )
    throw new DerivationFailure("invalid_source");
  if (
    source.title.trim().length < 1 ||
    source.title.length > 200 ||
    source.concepts.length > 100 ||
    source.curricula.length > 100 ||
    source.languages.length > 6 ||
    source.concepts.some((id) => !parseId("concept", id).ok) ||
    source.curricula.some((id) => !parseId("curriculumVersion", id).ok) ||
    source.languages.some(
      (language) => !["python", "javascript", "typescript", "java", "cpp", "c"].includes(language),
    ) ||
    [source.concepts, source.curricula, source.languages].some(
      (values) => new Set(values).size !== values.length,
    )
  )
    throw new DerivationFailure("invalid_source");
  const kinds = [
    "clarification",
    "example",
    "invariant",
    "pseudocode_scaffold",
    "partial_structure",
    "solution_review",
  ];
  const sorted = [...source.hints].sort(
    (a, b) => a.tier - b.tier || a.hintId.localeCompare(b.hintId),
  );
  if (
    new Set(sorted.map((h) => h.tier)).size !== sorted.length ||
    sorted.some(
      (h) =>
        !Number.isInteger(h.tier) ||
        kinds[h.tier - 1] !== h.kind ||
        !/^[A-Za-z0-9._:-]{1,128}$/.test(h.hintId),
    )
  )
    throw new DerivationFailure("invalid_source");
  const texts = [
    normalize(source.title + "\n\n" + source.statement),
    ...sorted.map((h) => normalize(h.body)),
  ];
  const normalizedChecksum = checksum(
    JSON.stringify({
      texts,
      hints: sorted.map((h) => [h.hintId, h.kind, h.tier]),
      concepts: [...source.concepts].sort(),
      curricula: [...source.curricula].sort(),
      languages: [...source.languages].sort(),
    }),
  );
  const indexId = identity("idx_", [source.contentVersionId, policyVersion, normalizedChecksum]);
  return {
    indexId,
    contentVersionId: source.contentVersionId,
    problemVersionId: source.problemVersionId,
    policyVersion,
    sourceChecksum: source.sourceChecksum,
    normalizedChecksum,
    scanVersion: INJECTION_SCAN_VERSION,
    concepts: [...source.concepts].sort(),
    curricula: [...source.curricula].sort(),
    languages: [...source.languages].sort(),
    validFrom: source.publishedAt,
    validUntil: source.rightsExpiresAt,
    chunks: texts.map((text, ordinal) => ({
      chunkId: identity("chk_", [indexId, ordinal, checksum(text)]),
      kind: ordinal === 0 ? "problem_statement" : "hint_tier",
      ordinal,
      text,
      textChecksum: checksum(text),
      hintTier: ordinal === 0 ? 0 : sorted[ordinal - 1]!.tier,
      sourceObjectId: ordinal === 0 ? source.problemVersionId : sorted[ordinal - 1]!.hintId,
      language: "neutral",
      targetLevel: "unspecified",
      visibility: "published_curriculum",
      scanStatus: "passed",
    })),
  };
}
