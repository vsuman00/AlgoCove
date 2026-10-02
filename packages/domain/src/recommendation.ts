import type { ConceptId, Instant, ProblemLanguage, ProblemVersionId } from "./index.ts";
export type RecommendationCandidate = {
  readonly problemVersionId: ProblemVersionId;
  readonly conceptId: ConceptId;
  readonly title: string;
  readonly href: string;
  readonly languages: readonly ProblemLanguage[];
  readonly available: boolean;
  readonly prerequisites: readonly ConceptId[];
  readonly band: string;
  readonly lastPracticed: Instant | null;
};
export type NextAction = {
  readonly kind: "review" | "intro" | "practice" | "profile" | "unavailable";
  readonly href: string;
  readonly title: string;
  readonly reasonCodes: readonly string[];
  readonly reasons: readonly string[];
};
const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
export function recommendNext(input: {
  readonly goal: string | null;
  readonly preferredLanguages: readonly ProblemLanguage[];
  readonly candidates: readonly RecommendationCandidate[];
  readonly dueReview: boolean;
  readonly verifiedConcepts?: readonly ConceptId[];
}): {
  readonly policyVersion: number;
  readonly action: NextAction;
  readonly alternatives: readonly NextAction[];
} {
  if (input.goal === null || input.preferredLanguages.length === 0)
    return {
      policyVersion: 1,
      action: {
        kind: "profile",
        href: "/onboarding",
        title: "Set your learning goal",
        reasonCodes: ["profile_required"],
        reasons: ["Save a goal and preferred language before choosing a session."],
      },
      alternatives: [],
    };
  const verified = new Set(
    input.verifiedConcepts ??
      input.candidates
        .filter((c) => ["independent_completion", "independent_delayed_transfer"].includes(c.band))
        .map((c) => c.conceptId),
  );
  const eligible = input.candidates
    .filter(
      (c) =>
        c.available &&
        c.languages.some((l) => input.preferredLanguages.includes(l)) &&
        c.prerequisites.every((p) => verified.has(p)),
    )
    .sort(
      (a, b) =>
        Number(a.band !== "needs_practice") - Number(b.band !== "needs_practice") ||
        compare(a.lastPracticed ?? "", b.lastPracticed ?? "") ||
        compare(a.problemVersionId, b.problemVersionId),
    );
  const unique = eligible.filter(
    (candidate, index) =>
      eligible.findIndex((other) => other.problemVersionId === candidate.problemVersionId) ===
      index,
  );
  const actions: NextAction[] = unique.map((c) => ({
    kind: c.band === "unassessed" ? "intro" : "practice",
    href: `${c.href}?language=${input.preferredLanguages.find((l) => c.languages.includes(l))!}`,
    title: c.band === "unassessed" ? `Start ${c.title}` : `Practice ${c.title}`,
    reasonCodes: [
      c.band === "unassessed"
        ? "cold_start_intro"
        : c.band === "needs_practice"
          ? "concept_needs_practice"
          : c.band === "projection_pending"
            ? "mastery_uncertain_pending"
            : "reinforce_pattern",
      "preferred_language_available",
      "prerequisites_satisfied",
      "least_recent_practice",
      "learner_goal_context",
    ],
    reasons: [
      c.band === "unassessed"
        ? "Begin with the authored introduction; no prior ability is assumed."
        : c.band === "projection_pending"
          ? "Your latest checked activity is saved; its progress update is pending. Practice does not assume a new mastery level."
          : "Use a reviewed exercise to strengthen this pattern.",
      "Your preferred language is available and required prerequisites are satisfied.",
      "Less recently practiced eligible content is preferred to diversify practice.",
      `Practice supports your stated goal: ${input.goal}.`,
    ],
  }));
  if (input.dueReview)
    actions.unshift({
      kind: "review",
      href: "/review",
      title: "Recover your due review",
      reasonCodes: ["due_review_first"],
      reasons: ["A due or overdue review is ready. Catch up without resetting your progress."],
    });
  return {
    policyVersion: 1,
    action: actions[0] ?? {
      kind: "unavailable",
      href: "/onboarding",
      title: "No eligible exercise is available",
      reasonCodes: ["content_or_language_unavailable"],
      reasons: [
        "Current content, language availability or prerequisites prevent a supported practice recommendation.",
      ],
    },
    alternatives: actions.slice(1, 3),
  };
}
