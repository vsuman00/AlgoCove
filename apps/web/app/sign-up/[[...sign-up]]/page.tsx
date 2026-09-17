import { SignUp } from "@clerk/nextjs";
import type { ReactElement } from "react";
import { isClerkConfigured } from "../../../src/auth/clerk-config";
import AlgoCoveMark from "../../../src/components/algocove-mark";
import ClerkConnectionStatus from "../../../src/components/clerk-connection-status";

function ClerkSetupNotice(): ReactElement {
  return (
    <section
      className="w-full max-w-[480px] rounded-cove-sm border border-cove-default bg-cove-surface p-6 text-center"
      aria-labelledby="clerk-setup-title"
    >
      <h1 id="clerk-setup-title" className="mb-3 font-cove-display text-cove-h2 font-semibold">
        Authentication is not configured.
      </h1>
      <p className="text-cove-body text-cove-secondary">
        Add the Clerk publishable and secret keys to your local environment, then reload AlgoCove.
      </p>
    </section>
  );
}

export default function SignUpPage(): ReactElement {
  const clerkConfigured = isClerkConfigured();
  return (
    <main className="ac-auth-page">
      <a href="/" aria-label="AlgoCove home">
        <AlgoCoveMark />
      </a>
      <ClerkConnectionStatus configured={clerkConfigured} />
      {clerkConfigured ? (
        <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" />
      ) : (
        <ClerkSetupNotice />
      )}
    </main>
  );
}
