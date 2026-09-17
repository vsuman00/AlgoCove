import { SignIn } from "@clerk/nextjs";
import type { ReactElement } from "react";
import { isClerkConfigured } from "../../../src/auth/clerk-config";

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

export default function SignInPage(): ReactElement {
  return (
    <main className="grid min-h-svh place-items-center bg-cove-page p-6">
      {isClerkConfigured() ? (
        <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" />
      ) : (
        <ClerkSetupNotice />
      )}
    </main>
  );
}
