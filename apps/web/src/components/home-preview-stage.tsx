"use client";

import { useState, type ReactElement } from "react";
import { Icon } from "./algocove-icons";

const PREVIEW_ARRAY = [1, 3, 4, 6, 8, 11] as const;
const TARGET = 10;

const STEPS = [
  {
    left: 0,
    right: 5,
    note: "1 + 11 = 12 > 10. The array is sorted: any element after index 0 would only increase the sum. Advance R left.",
    action: "Advance R left",
  },
  {
    left: 0,
    right: 4,
    note: "1 + 8 = 9 < 10. Index 0 cannot pair with any remaining candidate. Advance L right.",
    action: "Advance L right",
  },
  {
    left: 1,
    right: 4,
    note: "3 + 8 = 11 > 10. Sum exceeds target 10. Advance R left.",
    action: "Advance R left",
  },
  {
    left: 1,
    right: 3,
    note: "3 + 6 = 9 < 10. Sum is below target 10. Advance L right.",
    action: "Advance L right",
  },
  {
    left: 2,
    right: 3,
    note: "4 + 6 = 10. Target pair discovered at indices [2, 3] in O(n) time and O(1) space!",
    action: "Target pair matched",
  },
] as const;

export default function HomePreviewStage(): ReactElement {
  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = STEPS[stepIndex] ?? STEPS[0];
  const leftVal = PREVIEW_ARRAY[currentStep.left] ?? 1;
  const rightVal = PREVIEW_ARRAY[currentStep.right] ?? 11;
  const sum = leftVal + rightVal;

  return (
    <section className="ac-preview-hero-card" aria-labelledby="preview-stage-title">
      <div className="ac-preview-header">
        <div>
          <div className="ac-preview-badges">
            <span className="ac-status-pill is-now">Two Pointers</span>
            <span className="ac-preview-time">Interactive 3D Preview</span>
          </div>
          <h2 id="preview-stage-title">Converging on a sorted array</h2>
          <p className="ac-preview-desc">
            Experience spatial invariant reasoning in action: eliminating candidate pairs in linear
            time without nested loops.
          </p>
        </div>
      </div>

      <div className="ac-preview-stage-container">
        <div className="ac-preview-calc-row">
          <div className="ac-trace-calc-pill" role="status" aria-live="polite">
            <span className="ac-trace-calc-icon" aria-hidden="true">
              Σ
            </span>
            <span>
              Current sum: {leftVal} + {rightVal} = <strong>{sum}</strong>
            </span>
            <span
              className={`ac-trace-target-badge ${
                sum === TARGET ? "is-match" : sum > TARGET ? "is-over" : "is-under"
              }`}
            >
              {sum === TARGET
                ? "= Target 10 (Found)"
                : sum > TARGET
                  ? "> Target 10"
                  : "< Target 10"}
            </span>
          </div>

          <span className="ac-preview-step-badge">
            Step {stepIndex + 1} of {STEPS.length}
          </span>
        </div>

        <div className="ac-preview-3d-stage" aria-label="3D visual array representation">
          <div className="ac-preview-array-scene">
            {PREVIEW_ARRAY.map((val, idx) => {
              const isLeft = idx === currentStep.left;
              const isRight = idx === currentStep.right;
              const isBetween = idx > currentStep.left && idx < currentStep.right;
              const isRuledOut = idx < currentStep.left || idx > currentStep.right;
              const heightPx = 40 + val * 6;

              return (
                <div
                  key={idx}
                  className={`ac-preview-cube-column ${
                    isLeft
                      ? "is-pointer-left"
                      : isRight
                        ? "is-pointer-right"
                        : isRuledOut
                          ? "is-ruled-out"
                          : isBetween
                            ? "is-active-range"
                            : ""
                  }`}
                  data-pointer-left={isLeft ? "true" : undefined}
                  data-pointer-right={isRight ? "true" : undefined}
                >
                  <div className="ac-preview-cube-pointer">
                    {isLeft && (
                      <span
                        className="ac-pointer-badge ac-pointer-badge--left"
                        aria-label="Left pointer"
                      >
                        L
                      </span>
                    )}
                    {isRight && (
                      <span
                        className="ac-pointer-badge ac-pointer-badge--right"
                        aria-label="Right pointer"
                      >
                        R
                      </span>
                    )}
                    {!isLeft && !isRight && (
                      <span className="ac-pointer-spacer" aria-hidden="true" />
                    )}
                  </div>

                  <div className="ac-preview-cube-body" style={{ height: `${heightPx}px` }}>
                    <div className="ac-preview-cube-top">
                      <span className="ac-preview-cube-val">{val}</span>
                    </div>
                    <div className="ac-preview-cube-front" />
                    <div className="ac-preview-cube-right" />
                  </div>

                  <div className="ac-preview-cube-idx" aria-hidden="true">
                    [{idx}]
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="ac-preview-explanation">
          <p>
            <strong>Invariant check:</strong> {currentStep.note}
          </p>
        </div>

        <div className="ac-preview-controls">
          <div className="ac-preview-nav-buttons">
            <button
              type="button"
              className="ac-small-button"
              disabled={stepIndex === 0}
              onClick={() => setStepIndex((idx) => Math.max(0, idx - 1))}
            >
              Previous step
            </button>
            <button
              type="button"
              className="ac-small-button ac-small-button--filled"
              disabled={stepIndex === STEPS.length - 1}
              onClick={() => setStepIndex((idx) => Math.min(STEPS.length - 1, idx + 1))}
            >
              {stepIndex === STEPS.length - 1 ? "Completed" : "Next step"}
            </button>
            {stepIndex > 0 && (
              <button type="button" className="ac-small-button" onClick={() => setStepIndex(0)}>
                Reset
              </button>
            )}
          </div>

          <a className="ac-button ac-button--primary" href="/learn/arrays-two-pointer">
            <span>Explore full problem workspace</span>
            <Icon name="arrow" size={18} />
          </a>
        </div>
      </div>

      <div className="ac-preview-curriculum">
        <h3 className="ac-preview-curriculum-title">Curriculum progression at a glance</h3>
        <div className="ac-curriculum-phases">
          <div className="ac-curriculum-phase">
            <span className="ac-phase-tag">Phase 1</span>
            <strong>Foundations</strong>
            <p>Arrays & Hashing, Binary Search</p>
          </div>
          <div className="ac-curriculum-phase is-active">
            <span className="ac-phase-tag is-active">Phase 2 · Active</span>
            <strong>Core Patterns</strong>
            <p>Two Pointers, Sliding Window, Monotonic Stack</p>
          </div>
          <div className="ac-curriculum-phase">
            <span className="ac-phase-tag">Phase 3</span>
            <strong>Trees & Graphs</strong>
            <p>Binary Search Trees, BFS / DFS traversals</p>
          </div>
          <div className="ac-curriculum-phase">
            <span className="ac-phase-tag">Phase 4</span>
            <strong>Transfer & Interview</strong>
            <p>Dynamic Programming, External practice</p>
          </div>
        </div>
      </div>
    </section>
  );
}
