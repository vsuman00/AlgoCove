import type { ReactElement } from "react";

export default function ClerkConnectionStatus({
  configured,
}: {
  readonly configured: boolean;
}): ReactElement {
  return (
    <div
      className="flex w-full max-w-[480px] items-start gap-3 rounded-cove-sm border border-cove-default bg-cove-surface px-4 py-3 text-left text-cove-body-sm"
      role="status"
    >
      <span
        aria-hidden="true"
        className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${configured ? "bg-emerald-600" : "bg-amber-500"}`}
      />
      <span className="grid gap-1">
        <strong className="font-semibold text-cove-primary">
          {configured ? "Clerk authentication connected" : "Clerk connection required"}
        </strong>
        <span className="text-cove-secondary">
          {configured
            ? "This local environment is connected to Clerk for sign-up, sign-in, and session handling."
            : "Add the Clerk publishable and secret keys to the local environment, then reload AlgoCove."}
        </span>
      </span>
    </div>
  );
}
