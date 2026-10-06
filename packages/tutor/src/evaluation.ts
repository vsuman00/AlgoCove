import { canonicalJson, evaluateRanking } from "@algocove/retrieval";

export type EvaluationCase = {
  id: string;
  provenance: "synthetic-original";
  relevant: string[];
  forbidden: string[];
  expectedDisposition: "validated" | "fallback";
  critical: boolean;
};
export type EvaluationSuite = {
  version: string;
  rubricVersion: string;
  cases: EvaluationCase[];
  thresholds: {
    recall: number;
    mrr: number;
    ndcg: number;
    generationPassRate: number;
    maxLatencyMs: number;
    maxCostUnits: number;
    minHumanScore: number;
  };
  k: number;
  humanSample: string[];
};
export type EvaluationConfiguration = {
  version: string;
  corpusVersion: string;
  indexVersion: string;
  retrievalVersion: string;
  generationVersion: string;
  promptVersion: string;
  policyVersion: string;
  fixture: boolean;
  approvalReference: string | null;
};
/** Measurements contain IDs and scores only: no query, code, response, or learner identity. */
export type EvaluationMeasurement = {
  caseId: string;
  ranked: string[];
  disposition: "validated" | "fallback";
  policyViolations: number;
  privacyViolations: number;
  generationPassed: boolean;
  latencyMs: number;
  costUnits: number;
};
export type EvaluationRun = {
  suiteVersion: string;
  configurationVersion: string;
  codeVersion: string;
  environment: "synthetic-local" | "approved-evaluation";
  measurements: EvaluationMeasurement[];
};
export type HumanEvaluation = {
  caseId: string;
  rubricVersion: string;
  score: number;
  accepted: boolean;
};
const identifier = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/;
function id(v: unknown): asserts v is string {
  if (typeof v !== "string" || !identifier.test(v)) throw Error("Invalid evaluation identifier.");
}
function object(v: unknown, keys: string[]): asserts v is Record<string, unknown> {
  if (
    !v ||
    typeof v !== "object" ||
    Array.isArray(v) ||
    Object.keys(v).length !== keys.length ||
    Object.keys(v).some((k) => !keys.includes(k))
  )
    throw Error("Evaluation records must use the declared fields only.");
}
function number(v: unknown, max: number, integer = false): asserts v is number {
  if (
    typeof v !== "number" ||
    !Number.isFinite(v) ||
    v < 0 ||
    v > max ||
    (integer && !Number.isSafeInteger(v))
  )
    throw Error("Invalid evaluation measurement.");
}
function ids(v: unknown, max: number): asserts v is string[] {
  if (!Array.isArray(v) || v.length > max || new Set(v).size !== v.length)
    throw Error("Invalid evaluation membership.");
  v.forEach(id);
}
export function parseEvaluationSuite(raw: unknown): EvaluationSuite {
  object(raw, ["version", "rubricVersion", "cases", "thresholds", "k", "humanSample"]);
  id(raw.version);
  id(raw.rubricVersion);
  number(raw.k, 50, true);
  if (raw.k < 1 || !Array.isArray(raw.cases) || !raw.cases.length || raw.cases.length > 500)
    throw Error("A bounded nonempty suite is required.");
  for (const c of raw.cases) {
    object(c, ["id", "provenance", "relevant", "forbidden", "expectedDisposition", "critical"]);
    id(c.id);
    ids(c.relevant, 50);
    ids(c.forbidden, 100);
    if (
      c.provenance !== "synthetic-original" ||
      !c.relevant.length ||
      !["validated", "fallback"].includes(String(c.expectedDisposition)) ||
      typeof c.critical !== "boolean" ||
      c.relevant.some((v) => (c.forbidden as string[]).includes(v))
    )
      throw Error("Only explicitly labelled synthetic original cases are admitted.");
  }
  if (
    new Set(raw.cases.map((c) => c.id)).size !== raw.cases.length ||
    !raw.cases.some((c) => c.critical)
  )
    throw Error("Unique cases and critical coverage are mandatory.");
  ids(raw.humanSample, 500);
  if (
    !raw.humanSample.length ||
    raw.humanSample.some((v) => !(raw.cases as EvaluationCase[]).some((c) => c.id === v))
  )
    throw Error("Declared human sample required.");
  object(raw.thresholds, [
    "recall",
    "mrr",
    "ndcg",
    "generationPassRate",
    "maxLatencyMs",
    "maxCostUnits",
    "minHumanScore",
  ]);
  for (const key of ["recall", "mrr", "ndcg", "generationPassRate", "minHumanScore"]) {
    number(raw.thresholds[key], 1);
    if (raw.thresholds[key] === 0) throw Error("Quality thresholds must be positive.");
  }
  number(raw.thresholds.maxLatencyMs, 60000);
  number(raw.thresholds.maxCostUnits, 1000000);
  if (!raw.thresholds.maxLatencyMs) throw Error("Latency budget required.");
  return structuredClone(raw) as EvaluationSuite;
}
export function parseEvaluationConfiguration(raw: unknown): EvaluationConfiguration {
  object(raw, [
    "version",
    "corpusVersion",
    "indexVersion",
    "retrievalVersion",
    "generationVersion",
    "promptVersion",
    "policyVersion",
    "fixture",
    "approvalReference",
  ]);
  for (const key of [
    "version",
    "corpusVersion",
    "indexVersion",
    "retrievalVersion",
    "generationVersion",
    "promptVersion",
    "policyVersion",
  ])
    id(raw[key]);
  if (
    typeof raw.fixture !== "boolean" ||
    (raw.approvalReference !== null && typeof raw.approvalReference !== "string")
  )
    throw Error("Approval metadata required.");
  if (raw.approvalReference !== null) id(raw.approvalReference);
  if (!raw.fixture && !raw.approvalReference)
    throw Error("Live configurations require prior owner approval.");
  return structuredClone(raw) as EvaluationConfiguration;
}
export function parseEvaluationRun(raw: unknown): EvaluationRun {
  object(raw, [
    "suiteVersion",
    "configurationVersion",
    "codeVersion",
    "environment",
    "measurements",
  ]);
  id(raw.suiteVersion);
  id(raw.configurationVersion);
  id(raw.codeVersion);
  if (
    !["synthetic-local", "approved-evaluation"].includes(String(raw.environment)) ||
    !Array.isArray(raw.measurements) ||
    !raw.measurements.length ||
    raw.measurements.length > 500
  )
    throw Error("Bounded evaluation run required.");
  for (const m of raw.measurements) {
    object(m, [
      "caseId",
      "ranked",
      "disposition",
      "policyViolations",
      "privacyViolations",
      "generationPassed",
      "latencyMs",
      "costUnits",
    ]);
    id(m.caseId);
    ids(m.ranked, 100);
    number(m.policyViolations, 1000, true);
    number(m.privacyViolations, 1000, true);
    number(m.latencyMs, 60000);
    number(m.costUnits, 1000000);
    if (
      typeof m.generationPassed !== "boolean" ||
      !["validated", "fallback"].includes(String(m.disposition))
    )
      throw Error("Invalid generation result.");
  }
  if (new Set(raw.measurements.map((m) => m.caseId)).size !== raw.measurements.length)
    throw Error("Duplicate result.");
  return structuredClone(raw) as EvaluationRun;
}
export function evaluatePromotion(
  suiteRaw: unknown,
  runRaw: unknown,
  reviews: HumanEvaluation[],
): {
  passed: boolean;
  reasons: string[];
  metrics: {
    recall: number;
    mrr: number;
    ndcg: number;
    generationPassRate: number;
    maxLatencyMs: number;
    maxCostUnits: number;
  } | null;
} {
  const suite = parseEvaluationSuite(suiteRaw),
    run = parseEvaluationRun(runRaw);
  const reasons: string[] = [];
  if (
    suite.version !== run.suiteVersion ||
    suite.cases.length !== run.measurements.length ||
    suite.cases.some((c) => !run.measurements.some((m) => m.caseId === c.id))
  )
    return { passed: false, reasons: ["case_membership"], metrics: null };
  const rows = suite.cases.map((c) => {
    const m = run.measurements.find((m) => m.caseId === c.id)!;
    const ranking = evaluateRanking(m.ranked, c.relevant, c.forbidden, suite.k);
    if (
      m.policyViolations ||
      m.privacyViolations ||
      ranking.forbiddenCount ||
      (c.critical && (m.disposition !== c.expectedDisposition || !m.generationPassed))
    )
      reasons.push("critical_policy_privacy");
    return {
      ...ranking,
      ...m,
      generationPassed: m.generationPassed && m.disposition === c.expectedDisposition,
    };
  });
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  const metrics = {
    recall: mean(rows.map((r) => r.recall)),
    mrr: mean(rows.map((r) => r.reciprocalRank)),
    ndcg: mean(rows.map((r) => r.ndcg)),
    generationPassRate: mean(rows.map((r) => Number(r.generationPassed))),
    maxLatencyMs: Math.max(...rows.map((r) => r.latencyMs)),
    maxCostUnits: Math.max(...rows.map((r) => r.costUnits)),
  };
  for (const key of ["recall", "mrr", "ndcg", "generationPassRate"] as const)
    if (metrics[key] < suite.thresholds[key]) reasons.push(key);
  for (const key of ["maxLatencyMs", "maxCostUnits"] as const)
    if (metrics[key] > suite.thresholds[key]) reasons.push(key);
  if (
    reviews.some(
      (r) =>
        suite.humanSample.includes(r.caseId) &&
        r.rubricVersion === suite.rubricVersion &&
        (!r.accepted ||
          !Number.isFinite(r.score) ||
          r.score < suite.thresholds.minHumanScore ||
          r.score > 1),
    )
  )
    reasons.push("human_review");
  for (const caseId of suite.humanSample)
    if (
      !reviews.some(
        (r) =>
          r.caseId === caseId &&
          r.rubricVersion === suite.rubricVersion &&
          r.accepted &&
          Number.isFinite(r.score) &&
          r.score >= suite.thresholds.minHumanScore &&
          r.score <= 1,
      )
    )
      reasons.push("human_review");
  return { passed: reasons.length === 0, reasons: [...new Set(reasons)], metrics };
}
/** A stable representation for storage checksums; never includes runtime learner payloads. */
export const canonicalEvaluation = canonicalJson;

