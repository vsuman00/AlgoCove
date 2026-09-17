import {
  boundedInt,
  normalizeLearnerText,
  ok,
  parseTimeZone,
  textLength,
  err,
  type Instant,
  type LearnerId,
  type Result,
  type TimeZoneId,
} from "./primitives.ts";

export const SUPPORTED_LEARNER_LANGUAGES = [
  "python",
  "javascript",
  "typescript",
  "java",
  "cpp",
  "c",
] as const;

export type LearnerLanguage = (typeof SUPPORTED_LEARNER_LANGUAGES)[number];

export type AccessibilitySettings = {
  readonly reducedMotion: boolean;
  readonly highContrast: boolean;
  readonly screenReader: boolean;
};

export type LearnerProfileInput = {
  readonly goal: string;
  readonly targetRole: string;
  readonly timezone: TimeZoneId;
  readonly dailyCapacityMinutes: number;
  readonly horizonDays: number;
  readonly accessibility: AccessibilitySettings;
  readonly preferredLanguages: readonly LearnerLanguage[];
};

export type LearnerProfile = LearnerProfileInput & {
  readonly learnerId: LearnerId;
  readonly version: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  readonly updatedBy: LearnerId;
};

export type LearnerProfileFailure = {
  readonly code:
    | "invalid_goal"
    | "invalid_target_role"
    | "invalid_timezone"
    | "invalid_capacity"
    | "invalid_horizon"
    | "invalid_accessibility"
    | "invalid_language"
    | "duplicate_language";
  readonly message: string;
};

const LANGUAGE_SET = new Set<string>(SUPPORTED_LEARNER_LANGUAGES);

function parseText(
  candidate: unknown,
  code: "invalid_goal" | "invalid_target_role",
  label: string,
  maxLength: number,
): Result<string, LearnerProfileFailure> {
  if (typeof candidate !== "string") {
    return err({ code, message: `${label} must be text.` });
  }
  const normalized = normalizeLearnerText(candidate);
  if (normalized.length === 0 || textLength(normalized) > maxLength) {
    return err({ code, message: `${label} must contain 1 to ${maxLength} characters.` });
  }
  return ok(normalized);
}

function parseAccessibility(
  candidate: unknown,
): Result<AccessibilitySettings, LearnerProfileFailure> {
  if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
    return err({
      code: "invalid_accessibility",
      message: "Accessibility settings must be an object.",
    });
  }
  const value = candidate as Record<string, unknown>;
  const keys = ["reducedMotion", "highContrast", "screenReader"] as const;
  for (const key of keys) {
    if (value[key] !== undefined && typeof value[key] !== "boolean") {
      return err({ code: "invalid_accessibility", message: `${key} must be boolean.` });
    }
  }
  return ok({
    reducedMotion: value.reducedMotion === true,
    highContrast: value.highContrast === true,
    screenReader: value.screenReader === true,
  });
}

function parseLanguages(
  candidate: unknown,
): Result<readonly LearnerLanguage[], LearnerProfileFailure> {
  if (!Array.isArray(candidate) || candidate.length === 0) {
    return err({ code: "invalid_language", message: "Choose at least one supported language." });
  }
  const languages: LearnerLanguage[] = [];
  for (const item of candidate) {
    if (typeof item !== "string" || !LANGUAGE_SET.has(item)) {
      return err({ code: "invalid_language", message: "A preferred language is not supported." });
    }
    if (languages.includes(item as LearnerLanguage)) {
      return err({ code: "duplicate_language", message: "Preferred languages must be unique." });
    }
    languages.push(item as LearnerLanguage);
  }
  return ok(languages);
}

export function parseLearnerProfileInput(
  candidate: unknown,
): Result<LearnerProfileInput, LearnerProfileFailure> {
  if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
    return err({ code: "invalid_goal", message: "Learner profile must be an object." });
  }
  const value = candidate as Record<string, unknown>;
  const goal = parseText(value.goal, "invalid_goal", "Goal", 500);
  if (!goal.ok) return goal;
  const targetRole = parseText(value.targetRole, "invalid_target_role", "Target role", 120);
  if (!targetRole.ok) return targetRole;
  const timezone = parseTimeZone(value.timezone);
  if (!timezone.ok) {
    return err({ code: "invalid_timezone", message: timezone.error.message });
  }
  const capacity = boundedInt(
    "dailyCapacityMinutes",
    { min: 15, max: 480 },
    value.dailyCapacityMinutes as number,
  );
  if (!capacity.ok) return err({ code: "invalid_capacity", message: capacity.error.message });
  const horizon = boundedInt("horizonDays", { min: 7, max: 365 }, value.horizonDays as number);
  if (!horizon.ok) return err({ code: "invalid_horizon", message: horizon.error.message });
  const accessibility = parseAccessibility(value.accessibility);
  if (!accessibility.ok) return accessibility;
  const preferredLanguages = parseLanguages(value.preferredLanguages);
  if (!preferredLanguages.ok) return preferredLanguages;
  return ok({
    goal: goal.value,
    targetRole: targetRole.value,
    timezone: timezone.value,
    dailyCapacityMinutes: capacity.value,
    horizonDays: horizon.value,
    accessibility: accessibility.value,
    preferredLanguages: preferredLanguages.value,
  });
}
