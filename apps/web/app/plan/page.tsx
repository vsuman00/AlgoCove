import type { ReactElement } from "react";
import AlgoCoveShell from "../../src/components/algocove-shell";
import PlanningPreferences from "../../src/components/planning-preferences";
export default function PlanPage(): ReactElement {
  return (
    <AlgoCoveShell active="Planning">
      <PlanningPreferences />
    </AlgoCoveShell>
  );
}
