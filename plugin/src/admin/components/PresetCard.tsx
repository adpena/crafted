import type { CSSProperties, ReactNode } from "react";

export interface PresetCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  onSelect: () => void;
  /** Optional accent color for the icon strip. */
  accent?: string;
}

const cardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "0.875rem",
  padding: "1.5rem",
  minHeight: "180px",
  background: "var(--page-surface, #faf9f5)",
  border: "1px solid var(--page-border, #d4d4c8)",
  borderRadius: "4px",
  cursor: "pointer",
  textAlign: "left",
  fontFamily: "inherit",
  transition: "transform 120ms ease, border-color 120ms ease",
};

const iconWrapStyle = (accent: string): CSSProperties => ({
  width: "44px",
  height: "44px",
  borderRadius: "4px",
  background: accent,
  color: "#fff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "1.25rem",
  fontFamily: "Georgia, 'Times New Roman', serif",
});

const titleStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "1.25rem",
  fontWeight: 500,
  letterSpacing: "-0.01em",
  color: "var(--page-text, #1a1a1a)",
  margin: 0,
};

const descStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "0.9rem",
  lineHeight: 1.5,
  color: "var(--page-secondary, #6b6b6b)",
  margin: 0,
  fontStyle: "italic",
};

export function PresetCard({ title, description, icon, onSelect, accent = "#1a1a1a" }: PresetCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={cardStyle}
      onMouseEnter={(event) => {
        event.currentTarget.style.borderColor = accent;
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.borderColor = "var(--page-border, #d4d4c8)";
      }}
    >
      <span aria-hidden style={iconWrapStyle(accent)}>
        {icon}
      </span>
      <h3 style={titleStyle}>{title}</h3>
      <p style={descStyle}>{description}</p>
    </button>
  );
}

export default PresetCard;
