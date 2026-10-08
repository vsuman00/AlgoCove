import type { ReactElement } from "react";
import AlgoCoveShell from "../../../src/components/shell/algocove-shell";
import ContentOperations from "../../../src/components/staff/content-operations";
export default function ContentOperationsPage(): ReactElement {
  return (
    <AlgoCoveShell active="Content">
      <ContentOperations />
    </AlgoCoveShell>
  );
}
