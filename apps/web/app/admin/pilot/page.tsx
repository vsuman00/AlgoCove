import type { ReactElement } from "react";
import AlgoCoveShell from "../../../src/components/shell/algocove-shell";
import PilotOperations from "../../../src/components/staff/pilot-operations";
export default function PilotPage(): ReactElement {
  return (
    <AlgoCoveShell active="Content">
      <PilotOperations />
    </AlgoCoveShell>
  );
}
