import type { ReactElement } from "react";
import AlgoCoveShell from "../src/components/shell/algocove-shell";
import HomeExperience from "../src/components/home/home-experience";

export default function HomePage(): ReactElement {
  return (
    <AlgoCoveShell active="Home">
      <HomeExperience />
    </AlgoCoveShell>
  );
}
