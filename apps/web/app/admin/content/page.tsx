import type { ReactElement } from "react";
import AlgoCoveShell from "../../../src/components/algocove-shell";
import ContentOperations from "../../../src/components/content-operations";
export default function ContentOperationsPage(): ReactElement {
  return (
    <AlgoCoveShell active="Content">
      <ContentOperations />
    </AlgoCoveShell>
  );
}
