import {
  canNavigateToExternalReference,
  canUseForNewWork,
  renderableContentPayload,
  validateProblemManifest,
  type ExternalReference,
  type ProblemContentVersion,
  type ProblemManifest,
} from "@algocove/domain";

export type ContentWorkflowReadModel = {
  readonly candidateId: string;
  readonly title: string;
  readonly lifecycleLabel: string;
  readonly provenanceLabel: string;
  readonly rightsLabel: string;
  readonly reviewRows: readonly {
    readonly kind: "technical" | "pedagogical";
    readonly label: string;
    readonly status: "approved" | "rejected" | "pending";
    readonly reviewer: string;
  }[];
  readonly validationLabel: string;
  readonly languageRows: readonly {
    readonly language: string;
    readonly adapterId: string;
    readonly fixtureCount: number;
  }[];
  readonly publicationStatus: "fixture_only_blocked" | "blocked";
  readonly publicationBlockers: readonly string[];
  readonly timeline: readonly {
    readonly label: string;
    readonly status: "complete" | "blocked";
  }[];
  readonly internalPreview: { readonly title: string; readonly statement: string } | null;
  readonly externalReference: {
    readonly provider: string;
    readonly title: string;
    readonly url: string;
    readonly attribution: string;
    readonly statusLabel: string;
    readonly canNavigate: boolean;
  };
};

function latestReview(
  candidate: ProblemContentVersion,
  kind: "technical" | "pedagogical",
): ProblemContentVersion["reviews"][number] | undefined {
  return [...candidate.reviews].reverse().find((review) => review.kind === kind);
}

export function buildContentWorkflowReadModel(input: {
  readonly candidate: ProblemContentVersion;
  readonly manifest: ProblemManifest;
  readonly externalReference: ExternalReference;
}): ContentWorkflowReadModel {
  const { candidate, manifest, externalReference } = input;
  const technical = latestReview(candidate, "technical");
  const pedagogical = latestReview(candidate, "pedagogical");
  const manifestValidation = validateProblemManifest(manifest);
  const blockers: string[] = [];
  if (technical?.decision !== "approved") blockers.push("Technical review approval is required.");
  if (pedagogical?.decision !== "approved")
    blockers.push("Pedagogical review approval is required.");
  if (candidate.validation.status !== "passed") blockers.push("Content validation must pass.");
  if (!manifestValidation.ok)
    blockers.push(`Language manifest: ${manifestValidation.error.message}`);
  if (!canNavigateToExternalReference(externalReference))
    blockers.push("External link review is required.");
  if (!canUseForNewWork(candidate, candidate.createdAt))
    blockers.push("The draft is not eligible for learner recommendations.");
  blockers.push("Runnable publication is blocked until Task 23 execution conformance is complete.");
  const payload = renderableContentPayload(candidate);
  return {
    candidateId: candidate.problemVersionId,
    title: candidate.title,
    lifecycleLabel: candidate.status === "draft" ? "Draft candidate" : candidate.status,
    provenanceLabel:
      candidate.provenance.kind === "original"
        ? "Original AlgoCove content"
        : "Licensed metadata only",
    rightsLabel: `${candidate.provenance.rightsHolder} · ${candidate.provenance.license}`,
    reviewRows: [
      {
        kind: "technical",
        label: "Technical review",
        status: technical?.decision ?? "pending",
        reviewer: technical?.reviewerId ?? "Not assigned",
      },
      {
        kind: "pedagogical",
        label: "Pedagogical review",
        status: pedagogical?.decision ?? "pending",
        reviewer: pedagogical?.reviewerId ?? "Not assigned",
      },
    ],
    validationLabel:
      candidate.validation.status === "passed" ? "Passed" : candidate.validation.status,
    languageRows: manifest.languages.map((language) => ({
      language: language.language,
      adapterId: language.adapterId,
      fixtureCount: language.fixtureIds.length,
    })),
    publicationStatus: "fixture_only_blocked",
    publicationBlockers: blockers,
    timeline: [
      { label: "Draft created", status: "complete" },
      {
        label: "Technical review recorded",
        status: technical?.decision === "approved" ? "complete" : "blocked",
      },
      {
        label: "Pedagogical review recorded",
        status: pedagogical?.decision === "approved" ? "complete" : "blocked",
      },
      {
        label: "Metadata validation passed",
        status: candidate.validation.status === "passed" ? "complete" : "blocked",
      },
      { label: "Runnable publication", status: "blocked" },
    ],
    internalPreview: payload,
    externalReference: {
      provider: externalReference.provider,
      title: externalReference.title,
      url: externalReference.canonicalUrl,
      attribution: externalReference.attribution,
      statusLabel:
        externalReference.urlStatus === "reviewed" ? "Reviewed link" : externalReference.urlStatus,
      canNavigate: canNavigateToExternalReference(externalReference),
    },
  };
}