/** Offline runner: buffer, validate, measure, discard text. Only synthetic harness inputs belong here. */
export async function measureEvaluationCase(input: {
  caseId: string;
  ranked: string[];
  expectedDisposition: "validated" | "fallback";
  forbiddenOutputCanaries: string[];
  promptCharacters: number;
  generate: (signal: AbortSignal) => Promise<unknown>;
  timeoutMs?: number;
  validate: (candidate: unknown) => { message: string; hintTier: number };
}): Promise<EvaluationMeasurement> {
  id(input.caseId);
  ids(input.ranked, 100);
  number(input.promptCharacters, 16000, true);
  if (
    !input.forbiddenOutputCanaries.length ||
    input.forbiddenOutputCanaries.some((c) => !c || c.length > 200)
  )
    throw Error("Explicit synthetic leakage canaries are required.");
  const timeoutMs = input.timeoutMs ?? 4000;
  number(timeoutMs, 4000, true);
  if (!timeoutMs) throw Error("A positive generation deadline is required.");
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(Error("evaluation_timeout"));
    }, timeoutMs);
  });
  const started = performance.now();
  let disposition: "validated" | "fallback" = "fallback",
    policyViolations = 0,
    privacyViolations = 0,
    candidateCharacters = 0;
  try {
    const candidate = await Promise.race([
      Promise.resolve().then(() => input.generate(controller.signal)),
      deadline,
    ]);
    const encoded = typeof candidate === "string" ? candidate : JSON.stringify(candidate);
    candidateCharacters = Math.min(encoded?.length ?? 0, 12000);
    const validated = input.validate(candidate);
    disposition = "validated";
    policyViolations = Number(validated.hintTier > 1);
    privacyViolations = input.forbiddenOutputCanaries.filter((c) =>
      JSON.stringify(validated).includes(c),
    ).length;
  } catch {
    /* A rejected candidate is discarded and evaluated as fallback. */
  } finally {
    if (timer) clearTimeout(timer);
    controller.abort();
  }
  return {
    caseId: input.caseId,
    ranked: [...input.ranked],
    disposition,
    policyViolations,
    privacyViolations,
    generationPassed:
      disposition === input.expectedDisposition && !policyViolations && !privacyViolations,
    latencyMs: performance.now() - started,
    costUnits: input.promptCharacters + candidateCharacters,
  };
}
