export type OptionalOperation = "plan_proposal" | "code_execution";
export type BudgetPolicy = {
  version: number;
  dailyRequests: number;
  minuteRequests: number;
  concurrent: number;
  dailyUnits: number;
  unitsPerRequest: number;
  failureThreshold: number;
  cooldownMs: number;
};
/** Server-owned initial policy. No browser-controlled quota, price or expiry. */
export const BUDGET_POLICIES: Record<OptionalOperation, BudgetPolicy> = {
  plan_proposal: {
    version: 1,
    dailyRequests: 20,
    minuteRequests: 6,
    concurrent: 1,
    dailyUnits: 200,
    unitsPerRequest: 10,
    failureThreshold: 3,
    cooldownMs: 60000,
  },
  code_execution: {
    version: 1,
    dailyRequests: 120,
    minuteRequests: 12,
    concurrent: 3,
    dailyUnits: 120,
    unitsPerRequest: 1,
    failureThreshold: 3,
    cooldownMs: 60000,
  },
};
export type BudgetAdmission =
  | { allowed: true; replayed: boolean }
  | {
      allowed: false;
      reason: "daily_cap" | "rate_limit" | "concurrency" | "circuit_open";
      retryAfterSeconds: number;
    };
