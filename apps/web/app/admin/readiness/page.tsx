import type { ReactElement } from "react";
import AlgoCoveShell from "../../../src/components/algocove-shell";
import ReadinessContent from "../../../src/components/readiness-content";
export default function ReadinessContentPage(): ReactElement {
  return (
    <AlgoCoveShell active="Content">
      <ReadinessContent />
    </AlgoCoveShell>
  );
}
