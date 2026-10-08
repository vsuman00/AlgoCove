import { safeReturnTo } from "../../../src/auth/return-target";
import { validateCatalogSlug } from "@algocove/application";
import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import AlgoCoveShell from "../../../src/components/shell/algocove-shell";
import ProblemWorkspace from "../../../src/components/practice/problem-workspace";

export default async function ProblemWorkspacePage({
  params,
  searchParams,
}: {
  readonly searchParams: Promise<{
    readonly language?: string;
    readonly returnTo?: string;
    readonly attemptId?: string;
  }>;
  readonly params: Promise<{ readonly problemId: string }>;
}): Promise<ReactElement> {
  const { problemId } = await params;
  const { language, returnTo, attemptId } = await searchParams;
  const initialLanguage =
    language === "javascript" ||
    language === "typescript" ||
    language === "java" ||
    language === "cpp" ||
    language === "c"
      ? language
      : "python";
  try {
    validateCatalogSlug(problemId);
  } catch {
    notFound();
  }

  return (
    <AlgoCoveShell active="Home" focused>
      <ProblemWorkspace
        key={problemId}
        executionEnabled={process.env.EXECUTION_ENABLED === "true"}
        problemId={problemId}
        initialLanguage={initialLanguage}
        returnTo={safeReturnTo(returnTo)}
        initialAttemptId={
          attemptId && /^att_[0-9a-hjkmnp-tv-z]{16,52}$/.test(attemptId) ? attemptId : undefined
        }
      />
    </AlgoCoveShell>
  );
}
