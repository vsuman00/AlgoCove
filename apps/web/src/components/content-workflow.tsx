import type { ReactElement } from "react";
import type { ContentWorkflowReadModel } from "@algocove/application";

const focusRing =
  "focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-[var(--focus-ring-offset)]";

export function WorkflowStatus({
  model,
}: {
  readonly model: ContentWorkflowReadModel;
}): ReactElement {
  return (
    <section
      className="grid gap-6 border-l-2 border-cove-link bg-cove-surface p-5"
      aria-labelledby="publication-title"
    >
      <div>
        <p className="mb-2 text-cove-label font-semibold uppercase tracking-[0.08em] text-cove-link">
          Fixture-only gate
        </p>
        <h2 id="publication-title" className="mb-2 font-cove-display text-cove-h2 font-semibold">
          Runnable publication is blocked
        </h2>
        <p className="max-w-[68ch] text-cove-body-sm text-cove-secondary">
          This preview proves the governed authoring path. It cannot publish runnable code until the
          isolated execution conformance gate in Task 23 is complete.
        </p>
      </div>
      <ul className="m-0 grid gap-2 p-0 text-cove-body-sm" aria-label="Publication blockers">
        {model.publicationBlockers.map((blocker) => (
          <li className="list-inside list-disc" key={blocker}>
            {blocker}
          </li>
        ))}
      </ul>
      <button
        className={`inline-flex min-h-11 w-fit items-center rounded-cove-sm border border-cove-strong px-4 py-3 font-semibold text-cove-secondary ${focusRing}`}
        type="button"
        disabled
        aria-describedby="publication-title"
      >
        Publish fixture (locked)
      </button>
    </section>
  );
}

export function WorkflowTimeline({
  model,
}: {
  readonly model: ContentWorkflowReadModel;
}): ReactElement {
  return (
    <section className="grid gap-4" aria-labelledby="timeline-title">
      <h2 id="timeline-title" className="font-cove-display text-cove-h2 font-semibold">
        Workflow evidence
      </h2>
      <ol className="m-0 grid gap-3 border-l border-cove-strong pl-5">
        {model.timeline.map((event) => (
          <li className="relative grid gap-1" key={event.label}>
            <span
              className="absolute -left-[25px] top-1 size-2 rounded-full bg-cove-link"
              aria-hidden="true"
            />
            <span className="font-semibold text-cove-primary">{event.label}</span>
            <span className="text-cove-meta text-cove-secondary">
              {event.status === "complete" ? "Recorded" : "Blocked by a phase gate"}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ReviewTable({ model }: { readonly model: ContentWorkflowReadModel }): ReactElement {
  return (
    <section className="grid gap-4" aria-labelledby="review-title">
      <h2 id="review-title" className="font-cove-display text-cove-h2 font-semibold">
        Separated reviews
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {model.reviewRows.map((review) => (
          <article
            className="grid gap-2 border border-cove-default bg-cove-surface p-4"
            key={review.kind}
          >
            <h3 className="font-semibold">{review.label}</h3>
            <p className="m-0 text-cove-body-sm text-cove-secondary">
              {review.status === "approved" ? "Approved" : review.status}
            </p>
            <code className="break-all font-cove-mono text-cove-meta text-cove-secondary">
              {review.reviewer}
            </code>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ManifestPanel({
  model,
}: {
  readonly model: ContentWorkflowReadModel;
}): ReactElement {
  return (
    <section className="grid gap-4" aria-labelledby="manifest-title">
      <div>
        <h2 id="manifest-title" className="font-cove-display text-cove-h2 font-semibold">
          Language manifest
        </h2>
        <p className="mt-2 text-cove-body-sm text-cove-secondary">
          One semantic fixture set mapped to six explicit harness adapters.
        </p>
      </div>
      <ul
        className="m-0 grid gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Language support"
      >
        {model.languageRows.map((language) => (
          <li className="grid gap-1 border border-cove-default p-3" key={language.language}>
            <span className="font-semibold">{language.language}</span>
            <code className="font-cove-mono text-cove-meta text-cove-secondary">
              {language.adapterId}
            </code>
            <span className="text-cove-meta text-cove-secondary">
              {language.fixtureCount} shared fixtures
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
