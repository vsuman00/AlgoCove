import type { ReactElement } from "react";
import AlgoCoveShell from "../../src/components/shell/algocove-shell";
import { ReviewExperience } from "../../src/components/learning/learning-views";
export default function Page(): ReactElement {
  return (
    <AlgoCoveShell active="Reviews">
      <ReviewExperience />
    </AlgoCoveShell>
  );
}
