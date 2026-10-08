"use client";
import { useState, type ReactElement } from "react";
const stages = [
  ["Understand", "prompt-title"],
  ["Pseudocode", "pseudocode-title"],
  ["Trace", "trace-workspace-title"],
  ["Implement", "editor-title"],
  ["Validate", "execution-summary"],
] as const;
/** Focus transitions keep all draft-owning panels mounted under the existing controller. */
export default function WorkspaceStages(): ReactElement {
  const [active, setActive] = useState("Understand");
  return (
    <ol className="ac-workspace__path" aria-label="Guided problem path" tabIndex={0}>
      {stages.map(([label, id], i) => (
        <li key={id}>
          <button
            type="button"
            className="ac-small-button"
            aria-current={active === label ? "step" : undefined}
            onClick={() => {
              const element = document.getElementById(id);
              if (element) {
                element.setAttribute("tabindex", "-1");
                element.focus();
                element.scrollIntoView({ block: "center", behavior: "instant" });
                setActive(label);
              }
            }}
          >
            <span aria-hidden="true">{i + 1}</span>
            <strong>{label}</strong>
          </button>
        </li>
      ))}
    </ol>
  );
}
