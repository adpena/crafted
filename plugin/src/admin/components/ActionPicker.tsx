import type { CSSProperties } from "react";

export type ActionId = "fundraise" | "petition" | "gotv" | "signup";

export interface ActionOption {
  id: ActionId;
  name: string;
  description: string;
  glyph: string;
}

export const ACTION_OPTIONS: ActionOption[] = [
  {
    id: "fundraise",
    name: "Fundraise",
    description: "Push donors to ActBlue with one-tap amounts.",
    glyph: "$",
  },
  {
    id: "petition",
    name: "Petition",
    description: "Collect names, emails, and ZIPs at scale.",
    glyph: "✎",
  },
  {
    id: "gotv",
    name: "GOTV",
    description: "Pledge-to-vote with election day reminders.",
    glyph: "✓",
  },
  {
    id: "signup",
    name: "Signup",
    description: "Grow your list with a lightweight email capture.",
    glyph: "✉",
  },
];

export interface ActionPickerProps {
  value: ActionId | null;
  onChange: (id: ActionId) => void;
  /** Restrict the available action ids (used for the followup picker). */
  allowed?: ActionId[];
}

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "1rem",
};

function cardStyle(selected: boolean): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
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

const glyphStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "1.5rem",
  lineHeight: 1,
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

export function ActionPicker({ value, onChange, allowed }: ActionPickerProps) {
  const options = allowed
    ? ACTION_OPTIONS.filter((o) => allowed.includes(o.id))
    : ACTION_OPTIONS;

  return (
    <div style={gridStyle} role="radiogroup" aria-label="Action">
      {options.map((opt) => {
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
            <span style={glyphStyle} aria-hidden>
              {opt.glyph}
            </span>
            <p style={nameStyle}>{opt.name}</p>
            <p style={descStyle}>{opt.description}</p>
          </button>
        );
      })}
    </div>
  );
}

export default ActionPicker;
