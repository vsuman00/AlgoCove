import type { LearningPublicView } from "@algocove/content/learning-release";
import { pilotLearningView } from "@algocove/content/learning-release";
import type { PilotPublicView } from "@algocove/content/pilot";
/** Explicit compatibility adapter. Never apply container facts to an unknown release. */
export const LEGACY_LEARNING_VIEW: LearningPublicView = {
  schemaVersion: 1,
  slug: "arrays-two-pointer",
  pattern: "two-pointers",
  brief: {
    input: "Positive integer heights",
    output: "Maximum contained area",
    complexity: "O(n) time · O(1) space",
    invariant:
      "The width decreases at every step. Moving the shorter boundary safely excludes containers whose width and limiting height cannot improve the current area.",
  },
  lesson: {
    objectives: ["Explain why the shorter boundary can be discarded."],
    prerequisites: [],
    blocks: [
      {
        kind: "prose",
        text: "Keep two boundaries and the best area seen so far. Compare the current boundaries, then move the shorter one.",
      },
    ],
  },
  questions: [
    {
      id: "area",
      prompt: "Area checkpoint",
      options: [
        { id: "minimum_times_width", text: "Smaller height × distance" },
        { id: "maximum_times_width", text: "Larger height × distance" },
        { id: "sum", text: "Sum of the two heights" },
      ],
    },
    {
      id: "boundary",
      prompt: "Boundary checkpoint",
      options: [
        { id: "shorter", text: "Move the shorter boundary" },
        { id: "taller", text: "Move the taller boundary" },
        { id: "both", text: "Always move both boundaries" },
      ],
    },
  ],
  media: [],
  traceKind: "legacy",
};
export function learningViewFor(
  problemId: string,
  problem: { learning?: LearningPublicView | null; pilot?: PilotPublicView | null } | null,
): LearningPublicView | null {
  if (!problem) return null;
  if (problem.learning) return problem.learning;
  if (problem.pilot) return pilotLearningView(problem.pilot);
  return problemId === "arrays-two-pointer" ? LEGACY_LEARNING_VIEW : null;
}
