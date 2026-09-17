import type { ReactElement } from "react";

const principles = [
  "Understand the idea before reaching for a solution.",
  "Practice in small, observable steps.",
  "Return to important concepts over time.",
];

const focusRing =
  "focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-[var(--focus-ring-offset)]";

export default function HomePage(): ReactElement {
  return (
    <div className="grid min-h-svh grid-rows-[auto_1fr_auto] bg-cove-page" data-shell="quiet-home">
      <a
        className={`absolute left-2 top-2 z-10 -translate-y-[160%] rounded-cove-sm bg-cove-surface px-3 py-2 text-cove-primary transition-transform focus:translate-y-0 ${focusRing}`}
        href="#main-content"
      >
        Skip to content
      </a>
      <header className="mx-auto flex min-h-16 w-[calc(100%-48px)] max-w-[1180px] items-center justify-between border-b border-cove-default max-md:min-h-14 max-md:w-[calc(100%-32px)]">
        <a
          className={`flex items-center gap-2 font-semibold no-underline ${focusRing}`}
          href="/"
          aria-label="AlgoCove home"
        >
          <span
            className="grid size-8 place-items-center rounded-cove-sm bg-cove-action-primary font-cove-mono text-cove-meta text-cove-on-dark tracking-[-0.08em]"
            aria-hidden="true"
          >
            AC
          </span>
          <span>AlgoCove</span>
        </a>
        <nav
          className="flex items-center gap-5 text-cove-body-sm text-cove-secondary"
          aria-label="Primary navigation"
        >
          <a
            className={`hidden no-underline hover:text-cove-primary md:inline ${focusRing}`}
            href="#how-it-works"
          >
            How it works
          </a>
          <a className={`no-underline hover:text-cove-primary ${focusRing}`} href="/api/health">
            System status
          </a>
        </nav>
      </header>

      <main
        id="main-content"
        className="mx-auto grid w-[calc(100%-48px)] max-w-[1180px] content-center gap-[clamp(48px,12vw,160px)] py-[clamp(48px,10vw,120px)] max-md:w-[calc(100%-32px)]"
      >
        <section className="max-w-[760px]" aria-labelledby="page-title">
          <p className="mb-3 text-cove-label font-semibold uppercase tracking-[0.08em] text-cove-link">
            A quieter way to learn DSA
          </p>
          <h1
            id="page-title"
            className="mb-5 max-w-[12ch] font-cove-display text-cove-display font-semibold text-cove-primary"
          >
            Build understanding that lasts.
          </h1>
          <p className="mb-6 max-w-[68ch] text-cove-body-lg text-cove-body">
            AlgoCove is a guided workspace for learning data structures and algorithms through
            deliberate practice, useful feedback, and well-timed review.
          </p>
          <div className="flex flex-wrap items-center gap-3" aria-label="Next steps">
            <a
              className={`inline-flex min-h-11 items-center justify-center rounded-cove-sm border border-transparent bg-cove-action-primary px-4 py-3 font-semibold text-cove-on-dark no-underline hover:bg-cove-action-primary-hover ${focusRing}`}
              href="#how-it-works"
            >
              See the approach
            </a>
            <a
              className={`inline-flex min-h-11 items-center justify-center rounded-cove-sm border border-cove-strong bg-cove-surface px-4 py-3 font-semibold text-cove-primary no-underline hover:border-cove-link ${focusRing}`}
              href="/api/readiness"
            >
              Check readiness
            </a>
          </div>
        </section>

        <section
          id="how-it-works"
          className="grid grid-cols-1 gap-12 border-t border-cove-default py-8 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.2fr)]"
          aria-labelledby="principles-title"
        >
          <div>
            <p className="mb-3 text-cove-label font-semibold uppercase tracking-[0.08em] text-cove-link">
              The learning loop
            </p>
            <h2
              id="principles-title"
              className="mb-5 max-w-[18ch] font-cove-display text-cove-h2 font-semibold"
            >
              Progress is more than a solved checkbox.
            </h2>
          </div>
          <ol className="m-0 grid list-none gap-4 p-0">
            {principles.map((principle, index) => (
              <li
                className="grid grid-cols-[44px_1fr] gap-3 border-b border-cove-default pb-4 text-cove-body-lg text-cove-body"
                key={principle}
              >
                <span
                  className="font-cove-mono text-cove-meta font-semibold text-cove-success"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{principle}</span>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="mx-auto flex min-h-16 w-[calc(100%-48px)] max-w-[1180px] items-center justify-between border-t border-cove-default text-cove-meta text-cove-secondary max-md:min-h-20 max-md:w-[calc(100%-32px)] max-md:flex-col max-md:items-start max-md:justify-center max-md:gap-1">
        <span>Designed for focused practice.</span>
        <span>Local foundation in progress.</span>
      </footer>
    </div>
  );
}
