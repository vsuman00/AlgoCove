import Link from "next/link";
import type { ReactElement } from "react";
import type { LearningPublicView } from "@algocove/content/learning-release";
export default function LearningBrief({
  learning,
}: {
  learning: LearningPublicView | null;
}): ReactElement {
  if (!learning) return <p>Reviewed lesson assets are unavailable for this release.</p>;
  return (
    <>
      <dl className="ac-workspace__facts">
        {[
          ["Input", learning.brief.input],
          ["Output", learning.brief.output],
          ["Target", learning.brief.complexity],
        ].map(([label, text]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
      <div className="ac-invariant-callout">
        <span className="ac-invariant-badge">Key Invariant</span>
        <p>{learning.brief.invariant}</p>
      </div>
      <div className="ac-lesson-section">
        <h3>Concept lesson</h3>
        {learning.lesson.prerequisites.length > 0 && (
          <>
            <p>Prerequisite topics</p>
            <ul>
              {learning.lesson.prerequisites.map((p) => (
                <li key={p}>
                  <Link href={`/learn/topics/${p}`}>{p.replaceAll("-", " ")}</Link>
                </li>
              ))}
            </ul>
          </>
        )}
        <ul>
          {learning.lesson.objectives.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
        {learning.lesson.blocks.map((b, i) => (
          <p key={i}>{b.text}</p>
        ))}
      </div>
      {learning.media.map((m) => (
        <section key={m.url} aria-label={m.title}>
          <h3>{m.title}</h3>
          <a href={m.url} target="_blank" rel="noopener noreferrer">
            {m.role === "video" ? "Watch optional video" : "Read optional explanation"} (new tab)
          </a>
          {m.transcript && (
            <details>
              <summary>Accessible transcript</summary>
              <p>{m.transcript}</p>
            </details>
          )}
        </section>
      ))}
    </>
  );
}
