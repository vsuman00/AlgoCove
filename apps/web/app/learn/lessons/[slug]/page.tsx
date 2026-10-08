import type { ReactElement } from "react";
import { resolvePublishedProblem } from "@algocove/application";
import {
  PostgresLearningCatalogRepository,
  PostgresLearningReleaseRepository,
  withTransaction,
} from "@algocove/db";
import Link from "next/link";
import AlgoCoveShell from "../../../../src/components/shell/algocove-shell";
import LearningBrief from "../../../../src/components/learning/learning-brief";
import { getPracticeRuntime } from "../../../../src/practice/runtime";
import { LEGACY_LEARNING_VIEW } from "../../../../src/practice/learning-workspace-adapters";
export const dynamic = "force-dynamic";
export default async function Lesson({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<ReactElement> {
  const { slug } = await params;
  let title = "Concept lesson",
    learning = null,
    href = null;
  try {
    const runtime = getPracticeRuntime();
    if (runtime) {
      const p = await resolvePublishedProblem(
        new PostgresLearningCatalogRepository(runtime.pool),
        slug,
      );
      title = p.title;
      learning =
        p.slug === "arrays-two-pointer"
          ? LEGACY_LEARNING_VIEW
          : await withTransaction(
              runtime.pool,
              (tx) => new PostgresLearningReleaseRepository(tx).publicView(p.problemVersionId),
              { readOnly: true, statementTimeoutMs: 5000 },
            );
      href = `/learn/${p.slug}`;
    }
  } catch {
    /* Unavailable releases have no start action. */
  }
  return (
    <AlgoCoveShell active="Curriculum">
      <main id="main-content" tabIndex={-1} className="ac-home-main">
        <h1>{title}</h1>
        <LearningBrief learning={learning} />
        {href && learning && <Link href={href}>Continue to guided problem</Link>}
        <p>
          <Link href="/learn">Return to Learn</Link>
        </p>
      </main>
    </AlgoCoveShell>
  );
}
