import type { CSSProperties } from "react";

export type ThemeId = "warm" | "bold" | "clean";

export interface ThemeOption {
  id: ThemeId;
  name: string;
  description: string;
  bg: string;
  text: string;
  accent: string;
  border: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "warm",
    name: "Warm",
    description: "Editorial cream + serif. The default.",
    bg: "#f5f5f0",
    text: "#1a1a1a",
    accent: "#1a1a1a",
    border: "#d4d4c8",
  },
  {
    id: "bold",
    name: "Bold",
    description: "Dark mode with a hot accent.",
    bg: "#0a0a0a",
    text: "#ffffff",
    accent: "#ef4444",
    border: "#2a2a2a",
  },
  {
    id: "clean",
    name: "Clean",
    description: "White, minimal, blue accent.",
    bg: "#ffffff",
    text: "#1a1a1a",
    accent: "#2563eb",
    border: "#e5e5e5",
  },
];

export interface ThemeSwatchProps {
  value: ThemeId;
  onChange: (id: ThemeId) => void;
}

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "1rem",
};

function swatchStyle(selected: boolean): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    padding: "0.75rem",
    minHeight: "44px",
    background: "transparent",
    border: `1px solid ${selected ? "#1a1a1a" : "#d4d4c8"}`,
    boxShadow: selected ? "inset 0 0 0 1px #1a1a1a" : "none",
    cursor: "pointer",
    textAlign: "left",
    transition: "border-color 120ms ease, box-shadow 120ms ease",
  };
}

function previewStyle(opt: ThemeOption): CSSProperties {
  return {
    width: "100%",
    aspectRatio: "16 / 9",
    background: opt.bg,
    border: `1px solid ${opt.border}`,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: "0.375rem",
    padding: "0.75rem",
  };
}

const nameStyle: CSSProperties = {
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  fontSize: "0.7rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  margin: 0,
  color: "#1a1a1a",
};

const descStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "0.85rem",
  lineHeight: 1.4,
  color: "#6b6b6b",
  margin: 0,
};

export function ThemeSwatch({ value, onChange }: ThemeSwatchProps) {
  return (
    <div style={gridStyle} role="radiogroup" aria-label="Theme">
      {THEME_OPTIONS.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.id)}
            style={swatchStyle(selected)}
          >
            <div style={previewStyle(opt)}>
              <div
                style={{
                  width: "60%",
                  height: "6px",
                  background: opt.text,
                }}
              />
              <div
                style={{
                  width: "40%",
                  height: "4px",
                  background: opt.text,
                  opacity: 0.6,
                }}
              />
              <div
                style={{
                  marginTop: "0.25rem",
                  padding: "0.25rem 0.5rem",
                  background: opt.accent,
                  color: opt.bg,
                  fontFamily: "'SF Mono', monospace",
                  fontSize: "0.6rem",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                Take action
              </div>
            </div>
            <p style={nameStyle}>{opt.name}</p>
            <p style={descStyle}>{opt.description}</p>
          </button>
        );
      })}
    </div>
  );
}

export default ThemeSwatch;
