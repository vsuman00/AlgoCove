export type OptionalOperation = "plan_proposal" | "code_execution" | "tutor_generation";
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
  tutor_generation: {
    version: 1,
    dailyRequests: 20,
    minuteRequests: 6,
    concurrent: 1,
    dailyUnits: 560000,
    unitsPerRequest: 28000,
    failureThreshold: 3,
    cooldownMs: 60000,
  },
  plan_proposal: {
    version: 2,
    dailyRequests: 20,
    minuteRequests: 6,
    concurrent: 1,
    dailyUnits: 1120000,
    unitsPerRequest: 56000,
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
