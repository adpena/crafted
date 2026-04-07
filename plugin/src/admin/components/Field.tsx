import type { CSSProperties, ReactNode } from "react";

export interface FieldProps {
  label: string;
  /** Field id, used to wire up the label */
  htmlFor?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Helper text shown beneath the input */
  helper?: string;
  /** Validation error string (when present, the field renders in error state) */
  error?: string;
  /** Optional content rendered to the right of the label (e.g. char count) */
  rightLabel?: ReactNode;
  children: ReactNode;
}

const wrapperStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.375rem",
};

const labelRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "0.5rem",
};

const labelStyle: CSSProperties = {
  fontFamily: "var(--page-font-mono, 'SF Mono', 'Fira Code', monospace)",
  fontSize: "0.7rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--page-text, #1a1a1a)",
  fontWeight: 500,
};

const requiredMarkStyle: CSSProperties = {
  color: "#c2410c",
  marginLeft: "0.25rem",
};

const helperStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "0.85rem",
  fontStyle: "italic",
  color: "var(--page-secondary, #6b6b6b)",
  margin: 0,
};

const errorStyle: CSSProperties = {
  fontFamily: "var(--page-font-mono, 'SF Mono', 'Fira Code', monospace)",
  fontSize: "0.75rem",
  color: "#b91c1c",
  margin: 0,
};

export function Field({
  label,
  htmlFor,
  required,
  helper,
  error,
  rightLabel,
  children,
}: FieldProps) {
  return (
    <div style={wrapperStyle}>
      <div style={labelRowStyle}>
        <label htmlFor={htmlFor} style={labelStyle}>
          {label}
          {required && <span style={requiredMarkStyle}>*</span>}
        </label>
        {rightLabel}
      </div>
      {children}
      {helper && !error && <p style={helperStyle}>{helper}</p>}
      {error && <p style={errorStyle}>{error}</p>}
    </div>
  );
}

/**
 * Shared input style — border-bottom only, 44px touch target.
 * Pass `hasError` to render the error state border.
 */
export function inputStyle(hasError = false): CSSProperties {
  return {
    width: "100%",
    minHeight: "44px",
    padding: "0.5rem 0",
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: "1rem",
    color: "var(--page-text, #1a1a1a)",
    background: "transparent",
    border: "none",
    borderBottom: `1px solid ${
      hasError ? "#b91c1c" : "var(--page-border, #d4d4c8)"
    }`,
    borderRadius: 0,
    outline: "none",
    boxSizing: "border-box",
  };
}

export default Field;
