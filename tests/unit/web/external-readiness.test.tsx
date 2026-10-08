import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ExternalReadiness from "../../../apps/web/src/components/readiness/external-readiness";
import type { ExternalReadinessDecision } from "@algocove/domain";
const ready: ExternalReadinessDecision = {
  status: "ready",
  rubricId: "fixture",
  rubricVersion: 1,
  reasons: [],
  evidenceIds: [],
  bypassAvailable: false,
};
describe("external preparation panel", () => {
  it("requires authentication/synchronization and renders missing reasons without a provider link", async () => {
    const evaluate = vi.fn().mockResolvedValue({
      ...ready,
      status: "not_ready",
      reasons: [{ code: "rubric_unavailable", message: "A published rubric is required." }],
    });
    const { rerender } = render(
      <ExternalReadiness enabled={false} revisionKey="1" evaluate={evaluate} />,
    );
    expect(screen.getByRole("button")).toBeDisabled();
    rerender(<ExternalReadiness enabled revisionKey="1" evaluate={evaluate} />);
    fireEvent.click(screen.getByRole("button"));
    await screen.findByText("A published rubric is required.");
    expect(screen.queryByRole("link")).toBeNull();
  });
  it("discards an in-flight decision when current work changes", async () => {
    let resolve!: (decision: ExternalReadinessDecision) => void;
    const evaluate = () =>
      new Promise<ExternalReadinessDecision>((r) => {
        resolve = r;
      });
    const { rerender } = render(<ExternalReadiness enabled revisionKey="1" evaluate={evaluate} />);
    fireEvent.click(screen.getByRole("button"));
    rerender(<ExternalReadiness enabled revisionKey="2" evaluate={evaluate} />);
    resolve(ready);
    await waitFor(() =>
      expect(screen.getByText("Save your current work, then check preparation.")).toBeVisible(),
    );
    expect(screen.queryByText(/Internal preparation is ready/)).toBeNull();
  });
  it("offers retry after a failed evaluation", async () => {
    const evaluate = vi.fn().mockRejectedValueOnce(Error("offline")).mockResolvedValue(ready);
    render(<ExternalReadiness enabled revisionKey="1" evaluate={evaluate} />);
    fireEvent.click(screen.getByRole("button"));
    await screen.findByText("Preparation could not be checked. Try again.");
    fireEvent.click(screen.getByRole("button"));
    await screen.findByText(
      "Internal preparation is ready. External navigation is not yet available.",
    );
  });
});
