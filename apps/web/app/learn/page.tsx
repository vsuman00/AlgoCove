import type { ReactElement } from "react";
import AlgoCoveShell from "../../src/components/shell/algocove-shell";
import LearningDiscovery from "../../src/components/learning/learning-discovery";
export default function LearnPage(): ReactElement {
  return (
    <AlgoCoveShell active="Curriculum">
      <LearningDiscovery />
    </AlgoCoveShell>
  );
}
