import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { phase3ContentFixture } from "../../../../src/content-fixtures";
import {
  ManifestPanel,
  ReviewTable,
  WorkflowStatus,
  WorkflowTimeline,
} from "../../../../src/components/content-workflow";
import AlgoCoveShell from "../../../../src/components/algocove-shell";

const focusRing =
  "focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-[var(--focus-ring-offset)]";

export default async function ContentWorkflowPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const { id } = await params;
  const model = phase3ContentFixture();
  if (id !== model.candidateId) notFound();
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
            href="/admin/content"
          >
            Back to content operations
          </Link>
          <div className="grid gap-3">
            <p className="text-cove-label font-semibold uppercase tracking-[0.08em] text-cove-link">
              Candidate workflow
            </p>
            <h1 className="font-cove-display text-cove-display font-semibold text-cove-primary">
              {model.title}
            </h1>
            <p className="max-w-[68ch] text-cove-body-lg text-cove-body">
              {model.provenanceLabel}. {model.rightsLabel}.
            </p>
            <code className="break-all font-cove-mono text-cove-meta text-cove-secondary">
              Problem version: {model.candidateId}
            </code>
          </div>
        </header>
        <WorkflowStatus model={model} />
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <WorkflowTimeline model={model} />
          <ReviewTable model={model} />
        </div>
        <ManifestPanel model={model} />
        <div className="grid gap-6 border-t border-cove-default pt-8 lg:grid-cols-2">
          <section className="grid gap-3" aria-labelledby="internal-preview-title">
            <h2
              id="internal-preview-title"
              className="font-cove-display text-cove-h2 font-semibold"
            >
              Original internal preview
            </h2>
            <p className="m-0 text-cove-body-sm text-cove-secondary">
              Rendered as authored text from the original candidate. It is not runnable until Task
              23.
            </p>
            {model.internalPreview === null ? (
              <p className="text-cove-secondary">Payload unavailable.</p>
            ) : (
              <div className="border border-cove-default bg-cove-surface p-4">
                <h3 className="mb-2 font-semibold">{model.internalPreview.title}</h3>
                <p className="m-0 text-cove-body-sm text-cove-body">
                  {model.internalPreview.statement}
                </p>
              </div>
            )}
          </section>
          <section className="grid content-start gap-3" aria-labelledby="external-reference-title">
            <h2
              id="external-reference-title"
              className="font-cove-display text-cove-h2 font-semibold"
            >
              Outbound source reference
            </h2>
            <p className="m-0 text-cove-body-sm text-cove-secondary">
              Metadata only. AlgoCove does not copy or submit third-party content.
            </p>
            <div className="border border-cove-default bg-cove-surface p-4">
              <p className="mb-2 font-semibold">{model.externalReference.title}</p>
              <p className="mb-3 text-cove-body-sm text-cove-secondary">
                {model.externalReference.provider} · {model.externalReference.attribution} ·{" "}
                {model.externalReference.statusLabel}
              </p>
              {model.externalReference.canNavigate ? (
                <a
                  className={`text-cove-body-sm text-cove-link underline ${focusRing}`}
                  href={model.externalReference.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open reviewed source
                </a>
              ) : (
                <span className="text-cove-body-sm text-cove-secondary">Link unavailable</span>
              )}
            </div>
          </section>
        </div>
      </main>
    </AlgoCoveShell>
  );
}
