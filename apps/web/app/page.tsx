import type { ReactElement } from "react";
import AlgoCoveShell from "../src/components/algocove-shell";
import HomeExperience from "../src/components/home-experience";

export default function HomePage(): ReactElement {
  return (
    <AlgoCoveShell active="Home">
      <HomeExperience />
    </AlgoCoveShell>
  );
}
