"use client";

import { Show, SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";
import { useEffect, useRef, type ReactElement } from "react";
import { useAppSession } from "./staff-navigation";

const focusRing =
  "focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-[var(--focus-ring-offset)]";
const secondaryControl = `inline-flex min-h-10 items-center justify-center rounded-cove-sm border border-cove-strong bg-cove-surface px-3 py-2 text-cove-body-sm font-semibold text-cove-primary no-underline hover:border-cove-link ${focusRing}`;
const primaryControl = `inline-flex min-h-10 items-center justify-center rounded-cove-sm border border-transparent bg-cove-action-primary px-3 py-2 text-cove-body-sm font-semibold text-cove-on-dark no-underline hover:bg-cove-action-primary-hover ${focusRing}`;

/** Clerk's interactive account controls for a configured application. */
export default function AuthControls(): ReactElement {
  const { isLoaded, user } = useUser();
  const reload = useAppSession()?.reload;
  const previousIdentity = useRef<string | null | undefined>(undefined);
  const identity = user?.id ?? null;
  useEffect(() => {
    if (!isLoaded || previousIdentity.current === identity) return;
    previousIdentity.current = identity;
    reload?.();
  }, [isLoaded, identity, reload]);
  return (
    <div className="flex items-center gap-2 border-l border-cove-default pl-3 sm:gap-3 sm:pl-4">
      <Show when="signed-out">
        <SignInButton mode="redirect">
          <button className={secondaryControl} type="button">
            Sign in
          </button>
        </SignInButton>
        <SignUpButton mode="redirect">
          <button className={`${primaryControl} max-md:hidden`} type="button">
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
