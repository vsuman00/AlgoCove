import type { ReactElement } from "react";
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
  if (problemId !== "arrays-two-pointer") {
    return (
      <AlgoCoveShell active="Home">
        <main className="ac-home-main" id="main-content">
          <h1>Problem workspace unavailable</h1>
          <p>This problem has not been published into the internal learning loop.</p>
        </main>
      </AlgoCoveShell>
    );
  }
  return (
    <AlgoCoveShell active="Home">
      <ProblemWorkspace
        executionEnabled={process.env.EXECUTION_ENABLED === "true"}
        problemId={problemId}
        initialLanguage={initialLanguage}
      />
    </AlgoCoveShell>
  );
}
