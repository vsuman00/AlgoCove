import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import TraceRenderer from "../../../apps/web/src/components/trace-renderer";

const trace = {
  schemaVersion: 1,
  traceId: "trace-renderer-1",
  version: 1,
  provenance: "learner_draft",
  structure: "array_two_pointer",
  initialValues: [1, 8, 6],
  events: [{ kind: "compare", left: 0, right: 2 }, { kind: "move_left" }, { kind: "complete" }],
};

describe("Task 27 accessible trace renderer", () => {
  it("supports keyboard and labeled controls without relying on color or motion", async () => {
    const user = userEvent.setup();
    render(<TraceRenderer trace={trace} />);

    const renderer = screen.getByRole("region", { name: "Array trace" });
    expect(screen.getByRole("status")).toHaveTextContent("Step 0 of 3");
    expect(screen.getByRole("list", { name: "Array values" })).toBeVisible();
    expect(screen.getByLabelText("Value 1 at index 0, left pointer")).toBeVisible();

    await user.click(renderer);
    fireEvent.keyDown(renderer, { key: "ArrowRight" });
    expect(screen.getByRole("status")).toHaveTextContent("Step 1 of 3");
    fireEvent.keyDown(renderer, { key: "End" });
    expect(screen.getByRole("status")).toHaveTextContent("Step 3 of 3");
    expect(screen.getByRole("button", { name: "Next step" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Restart trace" }));
    expect(screen.getByRole("status")).toHaveTextContent("Step 0 of 3");
  });

  it("fails closed and explains the reviewed-reference fallback", () => {
    render(<TraceRenderer trace={{ ...trace, structure: "source_execution_trace" }} />);

    expect(screen.getByRole("heading", { name: "Trace unavailable" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("will not invent visual states");
  });
});
