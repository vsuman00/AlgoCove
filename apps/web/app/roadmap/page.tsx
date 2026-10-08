import type { ReactElement } from "react";
import AlgoCoveShell from "../../src/components/shell/algocove-shell";
import PlanningPreferences from "../../src/components/planning/planning-preferences";

export default function RoadmapPage(): ReactElement {
  return (
    <AlgoCoveShell active="Planning">
      <PlanningPreferences />
    </AlgoCoveShell>
  );
}
