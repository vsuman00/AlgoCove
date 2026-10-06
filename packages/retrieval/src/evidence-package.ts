import { checksum } from "@algocove/content";
import type {
  FusedResult,
  RetrievalCandidate,
  RetrievalConfiguration,
  RetrievalScope,
} from "./hybrid-search.ts";
export function canonicalJson(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  )
    return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (typeof value === "object" && value !== null)
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([k, v]) => JSON.stringify(k) + ":" + canonicalJson(v))
        .join(",") +
      "}"
    );
  throw Error("Evidence must contain canonical JSON values.");
}
export type RetrievalInput = {
  attemptId: string;
  curriculumVersionId: string;
  configurationVersion: string;
  intent: "explain" | "hint" | "debug" | "compare" | "review";
  query: string;
  idempotencyKey: string;
};
export type EvidencePackage = {
  schemaVersion: 1;
  packageId: string;
  requestId: string;
  createdAt: string;
  request: RetrievalInput;
  normalizedQuery: string;
  scope: RetrievalScope;
  configuration: RetrievalConfiguration;
  queryVector: readonly number[];
  model: {
    provider: string;
    model: string;
    dimensions: number;
    normalization: string;
    policyVersion: string;
  };
  lexical: readonly { chunkId: string; rank: number; score: number }[];
  dense: readonly { chunkId: string; rank: number; distance: number }[];
  candidates: readonly {
    chunkId: string;
    indexId: string;
    contentVersionId: string;
    textChecksum: string;
    sourceChecksum: string;
    normalizedChecksum: string;
    lexicalRank: number | null;
    denseRank: number | null;
    fusedScore: number;
  }[];
  selected: readonly {
    evidenceItemId: string;
    candidate: RetrievalCandidate;
    lexicalRank: number | null;
    denseRank: number | null;
    fusedScore: number;
  }[];
  excluded: FusedResult["excluded"];
  contradictions: FusedResult["contradictions"];
  lowConfidence: boolean;
  timing: {
    authorizationMs: number;
    lexicalMs: number;
    denseMs: number;
    packagingMs: number;
    totalBeforePersistenceMs: number;
  };
  checksum: string;
};
export function sealEvidence(body: Omit<EvidencePackage, "checksum">): EvidencePackage {
  return { ...body, checksum: checksum(canonicalJson(body)) };
}
export function verifyEvidence(evidence: EvidencePackage): boolean {
  const { checksum: expected, ...body } = evidence;
  return checksum(canonicalJson(body)) === expected;
}
