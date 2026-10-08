import type { ReactElement } from "react";

type AlgoCoveMarkProps = {
  dark?: boolean;
  compact?: boolean;
};

/** The approved cove-and-angle-brackets mark from the DSA mockups. */
export default function AlgoCoveMark({
  dark = false,
  compact = false,
}: AlgoCoveMarkProps): ReactElement {
  const cove = dark ? "#73D6C4" : "#123F46";
  const accent = dark ? "#42A991" : "#1A8F78";
  const text = dark ? "#F8FBFA" : "#102A2E";

  return (
    <span className={`ac-logo${compact ? " ac-logo--compact" : ""}`}>
      <svg className="ac-logo__mark" viewBox="0 0 48 48" role="img" aria-label="AlgoCove logo mark">
        <path
          d="M36.5 10.5A19 19 0 1 0 37 35"
          fill="none"
          stroke={cove}
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M8 30.5c4.4 1.1 7.9 4.9 13.8 4.9 6.6 0 11.9-3.1 17.4-8.5-1.8 8.7-8.5 14.9-17.2 14.9-6.6 0-11.7-4.4-14-11.3Z"
          fill={accent}
          opacity=".9"
        />
        <path
          d="M19 19.5 12.5 24l6.5 4.5M29 19.5l6.5 4.5-6.5 4.5"
          fill="none"
          stroke={accent}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {!compact && (
        <span className="ac-logo__lockup">
          <span className="ac-logo__wordmark" style={{ color: text }}>
            AlgoCove
          </span>
          <span className="ac-logo__tagline" style={{ color: text }}>
            Deeper Understanding
            <br />
            Further Futures
          </span>
        </span>
      )}
    </span>
  );
}
