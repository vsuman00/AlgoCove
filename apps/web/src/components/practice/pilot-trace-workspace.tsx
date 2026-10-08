"use client";
import { useEffect, useRef, useState, type ReactElement } from "react";
import {
  validatePilotTrace,
  validateWalkthrough,
  type Walkthrough,
  type PilotTrace,
} from "@algocove/visualizer";
import PilotTraceRenderer from "./pilot-trace-renderer";
/** Reference content is fetched only after server-owned assistance accounting. */
export default function PilotTraceWorkspace({
  getAttemptId,
  onExposure,
}: {
  getAttemptId: () => string | undefined;
  onExposure: (tier: number) => void;
}): ReactElement {
  const [walkthrough, setWalkthrough] = useState<Walkthrough | undefined>(undefined);
  const [trace, setTrace] = useState<PilotTrace | null>(null);
  const [status, setStatus] = useState(
    "Predict the next state before revealing the reviewed reference. Revealing counts as tier 4 assistance.",
  );
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );
  const reveal = async () => {
    const attemptId = getAttemptId();
    if (!attemptId) {
      setStatus("Sign in and sync the workspace to reveal the reviewed trace.");
      return;
    }
    const token = ++generation.current;
    setLoading(true);
    try {
      const r = await fetch("/api/practice/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId }),
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw Error("unavailable");
      const body = (await r.json()) as {
        trace: unknown;
        walkthrough?: unknown;
        exposure: { tier: number };
      };
      const next = validatePilotTrace(body.trace);
      const synchronized = body.walkthrough ? validateWalkthrough(body.walkthrough) : undefined;
      if (body.exposure.tier !== 4) throw Error("invalid accounting");
      if (token !== generation.current || attemptId !== getAttemptId()) return;
      onExposure(4);
      setTrace(next);
      setWalkthrough(synchronized);
      setStatus("Reviewed reference revealed after tier 4 assistance was recorded.");
    } catch {
      if (token === generation.current)
        setStatus("The reviewed trace is unavailable. Retry after the workspace is synced.");
    } finally {
      if (token === generation.current) setLoading(false);
    }
  };
  return (
    <div>
      <label>
        Your next-state prediction
        <textarea aria-label="Your next-state prediction" maxLength={2000} />
      </label>
      <p role="status">{status}</p>
      <button type="button" disabled={loading} onClick={() => void reveal()}>
        {loading ? "Loading reviewed trace…" : "Reveal reviewed reference"}
      </button>
      {trace && <PilotTraceRenderer trace={trace} walkthrough={walkthrough} />}
    </div>
  );
}
