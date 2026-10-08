import type { ReactElement } from "react";
import { validateCatalogSlug } from "@algocove/application";
import { notFound } from "next/navigation";
import AlgoCoveShell from "../../../../src/components/shell/algocove-shell";
import LearningDiscovery from "../../../../src/components/learning/learning-discovery";
export default async function Topic({
  params,
}: {
  params: Promise<{ pattern: string }>;
}): Promise<ReactElement> {
  const { pattern } = await params;
  try {
    validateCatalogSlug(pattern);
  } catch {
    notFound();
  }
  return (
    <AlgoCoveShell active="Curriculum">
      <LearningDiscovery pattern={pattern} />
    </AlgoCoveShell>
  );
}
