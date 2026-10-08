import type { ReactElement } from "react";
import AlgoCoveShell from "../../../src/components/shell/algocove-shell";
import PrivacySettings from "../../../src/components/account/privacy-settings";
import { isClerkConfigured } from "../../../src/auth/clerk-config";
export const dynamic = "force-dynamic";
export default function PrivacyPage(): ReactElement {
  return (
    <AlgoCoveShell active="Privacy">
      <main id="main-content" className="mx-auto grid w-full max-w-4xl gap-6 p-6">
        <h1>Data and privacy</h1>
        <PrivacySettings clerkConfigured={isClerkConfigured()} />
      </main>
    </AlgoCoveShell>
  );
}
