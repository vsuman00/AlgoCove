"use client";
import type { ReactElement } from "react";
import { useState } from "react";
import LearningBrief from "../learning/learning-brief";
import { releasePublicView } from "@algocove/content/learning-release";
import { validateWalkthrough } from "@algocove/visualizer";
import PilotTraceRenderer from "../practice/pilot-trace-renderer";
type Preview = { issues: string[]; manifest: unknown; packet: unknown; walkthrough: unknown };
export default function ReleasePreflight({ versionId }: { versionId: string }): ReactElement {
  const [preview, setPreview] = useState<Preview | null>(null),
    [packet, setPacket] = useState(""),
    [walkthrough, setWalkthrough] = useState(""),
    [checksum, setChecksum] = useState<string | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    try {
      const r = await fetch(
        `/api/admin/learning-release?versionId=${encodeURIComponent(versionId)}`,
        { cache: "no-store" },
      );
      if (!r.ok) throw Error("Preflight is unavailable for this account or release.");
      const p = (await r.json()) as Preview;
      setPreview(p);
      setPacket(JSON.stringify(p.packet, null, 2));
      setWalkthrough(JSON.stringify(p.walkthrough, null, 2));
      setChecksum((p as Preview & { checksum?: string }).checksum ?? null);
      setMessage(
        p.issues.length
          ? "Resolve the listed issues before requesting publication."
          : "Preflight passed. Independent reviews and publication remain required.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unavailable");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/learning-release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: "set",
          versionId,
          expectedChecksum: checksum,
          packet: JSON.parse(packet),
          walkthrough: JSON.parse(walkthrough),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error?.message ?? "Release was not saved.");
      setChecksum(d.checksum);
      setPreview(null);
      setMessage("Draft saved. Reload content before recording new reviews.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Invalid release JSON.");
    } finally {
      setBusy(false);
    }
  }
  let learning = null,
    trace = null;
  try {
    if (preview?.packet) learning = releasePublicView(preview.packet);
    if (preview?.walkthrough) trace = validateWalkthrough(preview.walkthrough);
  } catch {
    /* Display issues without rendering unsafe author assets. */
  }
  return (
    <section className="ac-panel" aria-label="Learning release preflight">
      <h2>Learning release assets</h2>
      <button className="ac-small-button" disabled={busy} onClick={() => void load()}>
        Preview and preflight
      </button>
      <p role="status">{message}</p>
      {preview && (
        <>
          <ul>
            {preview.issues.map((i) => (
              <li key={i}>{i.replaceAll("_", " ")}</li>
            ))}
          </ul>
          <LearningBrief learning={learning} />
          {trace && (
            <PilotTraceRenderer
              trace={trace.trace}
              walkthrough={trace}
              assistanceRecorded={false}
            />
          )}
          <details>
            <summary>Exact asset and language pins</summary>
            <pre>{JSON.stringify(preview.manifest, null, 2)}</pre>
          </details>
        </>
      )}
      <details>
        <summary>Edit owned draft release</summary>
        <p>
          Provide the typed lesson, checkpoints, six hints, delayed review, transfer, optional media
          and synchronized walkthrough. Pilot bundles retain their separate import workflow. Saving
          clears previous content reviews.
        </p>
        <label>
          Release packet JSON
          <textarea value={packet} onChange={(e) => setPacket(e.target.value)} rows={12} />
        </label>
        <label>
          Walkthrough JSON
          <textarea
            value={walkthrough}
            onChange={(e) => setWalkthrough(e.target.value)}
            rows={12}
          />
        </label>
        <button className="ac-small-button" disabled={busy} onClick={() => void save()}>
          Save draft assets
        </button>
      </details>
    </section>
  );
}
