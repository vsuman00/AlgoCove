import type { ReactElement } from "react";
import AlgoCoveShell from "../../src/components/algocove-shell";
import { ReviewExperience } from "../../src/components/learning-views";
export default function Page(): ReactElement {
  return (
    <AlgoCoveShell active="Reviews">
      <ReviewExperience />
    </AlgoCoveShell>
  );
}
