import type { ReactElement } from "react";
import AlgoCoveShell from "../src/components/shell/algocove-shell";
export default function NotFound(): ReactElement {
  return (
    <AlgoCoveShell>
      <main className="ac-home-main" id="main-content" tabIndex={-1}>
        <p className="ac-eyebrow">Page not found</p>
        <h1>This page is not available.</h1>
        <p>Return to Home to find your next learning activity.</p>
        <a className="ac-button ac-button--primary" href="/">
          Go to Home
        </a>
      </main>
    </AlgoCoveShell>
  );
}
