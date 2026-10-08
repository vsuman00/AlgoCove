import type { ReactElement } from "react";
import AlgoCoveShell from "../../../../src/components/shell/algocove-shell";
import ContentOperations from "../../../../src/components/staff/content-operations";
export default async function ContentWorkflowPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const { id } = await params;
  return (
    <AlgoCoveShell active="Content">
      <ContentOperations id={id} />
    </AlgoCoveShell>
  );
}
