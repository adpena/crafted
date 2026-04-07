import type { CSSProperties, ReactNode } from "react";

export type TemplateId = "hero-simple" | "hero-media" | "hero-story";

export interface TemplateOption {
  id: TemplateId;
  name: string;
  description: string;
}

export const TEMPLATE_OPTIONS: TemplateOption[] = [
  {
    id: "hero-simple",
    name: "Hero — Simple",
    description: "Headline and subhead. Quick to publish, hard to ignore.",
  },
  {
    id: "hero-media",
    name: "Hero — Media",
    description: "Full-bleed image or video behind the headline.",
  },
  {
    id: "hero-story",
    name: "Hero — Story",
    description: "Long-form narrative with a pull quote.",
  },
];

export interface TemplatePickerProps {
  value: TemplateId | null;
  onChange: (id: TemplateId) => void;
}

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "1rem",
};

function cardStyle(selected: boolean): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    padding: "1rem",
    minHeight: "44px",
    background: "transparent",
    border: `1px solid ${
      selected ? "var(--page-text, #1a1a1a)" : "var(--page-border, #d4d4c8)"
    }`,
    boxShadow: selected
      ? "inset 0 0 0 1px var(--page-text, #1a1a1a)"
      : "none",
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "Georgia, 'Times New Roman', serif",
    color: "var(--page-text, #1a1a1a)",
    transition: "border-color 120ms ease, box-shadow 120ms ease",
  };
}

const thumbWrapStyle: CSSProperties = {
  width: "100%",
  aspectRatio: "16 / 9",
  background: "#faf9f4",
  border: "1px solid var(--page-border, #d4d4c8)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
};

const nameStyle: CSSProperties = {
  fontFamily: "var(--page-font-mono, 'SF Mono', 'Fira Code', monospace)",
  fontSize: "0.7rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  margin: 0,
};

const descStyle: CSSProperties = {
  fontSize: "0.85rem",
  lineHeight: 1.4,
  color: "var(--page-secondary, #6b6b6b)",
  margin: 0,
};

function HeroSimpleThumb(): ReactNode {
  return (
    <svg viewBox="0 0 160 90" width="100%" height="100%" aria-hidden>
      <rect x="0" y="0" width="160" height="90" fill="#f5f5f0" />
      <rect x="20" y="32" width="120" height="8" fill="#1a1a1a" />
      <rect x="20" y="46" width="80" height="4" fill="#6b6b6b" />
      <rect x="20" y="62" width="36" height="10" fill="#1a1a1a" />
    </svg>
  );
}

function HeroMediaThumb(): ReactNode {
  return (
    <svg viewBox="0 0 160 90" width="100%" height="100%" aria-hidden>
      <rect x="0" y="0" width="160" height="90" fill="#1a1a1a" />
      <circle cx="40" cy="32" r="8" fill="#d4d4c8" />
      <path d="M0 70 L60 40 L100 60 L160 30 L160 90 L0 90 Z" fill="#3a3a3a" />
      <rect x="20" y="50" width="120" height="6" fill="#ffffff" opacity="0.95" />
      <rect x="20" y="62" width="70" height="3" fill="#ffffff" opacity="0.7" />
    </svg>
  );
}

function HeroStoryThumb(): ReactNode {
  return (
    <svg viewBox="0 0 160 90" width="100%" height="100%" aria-hidden>
      <rect x="0" y="0" width="160" height="90" fill="#f5f5f0" />
      <rect x="20" y="14" width="100" height="6" fill="#1a1a1a" />
      <rect x="20" y="28" width="120" height="3" fill="#6b6b6b" />
      <rect x="20" y="34" width="120" height="3" fill="#6b6b6b" />
      <rect x="20" y="40" width="90" height="3" fill="#6b6b6b" />
      <rect x="24" y="52" width="2" height="20" fill="#1a1a1a" />
      <rect x="32" y="54" width="100" height="3" fill="#1a1a1a" />
      <rect x="32" y="60" width="80" height="3" fill="#1a1a1a" />
      <rect x="32" y="66" width="60" height="3" fill="#1a1a1a" />
    </svg>
  );
}

const THUMBS: Record<TemplateId, ReactNode> = {
  "hero-simple": <HeroSimpleThumb />,
  "hero-media": <HeroMediaThumb />,
  "hero-story": <HeroStoryThumb />,
};

export function TemplatePicker({ value, onChange }: TemplatePickerProps) {
  return (
    <div style={gridStyle} role="radiogroup" aria-label="Template">
      {TEMPLATE_OPTIONS.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.id)}
            style={cardStyle(selected)}
          >
            <div style={thumbWrapStyle}>{THUMBS[opt.id]}</div>
            <p style={nameStyle}>{opt.name}</p>
            <p style={descStyle}>{opt.description}</p>
          </button>
        );
      })}
    </div>
  );
}

export default TemplatePicker;
