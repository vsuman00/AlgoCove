import { parseReviewedQuestions, type ReviewedQuestion } from "./structured-learning.ts";
import { READINESS_CATEGORIES, type ReadinessCategory } from "./readiness-gate.ts";
export type ReadinessQuestion = ReviewedQuestion & {
  readonly category: Exclude<ReadinessCategory, "execution">;
};
export function parseReadinessQuestions(value: unknown): readonly ReadinessQuestion[] {
  const reviewed = parseReviewedQuestions(value);
  const original = value as Record<string, unknown>[];
  const questions = reviewed.map((q, i) => {
    const category = original[i]?.category;
    if (
      typeof category !== "string" ||
      category === "execution" ||
      !(READINESS_CATEGORIES as readonly string[]).includes(category)
    )
      throw Error("Invalid preparation category.");
    return { ...q, category: category as ReadinessQuestion["category"] };
  });
  if (
    READINESS_CATEGORIES.filter((c) => c !== "execution").some(
      (c) => !questions.some((q) => q.category === c),
    )
  )
    throw Error("Each preparation category requires a reviewed question.");
  return questions;
}
/** Original two-pointer preparation draft; answer keys are delivered to staff only. */
export const CONTAINER_EXTERNAL_QUESTIONS: readonly ReadinessQuestion[] = [
  {
    id: "concept",
    category: "concept",
    prompt: "For heights 4 and 7 separated by three positions, what limits their area?",
    options: [
      { value: "12", label: "12: the shorter height times the distance" },
      { value: "21", label: "21: the taller height times the distance" },
    ],
    answer: "12",
  },
  {
    id: "pattern",
    category: "pattern",
    prompt: "Which strategy examines a pair of boundaries while shrinking the search interval?",
    options: [
      { value: "two_pointers", label: "Two pointers" },
      { value: "prefix_sum", label: "Prefix sum" },
    ],
    answer: "two_pointers",
  },
  {
    id: "invariant",
    category: "invariant",
    prompt: "Why can the shorter boundary be discarded after measuring its current pair?",
    options: [
      {
        value: "bounded",
        label:
          "Every closer pair using that boundary has smaller width and no greater limiting height",
      },
      { value: "sorted", label: "The heights are always sorted" },
    ],
    answer: "bounded",
  },
  {
    id: "pseudocode",
    category: "pseudocode",
    prompt: "Which ordering preserves the best area seen?",
    options: [
      {
        value: "measure_update_move",
        label: "Measure area, update best, then move the shorter boundary",
      },
      { value: "move_return", label: "Move both boundaries, then return the last area" },
    ],
    answer: "measure_update_move",
  },
  {
    id: "visualization",
    category: "visualization",
    prompt: "Predict the next state for left=0 (height 1), right=8 (height 7).",
    options: [
      { value: "left_1", label: "Move left to 1; keep right at 8" },
      { value: "right_7", label: "Keep left at 0; move right to 7" },
    ],
    answer: "left_1",
  },
];
