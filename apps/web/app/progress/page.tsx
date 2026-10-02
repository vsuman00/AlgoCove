import type { ReactElement } from "react";
import AlgoCoveShell from "../../src/components/algocove-shell";
import { ProgressExperience } from "../../src/components/learning-views";
export default function Page(): ReactElement {
  return (
    <AlgoCoveShell active="Progress">
      <ProgressExperience />
    </AlgoCoveShell>
  );
}
