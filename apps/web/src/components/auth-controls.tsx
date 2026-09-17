"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import type { ReactElement } from "react";

const focusRing =
  "focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-[var(--focus-ring-offset)]";
const secondaryControl = `inline-flex min-h-10 items-center justify-center rounded-cove-sm border border-cove-strong bg-cove-surface px-3 py-2 text-cove-body-sm font-semibold text-cove-primary no-underline hover:border-cove-link ${focusRing}`;
const primaryControl = `inline-flex min-h-10 items-center justify-center rounded-cove-sm border border-transparent bg-cove-action-primary px-3 py-2 text-cove-body-sm font-semibold text-cove-on-dark no-underline hover:bg-cove-action-primary-hover ${focusRing}`;

/** Clerk's interactive account controls for a configured application. */
export default function AuthControls(): ReactElement {
  return (
    <div className="flex items-center gap-2 border-l border-cove-default pl-3 sm:gap-3 sm:pl-4">
      <Show when="signed-out">
        <SignInButton mode="redirect">
          <button className={secondaryControl} type="button">
            Sign in
          </button>
        </SignInButton>
        <SignUpButton mode="redirect">
          <button className={`${primaryControl} hidden sm:inline-flex`} type="button">
            Create account
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </div>
  );
}
