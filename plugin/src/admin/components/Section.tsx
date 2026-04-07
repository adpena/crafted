import type { CSSProperties, ReactNode } from "react";

export interface SectionProps {
  /** Numeric step index, e.g. 1, 2, 3, 4 */
  step?: number;
  /** Section title (e.g. "Basics") */
  title: string;
  /** Optional supporting copy under the title */
  description?: string;
  children: ReactNode;
}

const sectionStyle: CSSProperties = {
  marginBottom: "3rem",
};

const headerRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: "0.75rem",
  marginBottom: "0.25rem",
};

const stepStyle: CSSProperties = {
  fontFamily: "var(--page-font-mono, 'SF Mono', 'Fira Code', monospace)",
  fontSize: "0.75rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--page-secondary, #6b6b6b)",
};

const titleStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "1.75rem",
  fontWeight: 500,
  margin: 0,
  color: "var(--page-text, #1a1a1a)",
  letterSpacing: "-0.01em",
};

const descStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "0.95rem",
  lineHeight: 1.5,
  color: "var(--page-secondary, #6b6b6b)",
  margin: "0 0 1rem 0",
  fontStyle: "italic",
};

const ruleStyle: CSSProperties = {
  border: "none",
  borderTop: "1px solid var(--page-border, #d4d4c8)",
  margin: "0 0 1.5rem 0",
};

const bodyStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
};

export function Section({ step, title, description, children }: SectionProps) {
  return (
    <section style={sectionStyle}>
      <div style={headerRowStyle}>
        {step !== undefined && <span style={stepStyle}>Step {step}</span>}
        <h2 style={titleStyle}>{title}</h2>
      </div>
      {description && <p style={descStyle}>{description}</p>}
      <hr style={ruleStyle} />
      <div style={bodyStyle}>{children}</div>
    </section>
  );
}

export default Section;
