import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import AlgoCoveShell from "../../../src/components/algocove-shell";
import ProblemWorkspace from "../../../src/components/problem-workspace";

export default async function ProblemWorkspacePage({
  params,
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly language?: string }>;
  readonly params: Promise<{ readonly problemId: string }>;
}): Promise<ReactElement> {
  const { problemId } = await params;
  const { language } = await searchParams;
  const initialLanguage =
    language === "javascript" ||
    language === "typescript" ||
    language === "java" ||
    language === "cpp" ||
    language === "c"
      ? language
      : "python";
  if (problemId !== "arrays-two-pointer") notFound();

  return (
    <AlgoCoveShell active="Home" focused>
      <ProblemWorkspace
        executionEnabled={process.env.EXECUTION_ENABLED === "true"}
        problemId={problemId}
        initialLanguage={initialLanguage}
      />
    </AlgoCoveShell>
  );
}
