import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import AlgoCoveShell from "../../../src/components/shell/algocove-shell";
import LearningDiscovery from "../../../src/components/learning/learning-discovery";
export default async function Sheet({
  params,
}: {
  params: Promise<{ sheetId: string }>;
}): Promise<ReactElement> {
  const { sheetId } = await params;
  if (!/^[a-z0-9._-]{1,128}$/.test(sheetId)) notFound();
  return (
    <AlgoCoveShell active="Sheets">
      <LearningDiscovery kind="sheets" sheetId={sheetId} />
    </AlgoCoveShell>
  );
}
