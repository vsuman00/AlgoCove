import type { ReactElement } from "react";
import AlgoCoveShell from "../../src/components/shell/algocove-shell";
import LearningDiscovery from "../../src/components/learning/learning-discovery";
export default function Sheets(): ReactElement {
  return (
    <AlgoCoveShell active="Sheets">
      <LearningDiscovery kind="sheets" />
    </AlgoCoveShell>
  );
}
