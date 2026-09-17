import Link from "next/link";
import type { ReactElement } from "react";
import { phase3ContentFixture } from "../../../src/content-fixtures";
import AlgoCoveShell from "../../../src/components/algocove-shell";

const focusRing =
  "focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-[var(--focus-ring-offset)]";

export default function ContentOperationsPage(): ReactElement {
  const model = phase3ContentFixture();
  return (
    <AlgoCoveShell active="">
      <main
        id="main-content"
        tabIndex={-1}
        className="ac-form-page mx-auto grid min-h-svh w-[calc(100%-32px)] max-w-[1180px] gap-10 py-10 sm:w-[calc(100%-48px)] sm:py-16"
      >
        <header className="grid gap-5 border-b border-cove-default pb-8">
          <Link
            className={`w-fit text-cove-body-sm text-cove-link underline ${focusRing}`}
            href="/"
          >
            Back to home
          </Link>
          <div className="grid gap-3">
            <p className="text-cove-label font-semibold uppercase tracking-[0.08em] text-cove-link">
              Content operations
            </p>
            <h1 className="font-cove-display text-cove-display font-semibold text-cove-primary">
              Governed authoring preview.
            </h1>
            <p className="max-w-[68ch] text-cove-body-lg text-cove-body">
              A fixture-backed review queue that keeps authors, reviewers, publishers, rights, and
              execution gates visible.
            </p>
          </div>
        </header>
        <section className="grid gap-4" aria-labelledby="candidate-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-cove-label font-semibold uppercase tracking-[0.08em] text-cove-secondary">
                One candidate
              </p>
              <h2
                id="candidate-title"
                className="mt-2 font-cove-display text-cove-h2 font-semibold"
              >
                {model.title}
              </h2>
            </div>
            <span className="border border-cove-strong px-3 py-2 text-cove-body-sm font-semibold">
              {model.lifecycleLabel}
            </span>
          </div>
          <div className="grid gap-4 border border-cove-default bg-cove-surface p-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="grid gap-2 text-cove-body-sm">
              <span>{model.provenanceLabel}</span>
              <span className="text-cove-secondary">Rights: {model.rightsLabel}</span>
              <span className="text-cove-secondary">Validation: {model.validationLabel}</span>
            </div>
            <Link
              className={`inline-flex min-h-11 items-center justify-center rounded-cove-sm bg-cove-action-primary px-4 py-3 font-semibold text-cove-on-dark no-underline hover:bg-cove-action-primary-hover ${focusRing}`}
              href={`/admin/content/${model.candidateId}`}
            >
              Open workflow
            </Link>
          </div>
        </section>
        <aside
          className="border-l-2 border-cove-link pl-4 text-cove-body-sm text-cove-secondary"
          role="note"
        >
          This local preview contains one original fixture and one reviewed source link. It stores
          no third-party statement, solution, test, or credential.
        </aside>
      </main>
    </AlgoCoveShell>
  );
}
