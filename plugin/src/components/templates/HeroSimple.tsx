import type { ReactNode } from "react";

export interface HeroSimpleProps {
  headline: string;
  subhead?: string;
  align?: "left" | "center";
}

export function HeroSimple({
  headline,
  subhead,
  align = "left",
}: HeroSimpleProps): ReactNode {
  return (
    <header
      style={{
        textAlign: align,
        padding: "2.5rem 1.5rem 2rem",
        maxWidth: "42em",
        marginInline: align === "center" ? "auto" : undefined,
      }}
    >
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

      {subhead && (
        <p
          style={{
            fontFamily: "var(--page-font-serif, Georgia, serif)",
            color: "var(--page-secondary, #555)",
            fontSize: "clamp(1.05rem, 2.5vw, 1.35rem)",
            lineHeight: 1.5,
            marginTop: "0.75rem",
            marginBottom: 0,
            fontWeight: 400,
          }}
        >
          {subhead}
        </p>
      )}
    </header>
  );
}
