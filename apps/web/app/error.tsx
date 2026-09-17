"use client";

import type { ReactElement } from "react";

const focusRing =
  "focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-[var(--focus-ring-offset)]";

export default function GlobalError({ reset }: { readonly reset: () => void }): ReactElement {
  return (
    <main
      className="mx-auto w-[calc(100%-48px)] max-w-[680px] py-[15vh] max-md:w-[calc(100%-32px)]"
      aria-labelledby="error-title"
    >
      <p className="mb-3 text-cove-label font-semibold uppercase tracking-[0.08em] text-cove-link">
        Something went wrong
      </p>
      <h1
        id="error-title"
        className="mb-5 max-w-[12ch] font-cove-display text-cove-display font-semibold"
      >
        This page needs another try.
      </h1>
      <p className="mb-6 max-w-[55ch] text-cove-body-lg text-cove-body">
        Nothing was changed. Try loading the page again, or return to the home screen.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          className={`inline-flex min-h-11 items-center justify-center rounded-cove-sm border border-transparent bg-cove-action-primary px-4 py-3 font-semibold text-cove-on-dark hover:bg-cove-action-primary-hover ${focusRing}`}
          type="button"
          onClick={reset}
        >
          Try again
        </button>
        <a
          className={`inline-flex min-h-11 items-center justify-center rounded-cove-sm border border-cove-strong bg-cove-surface px-4 py-3 font-semibold text-cove-primary no-underline hover:border-cove-link ${focusRing}`}
          href="/"
        >
          Go home
        </a>
      </div>
    </main>
  );
}
