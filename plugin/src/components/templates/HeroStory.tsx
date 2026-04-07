import type { ReactNode } from "react";

export interface HeroStoryProps {
  headline: string;
  subhead?: string;
  body: string;
  pull_quote?: string;
}

export function HeroStory({
  headline,
  subhead,
  body,
  pull_quote,
}: HeroStoryProps): ReactNode {
  const paragraphs = body.split(/\n{2,}/);

  return (
    <article
      style={{
        padding: "2.5rem 1.5rem 2rem",
        maxWidth: "38em",
      }}
    >
      {/* Headline */}
      <h1
        style={{
          fontFamily: "var(--page-font-serif, Georgia, serif)",
          color: "var(--page-text, #1a1a1a)",
          fontSize: "clamp(2rem, 5vw, 3.25rem)",
          fontWeight: 700,
          lineHeight: 1.15,
          letterSpacing: "-0.015em",
          margin: 0,
        }}
      >
        {headline}
      </h1>

      {/* Subhead */}
      {subhead && (
        <p
          style={{
            fontFamily: "var(--page-font-serif, Georgia, serif)",
            color: "var(--page-secondary, #555)",
            fontSize: "clamp(1.05rem, 2.5vw, 1.3rem)",
            lineHeight: 1.5,
            marginTop: "0.75rem",
            marginBottom: 0,
          }}
        >
          {subhead}
        </p>
      )}

      {/* Body */}
      <div
        style={{
          marginTop: "1.75rem",
          color: "var(--page-secondary, #555)",
          fontSize: "1.075rem",
          lineHeight: 1.7,
        }}
      >
        {paragraphs.map((p, i) => (
          <p
            key={i}
            style={{
              margin: 0,
              marginTop: i > 0 ? "1.2em" : 0,
            }}
          >
            {p}
          </p>
        ))}
      </div>

      {/* Pull quote */}
      {pull_quote && (
        <blockquote
          style={{
            fontFamily: "var(--page-font-serif, Georgia, serif)",
            color: "var(--page-text, #1a1a1a)",
            fontSize: "clamp(1.2rem, 3vw, 1.5rem)",
            fontStyle: "italic",
            fontWeight: 400,
            lineHeight: 1.5,
            margin: "2rem 0 0 0",
            padding: "0.25rem 0 0.25rem 1.25rem",
            borderLeft: "3px solid var(--page-accent, #c00)",
          }}
        >
          {pull_quote}
        </blockquote>
      )}
    </article>
  );
}
