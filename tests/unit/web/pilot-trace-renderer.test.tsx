import { readFileSync } from "node:fs";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { validatePilotTrace } from "@algocove/visualizer";
import PilotTraceRenderer from "../../../apps/web/src/components/practice/pilot-trace-renderer";
import { PILOT_PATTERNS } from "../../../packages/content/src/pilot-bundle.ts";
it.each(PILOT_PATTERNS)("renders %s text equivalents and keyboard boundaries", (pattern) => {
  const b = JSON.parse(readFileSync(`content/patterns/${pattern}/bundle.json`, "utf8"));
  const t = validatePilotTrace({
    schemaVersion: 2,
    provenance: "authored_reference",
    pattern,
    ...b.trace,
  });
  render(<PilotTraceRenderer trace={t} />);
  const region = screen.getByRole("region");
  expect(screen.getByRole("button", { name: "Previous step" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Use isometric view" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  fireEvent.keyDown(region, { key: "ArrowRight", ctrlKey: true, altKey: true });
  expect(screen.getByRole("status")).toHaveTextContent("initialize");
  fireEvent.keyDown(region, { key: "End" });
  expect(screen.getByRole("status")).toHaveTextContent("complete");
  expect(screen.getByRole("button", { name: "Next step" })).toBeDisabled();
  fireEvent.keyDown(region, { key: "Home" });
  expect(screen.getByRole("status")).toHaveTextContent("initialize");
  fireEvent.click(screen.getByRole("button", { name: "Next step" }));
  expect(screen.getByRole("status")).toHaveTextContent("Step 1:");
  expect(screen.getByText("Full text transcript")).toBeVisible();
});
