export type ReviewQuestion = {
  readonly id: string;
  readonly prompt: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
};
export type ReviewedQuestion = ReviewQuestion & { readonly answer: string };
export function parseReviewedQuestions(value: unknown): readonly ReviewedQuestion[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8)
    throw Error("Reviewed exercise needs 1 to 8 questions.");
  const seen = new Set<string>();
  return value.map((q: unknown) => {
    if (typeof q !== "object" || q === null || Array.isArray(q))
      throw Error("Invalid reviewed question.");
    const v = q as Record<string, unknown>;
    if (
      typeof v.id !== "string" ||
      !/^[a-z][a-z0-9_]{0,63}$/.test(v.id) ||
      seen.has(v.id) ||
      typeof v.prompt !== "string" ||
      v.prompt.length < 1 ||
      v.prompt.length > 1600 ||
      !Array.isArray(v.options) ||
      v.options.length < 2 ||
      v.options.length > 8 ||
      typeof v.answer !== "string"
    )
      throw Error("Invalid reviewed question.");
    seen.add(v.id);
    const choices = new Set<string>();
    const options = v.options.map((o: unknown) => {
      if (typeof o !== "object" || o === null) throw Error("Invalid choice.");
      const x = o as Record<string, unknown>;
      if (
        typeof x.value !== "string" ||
        x.value.length < 1 ||
        x.value.length > 128 ||
        choices.has(x.value) ||
        typeof x.label !== "string" ||
        x.label.length < 1 ||
        x.label.length > 500
      )
        throw Error("Invalid choice.");
      choices.add(x.value);
      return { value: x.value, label: x.label };
    });
    if (!choices.has(v.answer)) throw Error("Answer key must name an offered choice.");
    return { id: v.id, prompt: v.prompt, options, answer: v.answer };
  });
}
export function gradeReviewedQuestions(
  questions: readonly ReviewedQuestion[],
  answers: Readonly<Record<string, string>>,
): boolean {
  if (
    Object.keys(answers).some((id) => !questions.some((q) => q.id === id)) ||
    questions.some((q) => !q.options.some((o) => o.value === answers[q.id]))
  )
    throw Error("Select one offered answer for every question.");
  return questions.every((q) => answers[q.id] === q.answer);
}
