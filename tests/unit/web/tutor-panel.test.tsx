import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import TutorPanel from "../../../apps/web/src/components/tutor-panel";

afterEach(() => vi.unstubAllGlobals());

it.each(["success", "failure"] as const)(
  "ignores a late cancellation %s after a newer tutor request completes",
  async (outcome) => {
    let finish!: (response: Response) => void;
    let fail!: (error: Error) => void;
    const cancelled = new Promise<Response>((resolve, reject) => {
      finish = resolve;
      fail = reject;
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({ requestId: "old", status: "running", response: null }),
        )
        .mockReturnValueOnce(cancelled)
        .mockResolvedValueOnce(
          Response.json({
            requestId: "new",
            status: "completed",
            response: {
              message: "New validated guidance",
              citations: [],
              hintTier: 1,
            },
          }),
        ),
    );
    render(<TutorPanel available getAttemptId={() => "attempt"} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask tutor" }));
    await screen.findByText("Still pending. Retry to check the saved request.");
    fireEvent.click(screen.getByRole("button", { name: "Cancel tutor request" }));
    fireEvent.click(screen.getByRole("button", { name: "Ask tutor" }));
    await screen.findByText("New validated guidance");
    await act(async () => {
      if (outcome === "success")
        finish(Response.json({ requestId: "old", status: "cancelled", response: null }));
      else fail(new Error("Connection failed"));
      await Promise.resolve();
    });
    expect(screen.getByText("New validated guidance")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Validated guidance saved.");
  },
);
