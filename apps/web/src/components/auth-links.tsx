import type { ReactElement } from "react";

const focusRing =
  "focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-[var(--focus-ring-offset)]";
const secondaryControl = `inline-flex min-h-10 items-center justify-center rounded-cove-sm border border-cove-strong bg-cove-surface px-3 py-2 text-cove-body-sm font-semibold text-cove-primary no-underline hover:border-cove-link ${focusRing}`;
const primaryControl = `inline-flex min-h-10 items-center justify-center rounded-cove-sm border border-transparent bg-cove-action-primary px-3 py-2 text-cove-body-sm font-semibold text-cove-on-dark no-underline hover:bg-cove-action-primary-hover ${focusRing}`;

/** Non-interactive fallback links used when local Clerk keys are not configured. */
export default function AuthLinks(): ReactElement {
  return (
    <div className="flex items-center gap-2 border-l border-cove-default pl-3 sm:gap-3 sm:pl-4">
      <a className={secondaryControl} href="/sign-in">
        Sign in
      </a>
      <a className={`${primaryControl} hidden sm:inline-flex`} href="/sign-up">
        Create account
      </a>
    </div>
  );
}
